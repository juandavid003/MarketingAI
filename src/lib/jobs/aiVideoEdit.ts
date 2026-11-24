import "server-only";
import { execFile } from "child_process";
import { promisify } from "util";
import { prisma } from "@/lib/prisma";
import { shortErrorMessage } from "@/lib/errors";
import { toAiBusiness } from "@/lib/businessContext";
import { videoEditKeys } from "@/lib/aiCredentials";
import { ffmpegPath, extractThumbnail } from "@/lib/video";
import type { Transcript } from "@/lib/whisper";
import {
  planVideoEdit,
  planCaption,
  clipKeepToCut,
  EDIT_PLATFORMS,
  EDIT_PROVIDERS,
  type EditProviderId,
} from "@/lib/aiVideoEdit";
import {
  renderNormalizedScene,
  concatScenes,
  renderFinal,
  buildAssemblyCues,
  cuesToAss,
  hexToAssColor,
  firstBrandColor,
  probeMedia,
  detectSilences,
  keepIntervalsFromSilences,
  totalLength,
  overlayWindow,
  type Cue,
} from "@/lib/videoEdit";
import { storageKey, localPath, ensureParentDir, saveBuffer, deleteStored } from "@/lib/storage";

// Runs one "Editar con IA" request (VideoEdit row, created as "planning" by
// the action): the chosen AI plans the edit → each cut is normalized to
// 1080x1920 (pauses inside it removed if asked) → cuts joined in the AI's
// order → subtitles, hook at the start, CTA at the end and logo burned in →
// a new VideoVersion on the same VideoAsset, ready to publish.

const execFileAsync = promisify(execFile);

export const EDIT_STALL_AFTER_MS = 30 * 60 * 1000;

export function isEditStalled(edit: { status: string; updatedAt: Date }): boolean {
  return (
    (edit.status === "planning" || edit.status === "rendering") &&
    Date.now() - edit.updatedAt.getTime() > EDIT_STALL_AFTER_MS
  );
}

const VERTICAL = { width: 1080, height: 1920 };

// Small proxy Gemini can watch inline: 360p, 2 fps, first 5 minutes.
async function makeEditProxy(inputPath: string, outputPath: string): Promise<void> {
  await execFileAsync(
    ffmpegPath(),
    [
      "-y", "-i", inputPath, "-t", "300",
      "-vf", "scale=-2:360,fps=2",
      "-c:v", "libx264", "-preset", "veryfast", "-crf", "32", "-pix_fmt", "yuv420p",
      "-c:a", "aac", "-b:a", "32k", "-ac", "1",
      "-threads", "2", outputPath,
    ],
    { maxBuffer: 1024 * 1024 * 16 }
  );
}

export async function runAiVideoEdit(editId: string): Promise<void> {
  let tmpPrefix: string | null = null;
  try {
    const edit = await prisma.videoEdit.findUniqueOrThrow({
      where: { id: editId },
      include: { videoAsset: { include: { business: { include: { products: true } } } } },
    });
    const asset = edit.videoAsset;
    const { business } = asset;
    const provider = edit.provider as EditProviderId;
    if (!(provider in EDIT_PROVIDERS)) throw new Error("IA no soportada.");
    if (!(edit.platform in EDIT_PLATFORMS)) throw new Error("Red no soportada.");
    if (asset.originalDeletedAt) throw new Error("El video original ya se borró; vuelve a subirlo para editarlo.");
    const apiKey = videoEditKeys(business)[provider];
    if (!apiKey) throw new Error(`Falta la key de ${EDIT_PROVIDERS[provider].label} en Ajustes.`);

    const inputPath = localPath(asset.originalPath);
    const { durationSeconds, hasAudio } = await probeMedia(inputPath);
    const transcript = asset.transcript ? (JSON.parse(asset.transcript) as Transcript) : null;
    const segments = transcript?.segments ?? [];

    const runId = edit.id.slice(-8);
    tmpPrefix = storageKey(business.id, "videos", asset.id, "edits", runId, "tmp");
    const outKey = (name: string) => storageKey(business.id, "videos", asset.id, "edits", runId, name);

    // 1) Plan.
    let proxyPath: string | null = null;
    if (provider === "gemini") {
      const proxyKey = `${tmpPrefix}/proxy.mp4`;
      await ensureParentDir(proxyKey);
      await makeEditProxy(inputPath, localPath(proxyKey));
      proxyPath = localPath(proxyKey);
    }
    const plan = await planVideoEdit({
      provider,
      apiKey,
      model: edit.model,
      business: toAiBusiness(business),
      platform: edit.platform,
      segments,
      durationSeconds,
      instructions: edit.instructions,
      proxyPath,
    });
    await prisma.videoEdit.update({ where: { id: edit.id }, data: { status: "rendering", plan: JSON.stringify(plan) } });

    // 2) Render each cut (optionally without its pauses) and its subtitles.
    const speech =
      edit.removeSilences && hasAudio
        ? keepIntervalsFromSilences(await detectSilences(inputPath, durationSeconds), durationSeconds)
        : null;
    const cutPaths: string[] = [];
    const cues: Cue[] = [];
    let offset = 0;
    for (const [i, cut] of plan.cuts.entries()) {
      const keep = speech ? clipKeepToCut(speech, cut) : [cut];
      const key = `${tmpPrefix}/cut-${i + 1}.mp4`;
      await ensureParentDir(key);
      await renderNormalizedScene({ inputPath, outputPath: localPath(key), keep, hasAudio, ...VERTICAL });
      const { durationSeconds: rendered } = await probeMedia(localPath(key));
      cues.push(
        ...buildAssemblyCues([
          {
            offsetSeconds: offset,
            lengthSeconds: Math.min(rendered, totalLength(keep) + 0.1),
            keep,
            segments,
            onScreenText: "",
          },
        ])
      );
      offset += rendered;
      cutPaths.push(localPath(key));
    }
    const [hs, he] = overlayWindow("start", offset);
    const [cs, ce] = overlayWindow("end", offset);
    if (plan.hook) cues.push({ start: hs, end: he, text: plan.hook, top: true });
    if (plan.cta) cues.push({ start: cs, end: ce, text: plan.cta, top: true });
    cues.sort((a, b) => a.start - b.start);

    // 3) Join, burn subtitles + hook/CTA + logo.
    const joinedKey = `${tmpPrefix}/joined.mp4`;
    await concatScenes(cutPaths, localPath(`${tmpPrefix}/list.txt`), localPath(joinedKey));
    const assKey = outKey("subtitles.ass");
    await saveBuffer(
      assKey,
      Buffer.from(cuesToAss(cues, { ...VERTICAL, brandAssColor: hexToAssColor(firstBrandColor(business.brandColors)) }), "utf8")
    );
    const finalKey = outKey("final-9x16.mp4");
    const thumbKey = outKey("thumb.jpg");
    await renderFinal({
      inputPath: localPath(joinedKey),
      outputPath: localPath(finalKey),
      assPath: cues.length > 0 ? localPath(assKey) : null,
      logoPath: business.logoPath ? localPath(business.logoPath) : null,
    });
    await extractThumbnail({ inputPath: localPath(finalKey), outputPath: localPath(thumbKey), atSeconds: 0.5 });
    const { durationSeconds: finalSeconds } = await probeMedia(localPath(finalKey));

    await prisma.$transaction(async (tx) => {
      const version = await tx.videoVersion.create({
        data: {
          videoAssetId: asset.id,
          label: `${EDIT_PROVIDERS[provider].label} · ${EDIT_PLATFORMS[edit.platform].label}`,
          outputPath: finalKey,
          thumbnailPath: thumbKey,
          hook: plan.hook || null,
          cta: plan.cta || null,
          caption: planCaption(plan) || null,
          startSeconds: 0,
          endSeconds: finalSeconds,
        },
      });
      await tx.videoEdit.update({
        where: { id: edit.id },
        data: { status: "ready", errorMessage: null, videoVersionId: version.id },
      });
    });
  } catch (err) {
    const message = shortErrorMessage(err, "Error al editar el video con IA.");
    console.error(`[runAiVideoEdit ${editId}]`, err);
    await prisma.videoEdit
      .update({ where: { id: editId }, data: { status: "error", errorMessage: message } })
      .catch(() => {});
  } finally {
    if (tmpPrefix) await deleteStored(tmpPrefix).catch(() => {});
  }
}
