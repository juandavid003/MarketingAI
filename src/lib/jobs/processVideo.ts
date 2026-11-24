import "server-only";
import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/crypto";
import { analyzeVideoTranscript, type AiProvider } from "@/lib/ai";
import { toAiBusiness } from "@/lib/businessContext";
import { transcribeVideo, generateSrt } from "@/lib/whisper";
import { getDurationSeconds, extractAudio, renderVerticalClip, extractThumbnail } from "@/lib/video";
import { storageKey, localPath, saveBuffer } from "@/lib/storage";

// Background video pipeline: transcribe → analyze → render clip + thumbnail.
//
// Scheduled with next/server's after() from the upload action, so the upload
// request returns immediately and this runs in the same Node process
// afterwards. State lives in VideoAsset.status, which the video page polls.
//
// Known limit (see docs/TECHNICAL_ARCHITECTURE.md §7): a server restart mid-
// job leaves the asset in an intermediate status. isStalled() detects that
// and the page offers "Reintentar", which re-runs this from the original —
// every step overwrites its outputs, so a re-run is safe.

export const IN_PROGRESS_STATUSES = ["uploaded", "transcribing", "analyzing", "rendering"] as const;
const STALL_AFTER_MS = 30 * 60 * 1000;

export function isStalled(asset: { status: string; updatedAt: Date }): boolean {
  return (
    (IN_PROGRESS_STATUSES as readonly string[]).includes(asset.status) &&
    Date.now() - asset.updatedAt.getTime() > STALL_AFTER_MS
  );
}

export async function processVideoAsset(videoAssetId: string): Promise<void> {
  // Claim the job atomically so a double-submit or a retry racing an old run
  // can't process the same asset twice.
  const claimed = await prisma.videoAsset.updateMany({
    where: { id: videoAssetId, status: "uploaded" },
    data: { status: "transcribing", errorMessage: null },
  });
  if (claimed.count === 0) return;

  try {
    const asset = await prisma.videoAsset.findUniqueOrThrow({
      where: { id: videoAssetId },
      include: { business: { include: { products: true } } },
    });
    const { business } = asset;

    if (!business.aiProvider || !business.aiApiKeyEncrypted) {
      throw new Error("Configura tu proveedor de IA antes de editar video.");
    }
    if (!business.openaiTranscriptionKeyEncrypted) {
      throw new Error("Configura tu API key de OpenAI para transcripción antes de editar video.");
    }

    const originalDiskPath = localPath(asset.originalPath);
    const assetKey = (name: string) => storageKey(business.id, "videos", asset.id, name);

    const durationSeconds = await getDurationSeconds(originalDiskPath);
    await prisma.videoAsset.update({ where: { id: asset.id }, data: { durationSeconds } });

    const audioKey = assetKey("audio.mp3");
    await extractAudio(originalDiskPath, localPath(audioKey));
    const transcript = await transcribeVideo(
      decryptSecret(business.openaiTranscriptionKeyEncrypted),
      localPath(audioKey)
    );

    await prisma.videoAsset.update({
      where: { id: asset.id },
      data: { transcript: JSON.stringify(transcript), status: "analyzing" },
    });

    const { content: analysis } = await analyzeVideoTranscript({
      provider: business.aiProvider as AiProvider,
      apiKey: decryptSecret(business.aiApiKeyEncrypted),
      model: business.aiModel,
      business: toAiBusiness(business),
      transcriptSegments: transcript.segments,
      totalDurationSeconds: durationSeconds,
    });

    await prisma.videoAsset.update({ where: { id: asset.id }, data: { status: "rendering" } });

    const srtKey = assetKey("clip.srt");
    await saveBuffer(srtKey, Buffer.from(generateSrt(transcript.segments, analysis.startSeconds), "utf8"));

    const outputKey = assetKey("version-1.mp4");
    await renderVerticalClip({
      inputPath: originalDiskPath,
      outputPath: localPath(outputKey),
      startSeconds: analysis.startSeconds,
      endSeconds: analysis.endSeconds,
      srtPath: localPath(srtKey),
    });

    const thumbnailKey = assetKey("thumbnail.jpg");
    await extractThumbnail({
      inputPath: localPath(outputKey),
      outputPath: localPath(thumbnailKey),
      atSeconds: Math.min(1, analysis.endSeconds - analysis.startSeconds),
    });

    await prisma.$transaction([
      // A retry after a crash between these two writes must not duplicate.
      // Only the automatic version: "Editar con IA" versions stay.
      prisma.videoVersion.deleteMany({
        where: { videoAssetId: asset.id, label: "Versión 1", publishedVideos: { none: {} } },
      }),
      prisma.videoVersion.create({
        data: {
          videoAssetId: asset.id,
          label: "Versión 1",
          outputPath: outputKey,
          thumbnailPath: thumbnailKey,
          hook: analysis.hook,
          cta: analysis.cta,
          startSeconds: analysis.startSeconds,
          endSeconds: analysis.endSeconds,
        },
      }),
      prisma.videoAsset.update({ where: { id: asset.id }, data: { status: "ready" } }),
    ]);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido al procesar el video.";
    console.error(`[processVideoAsset ${videoAssetId}]`, err);
    await prisma.videoAsset
      .update({ where: { id: videoAssetId }, data: { status: "error", errorMessage: message } })
      .catch(() => {});
  }
}
