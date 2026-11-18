import "server-only";
import { prisma } from "@/lib/prisma";
import { shortErrorMessage } from "@/lib/errors";
import { toAiBusiness } from "@/lib/businessContext";
import { businessAi, transcriptionKey } from "@/lib/aiCredentials";
import { reviewTakeWithAi, type GeneratedContentPiece } from "@/lib/contentAi";
import { ruleBasedReview, type TakeReview } from "@/lib/takeReview";
import { transcribeVideo, type Transcript } from "@/lib/whisper";
import { extractAudio } from "@/lib/video";
import { probeMedia, detectSilences, keepIntervalsFromSilences, totalLength, type Interval } from "@/lib/videoEdit";
import { localPath, siblingKey } from "@/lib/storage";

// Background job for one uploaded scene take (scheduled with after()):
//   probe → find silences → transcribe (if a Whisper key exists) → review.
// The take ends "ready" with a verdict; it never blocks the owner from
// assembling — a "rerecord" verdict is advice, shown with its reasons.

export const TAKE_STALL_AFTER_MS = 20 * 60 * 1000;

export function isTakeStalled(take: { status: string; updatedAt: Date }): boolean {
  return (
    ["uploaded", "processing"].includes(take.status) && Date.now() - take.updatedAt.getTime() > TAKE_STALL_AFTER_MS
  );
}

export async function processSceneTake(takeId: string): Promise<void> {
  const claimed = await prisma.sceneTake.updateMany({
    where: { id: takeId, status: "uploaded" },
    data: { status: "processing", errorMessage: null },
  });
  if (claimed.count === 0) return;

  try {
    const take = await prisma.sceneTake.findUniqueOrThrow({
      where: { id: takeId },
      include: { contentPiece: { include: { business: { include: { products: true } } } } },
    });
    const piece = take.contentPiece;
    const business = piece.business;
    const content = JSON.parse(piece.content) as GeneratedContentPiece;
    const scene = content.escenas.find((s) => s.numero === take.sceneNumber);
    if (!scene) throw new Error("Esta escena ya no existe en el guion.");

    const originalDisk = localPath(take.originalPath);
    const { durationSeconds, hasAudio } = await probeMedia(originalDisk);

    let keep: Interval[] = [[0, durationSeconds]];
    let speechSeconds = 0;
    if (hasAudio) {
      const silences = await detectSilences(originalDisk, durationSeconds);
      speechSeconds = Math.max(0, durationSeconds - totalLength(silences));
      keep = keepIntervalsFromSilences(silences, durationSeconds);
    }
    const keptSeconds = totalLength(keep);

    // Transcript drives subtitles and the audio review. Optional: without a
    // Whisper key the video still assembles, just without subtitles.
    let transcript: Transcript | null = null;
    const whisperKey = transcriptionKey(business);
    if (hasAudio && speechSeconds >= 0.5 && whisperKey) {
      const audioKey = siblingKey(take.originalPath, "audio.mp3");
      await extractAudio(originalDisk, localPath(audioKey));
      transcript = await transcribeVideo(whisperKey, localPath(audioKey));
    }

    let review: TakeReview = ruleBasedReview({ scene, hasAudio, takeSeconds: durationSeconds, keptSeconds, speechSeconds });

    const ai = businessAi(business);
    if (ai && transcript && scene.queDecir.trim() && review.verdict === "ok") {
      try {
        const aiReview = await reviewTakeWithAi(ai, toAiBusiness(business), {
          scene,
          transcriptText: transcript.text,
          takeSeconds: durationSeconds,
          speechSeconds,
        });
        review = {
          ...review,
          verdict: aiReview.veredicto === "regrabar" ? "rerecord" : "ok",
          reasons: aiReview.veredicto === "regrabar" ? aiReview.motivos : [],
          notes: aiReview.veredicto === "ok" ? [...review.notes, ...aiReview.motivos] : review.notes,
          tip: aiReview.consejo,
          checkedBy: "rules+audio_ai",
        };
      } catch (err) {
        // The AI check is a bonus; a failure here must not fail the take.
        console.error(`[processSceneTake ${takeId}] AI review failed`, err);
      }
    }

    await prisma.sceneTake.update({
      where: { id: takeId },
      data: {
        status: "ready",
        durationSeconds,
        hasAudio,
        keepIntervals: JSON.stringify(keep),
        transcript: transcript ? JSON.stringify(transcript) : null,
        review: JSON.stringify(review),
      },
    });
  } catch (err) {
    const message = shortErrorMessage(err, "Error al procesar la toma.");
    console.error(`[processSceneTake ${takeId}]`, err);
    await prisma.sceneTake
      .update({ where: { id: takeId }, data: { status: "error", errorMessage: message } })
      .catch(() => {});
  }
}
