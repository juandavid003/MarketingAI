"use server";

import path from "path";
import { randomUUID } from "crypto";
import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireBusinessAccess } from "@/lib/dal";
import { businessAi } from "@/lib/aiCredentials";
import { toAiBusiness } from "@/lib/businessContext";
import type { GeneratedCampaign } from "@/lib/ai";
import {
  generateContentPiece,
  postMetricsSummary,
  purposeLabel,
  type GeneratedCompetitorIdeas,
  type GeneratedContentPiece,
  type PieceBrief,
} from "@/lib/contentAi";
import { storageKey, saveUpload, deleteStored } from "@/lib/storage";
import { processSceneTake, isTakeStalled } from "@/lib/jobs/processTake";
import { parseStrategy } from "@/lib/distribution";
import { assembleContentPiece, isAssemblyStalled } from "@/lib/jobs/assemblePiece";

const MAX_TAKE_BYTES = 300 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set([".mp4", ".mov", ".m4v", ".webm"]);

const piecePath = (businessId: string, pieceId: string) => `/business/${businessId}/pieces/${pieceId}`;

function withError(url: string, message: string): string {
  return `${url}${url.includes("?") ? "&" : "?"}error=${encodeURIComponent(message.slice(0, 300))}`;
}

type SourceRef = { permalink: string | null; competitor: string; why: string };

// Shared by every way of creating a piece: generate, save, open it.
async function createPiece(
  businessId: string,
  errorUrl: string,
  brief: PieceBrief,
  source: {
    sourceType: "campaign" | "competitor_idea" | "brief";
    sourceSummary: string;
    sourceRefs?: SourceRef[];
    campaignId?: string;
    contentIndex?: number;
  }
): Promise<never> {
  const business = await prisma.business.findUniqueOrThrow({
    where: { id: businessId },
    include: { products: true },
  });
  const ai = businessAi(business);
  if (!ai) {
    redirect(
      `/business/${businessId}/settings?campaign_error=${encodeURIComponent(
        "Configura tu proveedor de IA antes de generar un guion."
      )}`
    );
  }

  let pieceId: string;
  try {
    const { content, resolvedModel } = await generateContentPiece(ai, toAiBusiness(business), brief);
    const piece = await prisma.contentPiece.create({
      data: {
        businessId,
        campaignId: source.campaignId,
        contentIndex: source.contentIndex,
        sourceType: source.sourceType,
        sourceSummary: source.sourceSummary,
        sourceRefs: source.sourceRefs ? JSON.stringify(source.sourceRefs) : null,
        purpose: content.proposito,
        format: content.formato,
        hook: content.hook,
        content: JSON.stringify(content),
        provider: ai.provider,
        model: resolvedModel,
      },
    });
    pieceId = piece.id;
  } catch (err) {
    redirect(withError(errorUrl, err instanceof Error ? err.message : "Error al generar el guion."));
  }
  revalidatePath(`/business/${businessId}`);
  redirect(piecePath(businessId, pieceId));
}

// "¿Sobre qué quieres tu próximo video?" — free brief from the owner.
export async function createPieceFromBrief(businessId: string, formData: FormData) {
  await requireBusinessAccess(businessId);
  const brief = String(formData.get("brief") ?? "").trim();
  const purpose = String(formData.get("purpose") ?? "").trim();
  if (brief.length < 5) {
    redirect(withError(`/business/${businessId}`, "Cuéntanos con un poco más de detalle de qué quieres el video."));
  }
  await createPiece(
    businessId,
    `/business/${businessId}`,
    { brief, purpose: purpose ? purposeLabel(purpose) : undefined },
    { sourceType: "brief", sourceSummary: brief }
  );
}

export async function createPieceFromCampaign(businessId: string, campaignId: string, contentIndex: number) {
  await requireBusinessAccess(businessId);
  const campaign = await prisma.campaign.findFirst({ where: { id: campaignId, businessId } });
  if (!campaign) redirect(`/business/${businessId}`);

  const existing = await prisma.contentPiece.findFirst({ where: { campaignId, contentIndex } });
  if (existing) redirect(piecePath(businessId, existing.id));

  const errorUrl = `/business/${businessId}/campaigns/${campaignId}`;
  let content: GeneratedCampaign;
  try {
    content = JSON.parse(campaign.content) as GeneratedCampaign;
  } catch {
    redirect(withError(errorUrl, "No se pudo leer el contenido de esta campaña."));
  }
  const item = content.contenido[contentIndex];
  if (!item) redirect(withError(errorUrl, "Esa pieza de contenido ya no existe."));

  await createPiece(
    businessId,
    errorUrl,
    {
      brief: `Pieza de la campaña "${campaign.title}". Objetivo: ${content.objetivo}. Concepto: ${content.concepto}. Oferta: ${content.oferta}. Audiencia: ${content.audiencia}.`,
      hook: item.hook,
      format: item.formato,
      cta: content.cta,
    },
    {
      sourceType: "campaign",
      sourceSummary: `Campaña: ${campaign.title}`,
      campaignId,
      contentIndex,
    }
  );
}

export async function createPieceFromIdea(businessId: string, batchId: string, ideaIndex: number) {
  await requireBusinessAccess(businessId);
  const errorUrl = `/business/${businessId}/competitors`;
  const batch = await prisma.competitorIdeaBatch.findFirst({ where: { id: batchId, businessId } });
  if (!batch) redirect(errorUrl);

  const ideas = JSON.parse(batch.content) as GeneratedCompetitorIdeas;
  const idea = ideas.ideas[ideaIndex];
  if (!idea) redirect(withError(errorUrl, "Esa idea ya no existe."));

  const posts = await prisma.competitorPost.findMany({
    where: { id: { in: idea.referencias }, competitor: { businessId } },
    include: { competitor: true },
  });
  const competitorName = (p: (typeof posts)[number]) =>
    p.competitor.instagramUsername ? `@${p.competitor.instagramUsername}` : p.competitor.name;

  await createPiece(
    businessId,
    errorUrl,
    {
      brief: `${idea.titulo}. ${idea.concepto} Por qué: ${idea.porQue}`,
      hook: idea.hook,
      format: idea.formato,
      purpose: purposeLabel(idea.proposito),
      cta: idea.cta,
      references: posts.map((p) => ({
        competitor: competitorName(p),
        caption: p.caption ?? p.notes ?? "",
        metrics: postMetricsSummary({ likes: p.likeCount, comments: p.commentsCount, source: p.source }),
      })),
    },
    {
      sourceType: "competitor_idea",
      sourceSummary: `Idea basada en la competencia: ${idea.titulo}`,
      sourceRefs: posts.map((p) => ({ permalink: p.permalink, competitor: competitorName(p), why: idea.porQue })),
    }
  );
}

export async function deletePiece(businessId: string, pieceId: string) {
  await requireBusinessAccess(businessId);
  const piece = await prisma.contentPiece.findFirst({ where: { id: pieceId, businessId } });
  if (piece) {
    await prisma.contentPiece.delete({ where: { id: pieceId } });
    // Takes only; assembled videos stay (they are VideoAssets of their own).
    await deleteStored(storageKey(businessId, "pieces", pieceId, "takes")).catch(() => {});
  }
  revalidatePath(`/business/${businessId}`);
  redirect(`/business/${businessId}`);
}

// ---------------------------------------------------------------------------
// Takes
// ---------------------------------------------------------------------------

export type UploadTakeState = { error?: string; ok?: boolean };

export async function uploadSceneTake(
  businessId: string,
  pieceId: string,
  sceneNumber: number,
  slot: string,
  _prev: UploadTakeState,
  formData: FormData
): Promise<UploadTakeState> {
  await requireBusinessAccess(businessId);
  const piece = await prisma.contentPiece.findFirst({ where: { id: pieceId, businessId } });
  if (!piece) return { error: "No encontramos este guion." };
  if (piece.assemblyStatus === "assembling") {
    return { error: "Espera a que termine de armarse el video antes de cambiar una toma." };
  }
  const content = JSON.parse(piece.content) as GeneratedContentPiece;
  if (!content.escenas.some((s) => s.numero === sceneNumber)) return { error: "Esa escena no existe." };
  if (slot !== "main") {
    // Alternative openings replace scene 1 for one hook of the plan.
    const hook = parseStrategy(piece.strategy)?.hooks.find((h) => `hook:${h.codigo}` === slot);
    if (!hook || hook.original || sceneNumber !== 1) return { error: "Ese hook ya no existe en el plan." };
    if (piece.variantsStatus === "rendering") {
      return { error: "Espera a que terminen de generarse los creativos antes de cambiar una toma." };
    }
  }

  const file = formData.get("video");
  if (!(file instanceof File) || file.size === 0) return { error: "Selecciona un video." };
  if (!file.type.startsWith("video/")) return { error: "El archivo debe ser un video." };
  if (file.size > MAX_TAKE_BYTES) return { error: "La toma supera el máximo de 300 MB." };

  const rawExt = path.extname(file.name).toLowerCase();
  const ext = ALLOWED_EXTENSIONS.has(rawExt) ? rawExt : ".mp4";
  const takeId = randomUUID();
  const key = storageKey(businessId, "pieces", pieceId, "takes", takeId, `original${ext}`);

  try {
    await saveUpload(key, file);
  } catch (err) {
    console.error("[uploadSceneTake] save failed", err);
    return { error: "No se pudo guardar el video. Intenta de nuevo." };
  }

  const uniqueTake = { contentPieceId_sceneNumber_slot: { contentPieceId: pieceId, sceneNumber, slot } };
  const previous = await prisma.sceneTake.findUnique({ where: uniqueTake });
  await prisma.sceneTake.upsert({
    where: uniqueTake,
    create: { id: takeId, contentPieceId: pieceId, sceneNumber, slot, originalFilename: file.name, originalPath: key },
    update: {
      id: takeId,
      originalFilename: file.name,
      originalPath: key,
      status: "uploaded",
      durationSeconds: null,
      hasAudio: null,
      transcript: null,
      keepIntervals: null,
      review: null,
      errorMessage: null,
    },
  });
  if (previous) {
    // The replaced recording (and its extracted audio) is no longer used.
    await deleteStored(storageKey(businessId, "pieces", pieceId, "takes", previous.id)).catch(() => {});
  }

  after(() => processSceneTake(takeId));
  revalidatePath(piecePath(businessId, pieceId));
  revalidatePath(`${piecePath(businessId, pieceId)}/creatives`);
  return { ok: true };
}

export async function retryTake(businessId: string, pieceId: string, takeId: string) {
  await requireBusinessAccess(businessId);
  const take = await prisma.sceneTake.findFirst({
    where: { id: takeId, contentPieceId: pieceId, contentPiece: { businessId } },
  });
  if (take && (take.status === "error" || isTakeStalled(take))) {
    await prisma.sceneTake.update({ where: { id: takeId }, data: { status: "uploaded", errorMessage: null } });
    after(() => processSceneTake(takeId));
  }
  revalidatePath(piecePath(businessId, pieceId));
  revalidatePath(`${piecePath(businessId, pieceId)}/creatives`);
}

// ---------------------------------------------------------------------------
// Assembly
// ---------------------------------------------------------------------------

export async function assemblePiece(businessId: string, pieceId: string) {
  await requireBusinessAccess(businessId);
  const piece = await prisma.contentPiece.findFirst({
    where: { id: pieceId, businessId },
    include: { takes: true },
  });
  if (!piece) redirect(`/business/${businessId}`);

  const content = JSON.parse(piece.content) as GeneratedContentPiece;
  const ready = new Set(
    piece.takes.filter((t) => t.status === "ready" && t.slot === "main").map((t) => t.sceneNumber)
  );
  if (!content.escenas.every((s) => ready.has(s.numero))) {
    redirect(withError(piecePath(businessId, pieceId), "Sube y espera a que estén listas todas las escenas."));
  }

  // Atomic claim: a double click can't start two renders.
  const claimed = await prisma.contentPiece.updateMany({
    where: {
      id: pieceId,
      OR: [{ assemblyStatus: { not: "assembling" } }, ...(isAssemblyStalled(piece) ? [{ id: pieceId }] : [])],
    },
    data: { assemblyStatus: "assembling", assemblyError: null },
  });
  if (claimed.count > 0) after(() => assembleContentPiece(pieceId));
  redirect(piecePath(businessId, pieceId));
}
