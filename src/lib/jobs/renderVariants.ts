import "server-only";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { shortErrorMessage } from "@/lib/errors";
import { FULL_TAKE_SCENE, FULL_TAKE_SLOT, type GeneratedContentPiece } from "@/lib/contentAi";
import { parseStrategy, variantCaption, type DistributionStrategy } from "@/lib/distribution";
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

// Renders the queued CreativeVariants of a ContentPiece: the same body with a
// different opening (scene 1: on-screen hook, and the alternative recorded
// opening when there is one) and closing (last scene: on-screen CTA).
//
// Only what changes is re-encoded. Each scene is rendered on its own with its
// own subtitles, then scenes are concatenated without re-encoding — so the
// middle scenes are rendered once per aspect ratio for all creatives, and
// each extra creative only costs its first and last scene.
//
// Runs in the background (after()); the action claims variantsStatus first.
// Loops until no variant is queued, so variants queued meanwhile are picked up.

export const VARIANTS_STALL_AFTER_MS = 30 * 60 * 1000;

export function areVariantsStalled(variants: { renderStatus: string; updatedAt: Date }[]): boolean {
  const active = variants.filter((v) => ["queued", "rendering"].includes(v.renderStatus));
  return active.length > 0 && active.every((v) => Date.now() - v.updatedAt.getTime() > VARIANTS_STALL_AFTER_MS);
}

const ASPECTS = [
  { id: "9x16", width: 1080, height: 1920, crop: undefined, label: "Vertical 9:16 (Reels, TikTok, Shorts)" },
  { id: "4x5", width: 1080, height: 1350, crop: { width: 1080, height: 1350 }, label: "Feed 4:5 (Instagram, Facebook)" },
] as const;

type TakeRow = {
  id: string;
  originalPath: string;
  durationSeconds: number | null;
  hasAudio: boolean | null;
  keepIntervals: string | null;
  transcript: string | null;
};

type Normalized = { path: string; length: number; keep: Interval[]; segments: Transcript["segments"] };

export async function renderPieceVariants(pieceId: string): Promise<void> {
  const runId = randomUUID().slice(0, 8);
  let tmpPrefix: string | null = null;
  try {
    for (;;) {
      const piece = await prisma.contentPiece.findUniqueOrThrow({
        where: { id: pieceId },
        include: { takes: true, business: true },
      });
      tmpPrefix = storageKey(piece.businessId, "pieces", pieceId, "variants", runId, "tmp");
      const ctx = new RenderContext(piece, tmpPrefix, runId);

      for (;;) {
        const next = await prisma.creativeVariant.findFirst({
          where: { contentPieceId: pieceId, renderStatus: "queued" },
          orderBy: { updatedAt: "asc" },
        });
        if (!next) break;
        const claimed = await prisma.creativeVariant.updateMany({
          where: { id: next.id, renderStatus: "queued" },
          data: { renderStatus: "rendering", renderError: null },
        });
        if (claimed.count === 0) continue;
        try {
          await ctx.render(next.code, next.hookCode, next.ctaCode);
          await prisma.creativeVariant.update({ where: { id: next.id }, data: { renderStatus: "ready" } });
        } catch (err) {
          console.error(`[renderPieceVariants ${pieceId} ${next.code}]`, err);
          await prisma.creativeVariant.update({
            where: { id: next.id },
            data: { renderStatus: "error", renderError: shortErrorMessage(err, "Error al generar el creativo.") },
          });
        }
      }

      await prisma.contentPiece.update({ where: { id: pieceId }, data: { variantsStatus: "idle" } });
      // Something queued between the last check and going idle? Claim again.
      const pending = await prisma.creativeVariant.count({ where: { contentPieceId: pieceId, renderStatus: "queued" } });
      if (pending === 0) break;
      const reclaimed = await prisma.contentPiece.updateMany({
        where: { id: pieceId, variantsStatus: "idle" },
        data: { variantsStatus: "rendering" },
      });
      if (reclaimed.count === 0) break;
    }
  } catch (err) {
    console.error(`[renderPieceVariants ${pieceId}]`, err);
    await prisma.creativeVariant
      .updateMany({
        where: { contentPieceId: pieceId, renderStatus: { in: ["queued", "rendering"] } },
        data: { renderStatus: "error", renderError: shortErrorMessage(err, "Error al generar los creativos.") },
      })
      .catch(() => {});
    await prisma.contentPiece.update({ where: { id: pieceId }, data: { variantsStatus: "idle" } }).catch(() => {});
  } finally {
    if (tmpPrefix) await deleteStored(tmpPrefix).catch(() => {});
  }
}

class RenderContext {
  private content: GeneratedContentPiece;
  private strategy: DistributionStrategy;
  private normalized = new Map<string, Promise<Normalized>>();
  private finals = new Map<string, Promise<string>>();
  private brandAssColor: string | null;

  constructor(
    private piece: {
      id: string;
      businessId: string;
      content: string;
      strategy: string | null;
      takes: (TakeRow & { sceneNumber: number; slot: string; status: string })[];
      business: { brandColors: string | null };
    },
    private tmpPrefix: string,
    private runId: string
  ) {
    this.content = JSON.parse(piece.content) as GeneratedContentPiece;
    const strategy = parseStrategy(piece.strategy);
    if (!strategy) throw new Error("Esta pieza no tiene plan de distribución.");
    this.strategy = strategy;
    this.brandAssColor = hexToAssColor(firstBrandColor(piece.business.brandColors));
  }

  private take(sceneNumber: number, slot: string) {
    return this.piece.takes.find((t) => t.sceneNumber === sceneNumber && t.slot === slot && t.status === "ready");
  }

  // Cut silences + normalize to 1080x1920, once per take for the whole run.
  private normalize(take: TakeRow): Promise<Normalized> {
    let job = this.normalized.get(take.id);
    if (!job) {
      job = (async () => {
        const keepRaw = JSON.parse(take.keepIntervals ?? "null") as Interval[] | null;
        const keep = keepRaw && keepRaw.length > 0 ? keepRaw : [[0, take.durationSeconds ?? 0] as Interval];
        const key = `${this.tmpPrefix}/norm-${take.id}.mp4`;
        await ensureParentDir(key);
        await renderNormalizedScene({
          inputPath: localPath(take.originalPath),
          outputPath: localPath(key),
          keep,
          hasAudio: take.hasAudio ?? false,
          width: 1080,
          height: 1920,
        });
        const { durationSeconds } = await probeMedia(localPath(key));
        const transcript = take.transcript ? (JSON.parse(take.transcript) as Transcript) : null;
        return {
          path: localPath(key),
          length: Math.min(durationSeconds, totalLength(keep) + 0.1),
          keep,
          segments: transcript?.segments ?? [],
        };
      })();
      this.normalized.set(take.id, job);
    }
    return job;
  }

  // One scene, one aspect ratio, with its subtitles and overlay texts.
  // Cached by everything that affects the pixels.
  private sceneFinal(
    take: TakeRow,
    overlays: { text: string; at: OverlayAt }[],
    aspect: (typeof ASPECTS)[number]
  ): Promise<string> {
    const cacheKey = JSON.stringify([take.id, overlays, aspect.id]);
    let job = this.finals.get(cacheKey);
    if (!job) {
      const n = this.finals.size;
      job = (async () => {
        const norm = await this.normalize(take);
        const cues: Cue[] = buildAssemblyCues([
          { offsetSeconds: 0, lengthSeconds: norm.length, keep: norm.keep, segments: norm.segments, onScreenText: "" },
        ]);
        // Hook and CTA sharing one take go at its start and end.
        for (const o of overlays) {
          if (!o.text.trim()) continue;
          const [start, end] = overlayWindow(o.at, norm.length);
          cues.push({ start, end, text: o.text.trim(), top: true });
        }
        cues.sort((a, b) => a.start - b.start);

        const base = `${this.tmpPrefix}/final-${n}-${aspect.id}`;
        let assPath: string | null = null;
        if (cues.length > 0) {
          await saveBuffer(`${base}.ass`, Buffer.from(cuesToAss(cues, { ...aspect, brandAssColor: this.brandAssColor }), "utf8"));
          assPath = localPath(`${base}.ass`);
        }
        await renderFinal({ inputPath: norm.path, outputPath: localPath(`${base}.mp4`), assPath, crop: aspect.crop });
        return localPath(`${base}.mp4`);
      })();
      this.finals.set(cacheKey, job);
    }
    return job;
  }

  // The takes to join and their overlays: scene takes when every scene has
  // one (scene 1 may be replaced by the hook's recorded opening), else the
  // whole-script take with the hook at its start and the CTA at its end.
  private segmentsFor(
    hook: { codigo: string; texto: string; original: boolean },
    cta: { texto: string }
  ): { take: TakeRow; overlays: { text: string; at: OverlayAt }[] }[] {
    const scenes = this.content.escenas;
    const missing = scenes.filter((s) => !this.take(s.numero, "main"));
    if (missing.length === 0) {
      const last = scenes.length - 1;
      const opening = (!hook.original && this.take(1, `hook:${hook.codigo}`)) || this.take(1, "main")!;
      return scenes.map((scene, i) => ({
        take: i === 0 ? opening : this.take(scene.numero, "main")!,
        overlays:
          scenes.length === 1
            ? [
                { text: hook.texto, at: "start" as const },
                { text: cta.texto, at: "end" as const },
              ]
            : i === 0
              ? [{ text: hook.texto, at: "whole" as const }]
              : i === last
                ? [{ text: cta.texto, at: "whole" as const }]
                : [{ text: scene.textoPantalla, at: "whole" as const }],
      }));
    }
    const full = this.take(FULL_TAKE_SCENE, FULL_TAKE_SLOT);
    if (full) {
      return [
        {
          take: full,
          overlays: [
            { text: hook.texto, at: "start" },
            { text: cta.texto, at: "end" },
          ],
        },
      ];
    }
    throw new Error(`Faltan tomas listas para: ${missing.map((s) => `escena ${s.numero}`).join(", ")}.`);
  }

  async render(code: string, hookCode: string, ctaCode: string): Promise<void> {
    const hook = this.strategy.hooks.find((h) => h.codigo === hookCode);
    const cta = this.strategy.ctas.find((c) => c.codigo === ctaCode);
    if (!hook || !cta) throw new Error("Ese hook o CTA ya no existe en el plan.");

    const plan = this.segmentsFor(hook, cta);

    const outputs: { aspect: (typeof ASPECTS)[number]; key: string; thumb: string }[] = [];
    for (const aspect of ASPECTS) {
      const parts: string[] = [];
      for (const { take, overlays } of plan) {
        parts.push(await this.sceneFinal(take, overlays, aspect));
      }
      const key = storageKey(this.piece.businessId, "pieces", this.piece.id, "variants", this.runId, `${code}-${aspect.id}.mp4`);
      const thumb = storageKey(this.piece.businessId, "pieces", this.piece.id, "variants", this.runId, `${code}-${aspect.id}.jpg`);
      await ensureParentDir(key);
      await concatScenes(parts, localPath(`${this.tmpPrefix}/list-${code}-${aspect.id}.txt`), localPath(key));
      await extractThumbnail({ inputPath: localPath(key), outputPath: localPath(thumb), atSeconds: 0.5 });
      outputs.push({ aspect, key, thumb });
    }

    const { durationSeconds } = await probeMedia(localPath(outputs[0].key));
    const caption = variantCaption(this.content, cta.texto);
    await prisma.videoAsset.create({
      data: {
        businessId: this.piece.businessId,
        contentPieceId: this.piece.id,
        variantCode: code,
        originalFilename: `Creativo ${code} — ${this.content.titulo}`,
        originalPath: outputs[0].key,
        durationSeconds,
        status: "ready",
        versions: {
          create: outputs.map((o) => ({
            label: `${code} · ${o.aspect.label}`,
            outputPath: o.key,
            thumbnailPath: o.thumb,
            hook: hook.texto,
            cta: cta.texto,
            caption,
            startSeconds: 0,
            endSeconds: durationSeconds,
          })),
        },
      },
    });
  }
}
