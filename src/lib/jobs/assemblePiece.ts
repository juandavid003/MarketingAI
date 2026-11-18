import "server-only";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { shortErrorMessage } from "@/lib/errors";
import { pieceCaption, FULL_TAKE_SLOT, type GeneratedContentPiece, type RecordingSource } from "@/lib/contentAi";
import type { Transcript } from "@/lib/whisper";
import { extractThumbnail } from "@/lib/video";
import {
  renderNormalizedScene,
  concatScenes,
  renderFinal,
  buildAssemblyCues,
  cuesToAss,
  hexToAssColor,
  firstBrandColor,
  probeMedia,
  totalLength,
  overlayWindow,
  type Cue,
  type Interval,
  type OverlayAt,
} from "@/lib/videoEdit";
import { storageKey, localPath, ensureParentDir, saveBuffer, deleteStored } from "@/lib/storage";

// Assembles the final video for a ContentPiece, from either
//   - "scenes": one take per scene, in script order, each with its own
//     on-screen text; or
//   - "full": the whole script recorded in one take, with the hook on screen
//     at the start and the CTA at the end.
// Silences are cut, everything is normalized to 1080x1920, concatenated, and
// rendered as 9:16 (Reels/TikTok/Shorts) and 4:5 (feed) with subtitles.
//
// The result is a regular VideoAsset (contentPieceId set) with two
// VideoVersions, so download and publishing reuse the existing video page.

export const ASSEMBLY_STALL_AFTER_MS = 30 * 60 * 1000;

export function isAssemblyStalled(piece: { assemblyStatus: string; updatedAt: Date }): boolean {
  return piece.assemblyStatus === "assembling" && Date.now() - piece.updatedAt.getTime() > ASSEMBLY_STALL_AFTER_MS;
}

const VERTICAL = { width: 1080, height: 1920 };
const FEED = { width: 1080, height: 1350 };

type Segment = {
  take: {
    originalPath: string;
    durationSeconds: number | null;
    hasAudio: boolean | null;
    keepIntervals: string | null;
    transcript: string | null;
  };
  overlays: { text: string; at: OverlayAt }[];
};

export async function assembleContentPiece(pieceId: string, source: RecordingSource = "scenes"): Promise<void> {
  // Claimed by the action (assemblyStatus → "assembling") before scheduling.
  const workKey = (biz: string, run: string, name: string) => storageKey(biz, "pieces", pieceId, "renders", run, name);
  let tmpPrefix: string | null = null;

  try {
    const piece = await prisma.contentPiece.findUniqueOrThrow({
      where: { id: pieceId },
      include: { takes: true, business: true },
    });
    const content = JSON.parse(piece.content) as GeneratedContentPiece;
    const cta = content.ctas[0] ?? null;

    let segments: Segment[];
    if (source === "full") {
      const full = piece.takes.find((t) => t.slot === FULL_TAKE_SLOT && t.status === "ready");
      if (!full) throw new Error("Falta el video completo listo.");
      segments = [
        {
          take: full,
          overlays: [
            { text: content.escenas[0]?.textoPantalla || content.hook, at: "start" },
            { text: cta ?? "", at: "end" },
          ],
        },
      ];
    } else {
      const takeByScene = new Map(piece.takes.filter((t) => t.slot === "main").map((t) => [t.sceneNumber, t]));
      const missing = content.escenas.filter((s) => takeByScene.get(s.numero)?.status !== "ready");
      if (missing.length > 0) {
        throw new Error(`Faltan tomas listas para: ${missing.map((s) => `escena ${s.numero}`).join(", ")}.`);
      }
      segments = content.escenas.map((scene) => ({
        take: takeByScene.get(scene.numero)!,
        overlays: [{ text: scene.textoPantalla || (scene.numero === 1 ? content.hook : ""), at: "whole" as const }],
      }));
    }

    const runId = randomUUID().slice(0, 8);
    const biz = piece.businessId;
    tmpPrefix = storageKey(biz, "pieces", pieceId, "renders", runId, "tmp");

    // 1) Normalize every segment (cut silences, same size/fps/audio) and
    //    build its cues on the joined timeline.
    const segmentPaths: string[] = [];
    const cues: Cue[] = [];
    let offset = 0;
    for (const [i, segment] of segments.entries()) {
      const { take } = segment;
      const keep = JSON.parse(take.keepIntervals ?? "null") as Interval[] | null;
      const intervals = keep && keep.length > 0 ? keep : [[0, take.durationSeconds ?? 0] as Interval];
      const outKey = `${tmpPrefix}/segment-${i + 1}.mp4`;
      await ensureParentDir(outKey);
      await renderNormalizedScene({
        inputPath: localPath(take.originalPath),
        outputPath: localPath(outKey),
        keep: intervals,
        hasAudio: take.hasAudio ?? false,
        ...VERTICAL,
      });
      // Measure the rendered segment: frame rounding makes it differ slightly
      // from the interval math, and subtitles must line up with reality.
      const { durationSeconds: rendered } = await probeMedia(localPath(outKey));
      const length = Math.min(rendered, totalLength(intervals) + 0.1);
      const transcript = take.transcript ? (JSON.parse(take.transcript) as Transcript) : null;
      cues.push(
        ...buildAssemblyCues([
          { offsetSeconds: offset, lengthSeconds: length, keep: intervals, segments: transcript?.segments ?? [], onScreenText: "" },
        ])
      );
      for (const o of segment.overlays) {
        if (!o.text.trim()) continue;
        const [start, end] = overlayWindow(o.at, length);
        cues.push({ start: offset + start, end: offset + end, text: o.text.trim(), top: true });
      }
      offset += rendered;
      segmentPaths.push(localPath(outKey));
    }
    cues.sort((a, b) => a.start - b.start);

    // 2) Concatenate.
    const joinedKey = `${tmpPrefix}/joined.mp4`;
    await concatScenes(segmentPaths, localPath(`${tmpPrefix}/list.txt`), localPath(joinedKey));

    // 3) Subtitles + on-screen text, then one render per aspect ratio.
    const brandAssColor = hexToAssColor(firstBrandColor(piece.business.brandColors));
    const assFor = async (size: { width: number; height: number }, name: string) => {
      if (cues.length === 0) return null;
      const key = workKey(biz, runId, name);
      await saveBuffer(key, Buffer.from(cuesToAss(cues, { ...size, brandAssColor }), "utf8"));
      return localPath(key);
    };

    const verticalKey = workKey(biz, runId, "final-9x16.mp4");
    const feedKey = workKey(biz, runId, "final-4x5.mp4");
    await renderFinal({
      inputPath: localPath(joinedKey),
      outputPath: localPath(verticalKey),
      assPath: await assFor(VERTICAL, "subtitles-9x16.ass"),
    });
    await renderFinal({
      inputPath: localPath(joinedKey),
      outputPath: localPath(feedKey),
      assPath: await assFor(FEED, "subtitles-4x5.ass"),
      crop: FEED,
    });

    const verticalThumb = workKey(biz, runId, "thumb-9x16.jpg");
    const feedThumb = workKey(biz, runId, "thumb-4x5.jpg");
    await extractThumbnail({ inputPath: localPath(verticalKey), outputPath: localPath(verticalThumb), atSeconds: 0.5 });
    await extractThumbnail({ inputPath: localPath(feedKey), outputPath: localPath(feedThumb), atSeconds: 0.5 });

    const { durationSeconds } = await probeMedia(localPath(verticalKey));
    const caption = pieceCaption(content);

    await prisma.$transaction(async (tx) => {
      await tx.videoAsset.create({
        data: {
          businessId: biz,
          contentPieceId: pieceId,
          originalFilename: `${source === "full" ? "Video completo editado" : "Video armado"} — ${content.titulo}`,
          originalPath: verticalKey,
          durationSeconds,
          status: "ready",
          versions: {
            create: [
              {
                label: "Vertical 9:16 (Reels, TikTok, Shorts)",
                outputPath: verticalKey,
                thumbnailPath: verticalThumb,
                hook: content.hook,
                cta,
                caption,
                startSeconds: 0,
                endSeconds: durationSeconds,
              },
              {
                label: "Feed 4:5 (Instagram, Facebook)",
                outputPath: feedKey,
                thumbnailPath: feedThumb,
                hook: content.hook,
                cta,
                caption,
                startSeconds: 0,
                endSeconds: durationSeconds,
              },
            ],
          },
        },
      });
      await tx.contentPiece.update({
        where: { id: pieceId },
        data: { assemblyStatus: "ready", assemblyError: null },
      });
    });
  } catch (err) {
    const message = shortErrorMessage(err, "Error al armar el video.");
    console.error(`[assembleContentPiece ${pieceId}]`, err);
    await prisma.contentPiece
      .update({ where: { id: pieceId }, data: { assemblyStatus: "error", assemblyError: message } })
      .catch(() => {});
  } finally {
    // Intermediate renders are big and never served.
    if (tmpPrefix) await deleteStored(tmpPrefix).catch(() => {});
  }
}
