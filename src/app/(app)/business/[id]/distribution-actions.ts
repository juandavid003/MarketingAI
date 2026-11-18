"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireBusinessAccess } from "@/lib/dal";
import { businessAi } from "@/lib/aiCredentials";
import { toAiBusiness } from "@/lib/businessContext";
import { recordingStatus, type GeneratedContentPiece } from "@/lib/contentAi";
import { generateDistributionStrategy, parseStrategy, variantCode } from "@/lib/distribution";
import { renderPieceVariants, areVariantsStalled } from "@/lib/jobs/renderVariants";

// "El distribuidor": plan, creatives (same body, different hook/CTA) and the
// results that pick the winner. See lib/distribution.ts.

const creativesPath = (businessId: string, pieceId: string) => `/business/${businessId}/pieces/${pieceId}/creatives`;

function withError(url: string, message: string): string {
  return `${url}?error=${encodeURIComponent(message.slice(0, 300))}`;
}

async function loadPiece(businessId: string, pieceId: string) {
  await requireBusinessAccess(businessId);
  const piece = await prisma.contentPiece.findFirst({
    where: { id: pieceId, businessId },
    include: { variants: true, takes: true },
  });
  if (!piece) redirect(`/business/${businessId}`);
  return piece;
}

export async function generateStrategy(businessId: string, pieceId: string) {
  const piece = await loadPiece(businessId, pieceId);
  const url = creativesPath(businessId, pieceId);
  if (piece.variantsStatus === "rendering" && !areVariantsStalled(piece.variants)) {
    redirect(withError(url, "Espera a que terminen de generarse los creativos."));
  }

  const business = await prisma.business.findUniqueOrThrow({ where: { id: businessId }, include: { products: true } });
  const ai = businessAi(business);
  if (!ai) {
    redirect(
      `/business/${businessId}/settings?campaign_error=${encodeURIComponent(
        "Configura tu proveedor de IA antes de generar el plan de distribución."
      )}`
    );
  }

  try {
    const content = JSON.parse(piece.content) as GeneratedContentPiece;
    const strategy = await generateDistributionStrategy(ai, toAiBusiness(business), content);
    await prisma.$transaction([
      // A new plan means new hook/CTA texts: the old creatives (and their
      // results) no longer describe it. Rendered videos stay in the library.
      prisma.creativeVariant.deleteMany({ where: { contentPieceId: pieceId } }),
      prisma.contentPiece.update({
        where: { id: pieceId },
        data: { strategy: JSON.stringify(strategy), variantsStatus: "idle" },
      }),
    ]);
  } catch (err) {
    redirect(withError(url, err instanceof Error ? err.message : "Error al generar el plan."));
  }
  revalidatePath(url);
  redirect(url);
}

// Edit one hook or CTA by hand. Creatives already rendered with the old text
// show as outdated until they are generated again.
export async function updateStrategyOption(businessId: string, pieceId: string, code: string, formData: FormData) {
  const piece = await loadPiece(businessId, pieceId);
  const url = creativesPath(businessId, pieceId);
  const strategy = parseStrategy(piece.strategy);
  if (!strategy) redirect(url);

  const texto = String(formData.get("texto") ?? "").trim().slice(0, 200);
  if (!texto) redirect(withError(url, "El texto no puede quedar vacío."));
  const hook = strategy.hooks.find((h) => h.codigo === code);
  const cta = strategy.ctas.find((c) => c.codigo === code);
  if (hook) {
    hook.texto = texto;
    if (!hook.original) hook.queDecir = String(formData.get("queDecir") ?? "").trim().slice(0, 300);
  } else if (cta) {
    cta.texto = texto;
  } else {
    redirect(url);
  }
  await prisma.contentPiece.update({ where: { id: pieceId }, data: { strategy: JSON.stringify(strategy) } });
  revalidatePath(url);
  redirect(url);
}

// Queue the selected creatives ("H2C1", ...) and start the renderer.
export async function renderCreatives(businessId: string, pieceId: string, formData: FormData) {
  const piece = await loadPiece(businessId, pieceId);
  const url = creativesPath(businessId, pieceId);
  const strategy = parseStrategy(piece.strategy);
  if (!strategy) redirect(withError(url, "Primero genera el plan de distribución."));

  const content = JSON.parse(piece.content) as GeneratedContentPiece;
  const recorded = recordingStatus(content, piece.takes);
  if (!recorded.scenesReady && !recorded.fullReady) {
    redirect(withError(url, "Primero sube todas las escenas del guion (o el video completo) y espera a que estén listas."));
  }

  const valid = new Map<string, { hookCode: string; ctaCode: string }>();
  for (const h of strategy.hooks) {
    for (const c of strategy.ctas) valid.set(variantCode(h.codigo, c.codigo), { hookCode: h.codigo, ctaCode: c.codigo });
  }
  const codes = [...new Set(formData.getAll("code").map(String))].filter((c) => valid.has(c));
  if (codes.length === 0) redirect(withError(url, "Elige al menos un creativo."));
  if (codes.length > 12) redirect(withError(url, "Elige como máximo 12 creativos a la vez."));

  for (const code of codes) {
    const { hookCode, ctaCode } = valid.get(code)!;
    await prisma.creativeVariant.upsert({
      where: { contentPieceId_code: { contentPieceId: pieceId, code } },
      create: { contentPieceId: pieceId, code, hookCode, ctaCode, renderStatus: "queued" },
      // A creative already rendering keeps going; anything else is redone.
      update: { renderError: null, ...(await isRendering(pieceId, code) ? {} : { renderStatus: "queued" }) },
    });
  }

  const stalled = areVariantsStalled(piece.variants);
  const claimed = await prisma.contentPiece.updateMany({
    where: { id: pieceId, ...(stalled ? {} : { variantsStatus: "idle" }) },
    data: { variantsStatus: "rendering" },
  });
  if (stalled) {
    await prisma.creativeVariant.updateMany({
      where: { contentPieceId: pieceId, renderStatus: "rendering" },
      data: { renderStatus: "queued" },
    });
  }
  // Already running: the loop in renderPieceVariants picks the new ones up.
  if (claimed.count > 0) after(() => renderPieceVariants(pieceId));
  revalidatePath(url);
  redirect(url);
}

async function isRendering(pieceId: string, code: string): Promise<boolean> {
  const v = await prisma.creativeVariant.findUnique({ where: { contentPieceId_code: { contentPieceId: pieceId, code } } });
  return v?.renderStatus === "rendering";
}

// ---------------------------------------------------------------------------
// Results (entered by hand from each platform's stats)
// ---------------------------------------------------------------------------

function intField(formData: FormData, name: string): number | null {
  const raw = String(formData.get(name) ?? "").replace(/[.,\s]/g, "");
  if (!raw) return null;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 && n < 1e10 ? n : null;
}

export async function addVariantResult(businessId: string, pieceId: string, variantId: string, formData: FormData) {
  const piece = await loadPiece(businessId, pieceId);
  const url = creativesPath(businessId, pieceId);
  if (!piece.variants.some((v) => v.id === variantId)) redirect(url);

  const platform = String(formData.get("platform") ?? "").trim().slice(0, 60);
  if (!platform) redirect(withError(url, "Indica en qué red lo publicaste."));
  const views = intField(formData, "views");
  if (views == null) redirect(withError(url, "Las vistas (o reproducciones) son necesarias para comparar."));
  const postUrlRaw = String(formData.get("postUrl") ?? "").trim();
  const postedAtRaw = String(formData.get("postedAt") ?? "").trim();
  const postedAt = postedAtRaw ? new Date(`${postedAtRaw}T12:00:00Z`) : null;

  await prisma.variantResult.create({
    data: {
      variantId,
      platform,
      postUrl: /^https?:\/\//i.test(postUrlRaw) ? postUrlRaw.slice(0, 500) : null,
      postedAt: postedAt && !Number.isNaN(postedAt.getTime()) ? postedAt : null,
      views,
      likes: intField(formData, "likes"),
      comments: intField(formData, "comments"),
      shares: intField(formData, "shares"),
      saves: intField(formData, "saves"),
      clicks: intField(formData, "clicks"),
      notes: String(formData.get("notes") ?? "").trim().slice(0, 300) || null,
    },
  });
  revalidatePath(url);
  redirect(url);
}

export async function removeVariantResult(businessId: string, pieceId: string, resultId: string) {
  await requireBusinessAccess(businessId);
  await prisma.variantResult.deleteMany({
    where: { id: resultId, variant: { contentPieceId: pieceId, contentPiece: { businessId } } },
  });
  const url = creativesPath(businessId, pieceId);
  revalidatePath(url);
  redirect(url);
}
