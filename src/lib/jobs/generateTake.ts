import "server-only";
import { prisma } from "@/lib/prisma";
import { shortErrorMessage } from "@/lib/errors";
import { saveBuffer, deleteStored } from "@/lib/storage";
import { uploadBlockedReason } from "@/lib/usageServer";
import { businessVideoAi } from "@/lib/videoGen/credentials";
import { VideoGenError } from "@/lib/videoGen";
import { wholeScriptScene, FULL_TAKE_SLOT, type GeneratedContentPiece } from "@/lib/contentAi";
import { processSceneTake } from "@/lib/jobs/processTake";

// Background job (after()) for a scene the owner asked the AI to generate
// instead of recording: prompt → provider → mp4 saved as the take's
// original → the same processing as an uploaded take (silences,
// transcript, review), so assembly, creatives and publishing don't need to
// know where the clip came from.

const GENERATION_TIMEOUT_MS = 15 * 60 * 1000;

export async function generateSceneTake(takeId: string): Promise<void> {
  try {
    const take = await prisma.sceneTake.findUniqueOrThrow({
      where: { id: takeId },
      include: { contentPiece: { include: { business: true } } },
    });
    if (take.status !== "generating" || take.source !== "ai" || !take.aiPrompt) return;
    const piece = take.contentPiece;
    const business = piece.business;

    const ai = businessVideoAi(business);
    if (!ai) throw new VideoGenError("Configura un proveedor de video con IA en Negocio → Inteligencia artificial.");

    const content = JSON.parse(piece.content) as GeneratedContentPiece;
    const scene =
      take.slot === FULL_TAKE_SLOT ? wholeScriptScene(content) : content.escenas.find((s) => s.numero === take.sceneNumber);
    if (!scene) throw new VideoGenError("Esta escena ya no existe en el guion.");

    const result = await ai.provider.generate(
      {
        prompt: take.aiPrompt,
        aspectRatio: "9:16",
        durationSeconds: ai.provider.clampDuration(scene.duracionSegundos, ai.model),
        generateAudio: true,
      },
      { apiKey: ai.apiKey, model: ai.model, signal: AbortSignal.timeout(GENERATION_TIMEOUT_MS) }
    );

    const blocked = await uploadBlockedReason(business.id, result.data.length);
    if (blocked) throw new VideoGenError(blocked);
    await saveBuffer(take.originalPath, result.data);

    // Hand over to the normal take pipeline (it claims "uploaded").
    const handed = await prisma.sceneTake.updateMany({
      where: { id: takeId, status: "generating" },
      data: { status: "uploaded", errorMessage: null, aiModel: `${ai.provider.id}:${ai.model}` },
    });
    if (handed.count > 0) {
      await processSceneTake(takeId);
    } else {
      // Replaced by an upload while generating: this clip is an orphan.
      await deleteStored(take.originalPath).catch(() => {});
    }
  } catch (err) {
    const message =
      err instanceof VideoGenError ? err.message : shortErrorMessage(err, "No se pudo generar la escena con IA.");
    console.error(`[generateSceneTake ${takeId}]`, err);
    await prisma.sceneTake
      .updateMany({ where: { id: takeId, status: "generating" }, data: { status: "error", errorMessage: message } })
      .catch(() => {});
  }
}
