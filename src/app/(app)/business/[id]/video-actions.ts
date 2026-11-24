"use server";

import { randomUUID } from "crypto";
import path from "path";
import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireBusinessAccess } from "@/lib/dal";
import { audit } from "@/lib/audit";
import { uploadBlockedReason } from "@/lib/usageServer";
import { decryptToken } from "@/lib/crypto";
import { publishPageVideo } from "@/lib/meta";
import { storageKey, saveUpload, readStored } from "@/lib/storage";
import { processVideoAsset, isStalled } from "@/lib/jobs/processVideo";
import { runAiVideoEdit, isEditStalled } from "@/lib/jobs/aiVideoEdit";
import { EDIT_PLATFORMS, EDIT_PROVIDERS, type EditProviderId } from "@/lib/aiVideoEdit";
import { videoEditKeys } from "@/lib/aiCredentials";

const MAX_UPLOAD_BYTES = 500 * 1024 * 1024; // matches serverActions.bodySizeLimit
const ALLOWED_EXTENSIONS = new Set([".mp4", ".mov", ".m4v", ".webm"]);

export type UploadVideoState = {
  error?: string;
};

// Saves the upload and returns right away; the heavy pipeline (transcribe →
// analyze → render) runs in the background — see lib/jobs/processVideo.ts.
export async function uploadAndProcessVideo(
  businessId: string,
  _prevState: UploadVideoState,
  formData: FormData
): Promise<UploadVideoState> {
  const { business } = await requireBusinessAccess(businessId);

  if (!business.aiProvider || !business.aiApiKeyEncrypted) {
    return { error: "Configura tu proveedor de IA antes de editar video." };
  }
  if (!business.openaiTranscriptionKeyEncrypted) {
    return { error: "Configura tu API key de OpenAI para transcripción antes de editar video." };
  }

  const file = formData.get("video");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Selecciona un archivo de video." };
  }
  if (!file.type.startsWith("video/")) {
    return { error: "El archivo debe ser un video." };
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return { error: "El video supera el máximo de 500 MB." };
  }
  const blocked = await uploadBlockedReason(businessId, file.size);
  if (blocked) return { error: blocked };

  const rawExt = path.extname(file.name).toLowerCase();
  const ext = ALLOWED_EXTENSIONS.has(rawExt) ? rawExt : ".mp4";
  const videoAssetId = randomUUID();
  const originalKey = storageKey(businessId, "videos", videoAssetId, `original${ext}`);

  try {
    await saveUpload(originalKey, file);
  } catch (err) {
    console.error("[uploadAndProcessVideo] save failed", err);
    return { error: "No se pudo guardar el video. Intenta de nuevo." };
  }

  await prisma.videoAsset.create({
    data: {
      id: videoAssetId,
      businessId,
      originalFilename: file.name,
      originalPath: originalKey,
      status: "uploaded",
    },
  });

  after(() => processVideoAsset(videoAssetId));

  redirect(`/business/${businessId}/videos/${videoAssetId}`);
}

// Re-runs the pipeline for a video that failed or got stuck (e.g. the server
// restarted mid-job). Safe to repeat: every step overwrites its outputs.
export async function retryVideoProcessing(businessId: string, videoAssetId: string) {
  await requireBusinessAccess(businessId);

  const asset = await prisma.videoAsset.findUnique({ where: { id: videoAssetId } });
  if (!asset || asset.businessId !== businessId) {
    redirect(`/business/${businessId}`);
  }

  if (asset.status === "error" || isStalled(asset)) {
    await prisma.videoAsset.update({
      where: { id: videoAssetId },
      data: { status: "uploaded", errorMessage: null },
    });
    after(() => processVideoAsset(videoAssetId));
  }

  revalidatePath(`/business/${businessId}/videos/${videoAssetId}`);
}

export async function publishVideoVersion(
  businessId: string,
  videoAssetId: string,
  versionId: string,
  formData: FormData
) {
  const { user } = await requireBusinessAccess(businessId);

  const facebookPageId = formData.get("pageId");
  if (typeof facebookPageId !== "string" || facebookPageId.length === 0) {
    redirect(
      `/business/${businessId}/videos/${videoAssetId}?publish_error=${encodeURIComponent(
        "Selecciona una página para publicar."
      )}`
    );
  }

  const [version, page] = await Promise.all([
    prisma.videoVersion.findUnique({
      where: { id: versionId },
      include: { videoAsset: { select: { businessId: true } } },
    }),
    prisma.socialPage.findFirst({
      where: { facebookPageId, connection: { businessId } },
    }),
  ]);

  // Both checks matter: the version must belong to this video AND the video
  // to this business — otherwise another tenant's clip could be published.
  if (!version || version.videoAssetId !== videoAssetId || version.videoAsset.businessId !== businessId) {
    redirect(`/business/${businessId}/videos/${videoAssetId}`);
  }
  if (!page) {
    redirect(
      `/business/${businessId}/videos/${videoAssetId}?publish_error=${encodeURIComponent(
        "No se encontró esa página conectada."
      )}`
    );
  }

  const caption = version.caption ?? [version.hook, version.cta].filter(Boolean).join("\n\n");

  try {
    const videoBuffer = await readStored(version.outputPath);

    const { videoId, permalinkUrl } = await publishPageVideo(
      page.facebookPageId,
      decryptToken(page.pageAccessToken),
      videoBuffer,
      caption
    );

    await prisma.publishedVideo.create({
      data: {
        videoVersionId: versionId,
        facebookPageId: page.facebookPageId,
        pageName: page.name,
        facebookVideoId: videoId,
        permalinkUrl,
        message: caption,
      },
    });
    await audit({
      action: "publish.now",
      actor: user,
      businessId,
      target: versionId,
      details: { platform: "facebook", page: page.name, permalink: permalinkUrl },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al publicar el video en Facebook.";
    redirect(`/business/${businessId}/videos/${videoAssetId}?publish_error=${encodeURIComponent(message)}`);
  }

  redirect(`/business/${businessId}/videos/${videoAssetId}`);
}

export type AiEditState = { error?: string };

// "Editar con IA": queues a new edit of an uploaded video with the chosen AI
// for one network; lib/jobs/aiVideoEdit.ts renders it into a new version.
export async function startAiVideoEdit(
  businessId: string,
  videoAssetId: string,
  _prev: AiEditState,
  formData: FormData
): Promise<AiEditState> {
  const { user, business } = await requireBusinessAccess(businessId);

  const provider = String(formData.get("provider") ?? "") as EditProviderId;
  const platform = String(formData.get("platform") ?? "");
  const instructions = String(formData.get("instructions") ?? "").trim().slice(0, 1000) || null;
  const removeSilences = formData.get("removeSilences") === "on";
  if (!(provider in EDIT_PROVIDERS)) return { error: "Elige con qué IA editar." };
  if (!(platform in EDIT_PLATFORMS)) return { error: "Elige la red donde lo vas a publicar." };
  if (!videoEditKeys(business)[provider]) {
    return { error: `Falta la key de ${EDIT_PROVIDERS[provider].label}. Configúrala en Ajustes.` };
  }

  const asset = await prisma.videoAsset.findUnique({
    where: { id: videoAssetId },
    include: { aiEdits: { where: { status: { in: ["planning", "rendering"] } } } },
  });
  if (!asset || asset.businessId !== businessId) return { error: "Video no encontrado." };
  if (asset.status !== "ready") return { error: "Espera a que termine el procesamiento del video." };
  if (asset.originalDeletedAt) return { error: "El video original ya se borró; vuelve a subirlo para editarlo." };
  // One edit at a time per video: renders are heavy on a small server.
  if (asset.aiEdits.some((e) => !isEditStalled(e))) return { error: "Ya hay una edición en curso para este video." };

  const edit = await prisma.videoEdit.create({
    data: {
      videoAssetId,
      provider,
      model: EDIT_PROVIDERS[provider].model,
      platform,
      instructions,
      removeSilences,
    },
  });
  // Bumping updatedAt also restarts the original's retention clock
  // (lib/jobs/storageCleanup.ts) while the owner keeps editing.
  await prisma.videoAsset.update({ where: { id: videoAssetId }, data: { updatedAt: new Date() } });
  await audit({
    action: "video.ai_edit",
    actor: user,
    businessId,
    target: videoAssetId,
    details: { provider, platform },
  });

  after(() => runAiVideoEdit(edit.id));
  revalidatePath(`/business/${businessId}/videos/${videoAssetId}`);
  return {};
}

export async function discardAiVideoEdit(businessId: string, videoAssetId: string, editId: string) {
  await requireBusinessAccess(businessId);
  const edit = await prisma.videoEdit.findUnique({ where: { id: editId }, include: { videoAsset: true } });
  if (edit && edit.videoAsset.businessId === businessId && (edit.status === "error" || isEditStalled(edit))) {
    await prisma.videoEdit.delete({ where: { id: editId } });
  }
  revalidatePath(`/business/${businessId}/videos/${videoAssetId}`);
}
