"use server";

import { randomUUID } from "crypto";
import { mkdir, writeFile, readFile } from "fs/promises";
import path from "path";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireBusinessAccess } from "@/lib/dal";
import { decryptSecret } from "@/lib/crypto";
import { analyzeVideoTranscript, type AiProvider } from "@/lib/ai";
import { transcribeVideo, generateSrt } from "@/lib/whisper";
import { getDurationSeconds, extractAudio, renderVerticalClip, extractThumbnail } from "@/lib/video";
import { publishPageVideo } from "@/lib/meta";

const UPLOADS_ROOT = path.join(process.cwd(), "public", "uploads");

export type UploadVideoState = {
  error?: string;
};

export async function uploadAndProcessVideo(
  businessId: string,
  _prevState: UploadVideoState,
  formData: FormData
): Promise<UploadVideoState> {
  await requireBusinessAccess(businessId);

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    include: { products: true },
  });
  if (!business) {
    return { error: "Negocio no encontrado." };
  }
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

  const videoAssetId = randomUUID();
  const dir = path.join(UPLOADS_ROOT, businessId, videoAssetId);
  await mkdir(dir, { recursive: true });

  const ext = path.extname(file.name) || ".mp4";
  const originalDiskPath = path.join(dir, `original${ext}`);
  const originalPublicPath = `/uploads/${businessId}/${videoAssetId}/original${ext}`;

  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(originalDiskPath, buffer);

  await prisma.videoAsset.create({
    data: {
      id: videoAssetId,
      businessId,
      originalFilename: file.name,
      originalPath: originalPublicPath,
      status: "uploaded",
    },
  });

  try {
    const durationSeconds = await getDurationSeconds(originalDiskPath);
    await prisma.videoAsset.update({
      where: { id: videoAssetId },
      data: { durationSeconds, status: "transcribing" },
    });

    const transcriptionKey = decryptSecret(business.openaiTranscriptionKeyEncrypted);
    const audioPath = path.join(dir, "audio.mp3");
    await extractAudio(originalDiskPath, audioPath);
    const transcript = await transcribeVideo(transcriptionKey, audioPath);

    await prisma.videoAsset.update({
      where: { id: videoAssetId },
      data: { transcript: JSON.stringify(transcript), status: "analyzing" },
    });

    const aiKey = decryptSecret(business.aiApiKeyEncrypted);
    const { content: analysis } = await analyzeVideoTranscript({
      provider: business.aiProvider as AiProvider,
      apiKey: aiKey,
      model: business.aiModel,
      business: {
        name: business.name,
        industry: business.industry,
        description: business.description,
        targetAudience: business.targetAudience,
        location: business.location,
        objective: business.objective,
        products: business.products,
      },
      transcriptSegments: transcript.segments,
      totalDurationSeconds: durationSeconds,
    });

    await prisma.videoAsset.update({ where: { id: videoAssetId }, data: { status: "rendering" } });

    const srtPath = path.join(dir, "clip.srt");
    await writeFile(srtPath, generateSrt(transcript.segments, analysis.startSeconds));

    const outputDiskPath = path.join(dir, "version-1.mp4");
    const outputPublicPath = `/uploads/${businessId}/${videoAssetId}/version-1.mp4`;
    await renderVerticalClip({
      inputPath: originalDiskPath,
      outputPath: outputDiskPath,
      startSeconds: analysis.startSeconds,
      endSeconds: analysis.endSeconds,
      srtPath,
    });

    const thumbnailDiskPath = path.join(dir, "thumbnail.jpg");
    const thumbnailPublicPath = `/uploads/${businessId}/${videoAssetId}/thumbnail.jpg`;
    await extractThumbnail({
      inputPath: outputDiskPath,
      outputPath: thumbnailDiskPath,
      atSeconds: Math.min(1, analysis.endSeconds - analysis.startSeconds),
    });

    await prisma.videoVersion.create({
      data: {
        videoAssetId,
        label: "Versión 1",
        outputPath: outputPublicPath,
        thumbnailPath: thumbnailPublicPath,
        hook: analysis.hook,
        cta: analysis.cta,
        startSeconds: analysis.startSeconds,
        endSeconds: analysis.endSeconds,
      },
    });

    await prisma.videoAsset.update({ where: { id: videoAssetId }, data: { status: "ready" } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido al procesar el video.";
    await prisma.videoAsset.update({
      where: { id: videoAssetId },
      data: { status: "error", errorMessage: message },
    });
  }

  redirect(`/business/${businessId}/videos/${videoAssetId}`);
}

export async function publishVideoVersion(
  businessId: string,
  videoAssetId: string,
  versionId: string,
  formData: FormData
) {
  await requireBusinessAccess(businessId);

  const facebookPageId = formData.get("pageId");
  if (typeof facebookPageId !== "string" || facebookPageId.length === 0) {
    redirect(
      `/business/${businessId}/videos/${videoAssetId}?publish_error=${encodeURIComponent(
        "Selecciona una página para publicar."
      )}`
    );
  }

  const [version, page] = await Promise.all([
    prisma.videoVersion.findUnique({ where: { id: versionId } }),
    prisma.socialPage.findFirst({
      where: { facebookPageId, connection: { businessId } },
    }),
  ]);

  if (!version || version.videoAssetId !== videoAssetId) {
    redirect(`/business/${businessId}/videos/${videoAssetId}`);
  }
  if (!page) {
    redirect(
      `/business/${businessId}/videos/${videoAssetId}?publish_error=${encodeURIComponent(
        "No se encontró esa página conectada."
      )}`
    );
  }

  const caption = [version.hook, version.cta].filter(Boolean).join("\n\n");

  try {
    const videoDiskPath = path.join(process.cwd(), "public", version.outputPath);
    const videoBuffer = await readFile(videoDiskPath);

    const { videoId, permalinkUrl } = await publishPageVideo(
      page.facebookPageId,
      page.pageAccessToken,
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
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al publicar el video en Facebook.";
    redirect(`/business/${businessId}/videos/${videoAssetId}?publish_error=${encodeURIComponent(message)}`);
  }

  redirect(`/business/${businessId}/videos/${videoAssetId}`);
}
