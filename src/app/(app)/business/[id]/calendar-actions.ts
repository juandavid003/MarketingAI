"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireBusinessAccess } from "@/lib/dal";
import { businessAi } from "@/lib/aiCredentials";
import { toAiBusiness } from "@/lib/businessContext";
import type { GeneratedCampaign } from "@/lib/ai";
import {
  PLAN_PLATFORMS,
  PLAN_STATUSES,
  addDays,
  dayFromIso,
  generateContentCalendar,
  isFormat,
  isoDay,
} from "@/lib/contentPlan";
import { parseStrategy, variantCode } from "@/lib/distribution";

const calendarPath = (businessId: string) => `/business/${businessId}/calendar`;

function withParams(url: string, params: Record<string, string>): string {
  const q = new URLSearchParams(params).toString();
  return q ? `${url}?${q}` : url;
}

const text = (fd: FormData, name: string, max: number) => String(fd.get(name) ?? "").trim().slice(0, max);

// Ids the owner picks in forms must belong to this business.
async function ownedRefs(businessId: string, fd: FormData) {
  const pick = (name: string) => text(fd, name, 60) || null;
  const [campaignId, contentPieceId, trackedLinkId] = [pick("campaignId"), pick("contentPieceId"), pick("trackedLinkId")];
  const [campaign, piece, link] = await Promise.all([
    campaignId ? prisma.campaign.findFirst({ where: { id: campaignId, businessId }, select: { id: true } }) : null,
    contentPieceId ? prisma.contentPiece.findFirst({ where: { id: contentPieceId, businessId }, select: { id: true } }) : null,
    trackedLinkId ? prisma.trackedLink.findFirst({ where: { id: trackedLinkId, businessId }, select: { id: true } }) : null,
  ]);
  return { campaignId: campaign?.id ?? null, contentPieceId: piece?.id ?? null, trackedLinkId: link?.id ?? null };
}

function itemFields(fd: FormData) {
  const date = dayFromIso(text(fd, "date", 10));
  const format = text(fd, "format", 20);
  const platform = text(fd, "platform", 20);
  const status = text(fd, "status", 20);
  const time = text(fd, "time", 5);
  const title = text(fd, "title", 200);
  if (!date) return { error: "Elige una fecha válida." } as const;
  if (!isFormat(format)) return { error: "Elige un formato." } as const;
  if (!title) return { error: "Ponle un título a la publicación." } as const;
  const details = text(fd, "details", 4000)
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 15);
  const publishedUrl = text(fd, "publishedUrl", 500);
  return {
    data: {
      date,
      time: /^\d{2}:\d{2}$/.test(time) ? time : null,
      platform: PLAN_PLATFORMS.some((p) => p.value === platform) ? platform : "instagram",
      format,
      title,
      brief: text(fd, "brief", 3000) || null,
      copy: text(fd, "copy", 3000) || null,
      details: details.length > 0 ? JSON.stringify(details) : null,
      pillar: text(fd, "pillar", 100) || null,
      status: PLAN_STATUSES.some((s) => s.value === status) ? status : "planned",
      publishedUrl: /^https?:\/\//i.test(publishedUrl) ? publishedUrl : null,
    },
  } as const;
}

export async function addPlanItem(businessId: string, formData: FormData) {
  await requireBusinessAccess(businessId);
  const parsed = itemFields(formData);
  const month = text(formData, "date", 7);
  if ("error" in parsed) redirect(withParams(calendarPath(businessId), { error: parsed.error ?? "", month }));
  await prisma.contentPlanItem.create({
    data: { businessId, source: "manual", ...parsed.data, ...(await ownedRefs(businessId, formData)) },
  });
  revalidatePath(calendarPath(businessId));
  redirect(withParams(calendarPath(businessId), { month }));
}

export async function updatePlanItem(businessId: string, itemId: string, formData: FormData) {
  await requireBusinessAccess(businessId);
  const item = await prisma.contentPlanItem.findFirst({ where: { id: itemId, businessId } });
  if (!item) redirect(calendarPath(businessId));
  const parsed = itemFields(formData);
  const url = `${calendarPath(businessId)}/${itemId}`;
  if ("error" in parsed) redirect(withParams(url, { error: parsed.error ?? "" }));
  await prisma.contentPlanItem.update({
    where: { id: itemId },
    data: { ...parsed.data, ...(await ownedRefs(businessId, formData)) },
  });
  revalidatePath(calendarPath(businessId));
  redirect(withParams(calendarPath(businessId), { month: isoDay(parsed.data.date).slice(0, 7) }));
}

export async function setPlanItemStatus(businessId: string, itemId: string, status: string) {
  await requireBusinessAccess(businessId);
  if (!PLAN_STATUSES.some((s) => s.value === status)) return;
  await prisma.contentPlanItem.updateMany({ where: { id: itemId, businessId }, data: { status } });
  revalidatePath(calendarPath(businessId));
  revalidatePath(`${calendarPath(businessId)}/${itemId}`);
}

export async function deletePlanItem(businessId: string, itemId: string) {
  await requireBusinessAccess(businessId);
  const item = await prisma.contentPlanItem.findFirst({ where: { id: itemId, businessId } });
  await prisma.contentPlanItem.deleteMany({ where: { id: itemId, businessId } });
  revalidatePath(calendarPath(businessId));
  redirect(withParams(calendarPath(businessId), item ? { month: isoDay(item.date).slice(0, 7) } : {}));
}

// "Planificar con IA": a mixed-format calendar for the next weeks, aware of
// active campaigns, written scripts and what is already planned.
export async function generatePlan(businessId: string, formData: FormData) {
  await requireBusinessAccess(businessId);
  const business = await prisma.business.findUniqueOrThrow({ where: { id: businessId }, include: { products: true } });
  const ai = businessAi(business);
  if (!ai) {
    redirect(
      `/business/${businessId}/settings?campaign_error=${encodeURIComponent("Configura tu proveedor de IA antes de planificar.")}`
    );
  }

  const startIso = text(formData, "start", 10);
  const start = dayFromIso(startIso);
  const weeks = Math.min(4, Math.max(1, Number(formData.get("weeks")) || 2));
  const postsPerWeek = Math.min(14, Math.max(1, Number(formData.get("postsPerWeek")) || 4));
  const platforms = formData
    .getAll("platforms")
    .map(String)
    .filter((p) => PLAN_PLATFORMS.some((x) => x.value === p && p !== "other"));
  if (!start) redirect(withParams(calendarPath(businessId), { error: "Elige la fecha de inicio." }));
  if (platforms.length === 0) redirect(withParams(calendarPath(businessId), { error: "Elige al menos una red." }));

  const end = addDays(start, weeks * 7);
  const [campaigns, pieces, planned] = await Promise.all([
    prisma.campaign.findMany({ where: { businessId }, orderBy: { createdAt: "desc" }, take: 6 }),
    prisma.contentPiece.findMany({ where: { businessId }, orderBy: { createdAt: "desc" }, take: 12 }),
    prisma.contentPlanItem.findMany({ where: { businessId, date: { gte: start, lt: end } }, orderBy: { date: "asc" } }),
  ]);

  try {
    const items = await generateContentCalendar(ai, toAiBusiness(business), {
      startIso,
      weeks,
      postsPerWeek,
      platforms,
      focus: text(formData, "focus", 500),
      campaigns: campaigns.map((c) => ({ id: c.id, title: c.title, content: safeCampaign(c.content) })),
      pieces: pieces.map((p) => ({ id: p.id, hook: p.hook, format: p.format, purpose: p.purpose })),
      alreadyPlanned: planned.map((p) => ({ date: isoDay(p.date), format: p.format, title: p.title })),
    });
    await prisma.contentPlanItem.createMany({
      data: items.map((i) => ({
        businessId,
        source: "ai",
        status: "planned",
        date: dayFromIso(i.date)!,
        time: i.time,
        platform: i.platform,
        format: i.format,
        title: i.title,
        brief: i.brief || null,
        copy: i.copy || null,
        details: i.details.length > 0 ? JSON.stringify(i.details) : null,
        pillar: i.pillar || null,
        purpose: i.purpose || null,
        campaignId: i.campaignId,
        contentPieceId: i.contentPieceId,
      })),
    });
  } catch (err) {
    redirect(
      withParams(calendarPath(businessId), {
        error: err instanceof Error ? err.message : "No se pudo generar el plan.",
        month: startIso.slice(0, 7),
      })
    );
  }
  revalidatePath(calendarPath(businessId));
  redirect(withParams(calendarPath(businessId), { month: startIso.slice(0, 7), planned: "1" }));
}

function safeCampaign(raw: string): GeneratedCampaign | null {
  try {
    return JSON.parse(raw) as GeneratedCampaign;
  } catch {
    return null;
  }
}

const PLATFORM_FROM_NAME: [RegExp, string][] = [
  [/instagram/i, "instagram"],
  [/facebook/i, "facebook"],
  [/tiktok/i, "tiktok"],
  [/youtube/i, "youtube"],
];

// Distribuidor → Manager de contenido: put a piece's publication plan on the
// calendar, day 1 = the chosen start date. Phase-2 posts wait for the
// winning hook, so they go in as "idea".
export async function addStrategyToCalendar(businessId: string, pieceId: string, formData: FormData) {
  await requireBusinessAccess(businessId);
  const piece = await prisma.contentPiece.findFirst({ where: { id: pieceId, businessId } });
  const creatives = `/business/${businessId}/pieces/${pieceId}/creatives`;
  const strategy = parseStrategy(piece?.strategy ?? null);
  if (!piece || !strategy) redirect(creatives);
  const start = dayFromIso(text(formData, "start", 10));
  if (!start) redirect(`${creatives}?error=${encodeURIComponent("Elige la fecha de inicio.")}`);

  const hookText = new Map(strategy.hooks.map((h) => [h.codigo, h.texto]));
  const ctaText = new Map(strategy.ctas.map((c) => [c.codigo, c.texto]));
  await prisma.$transaction([
    // Re-sending the plan replaces what it put there before.
    prisma.contentPlanItem.deleteMany({ where: { businessId, contentPieceId: pieceId, source: "distribution" } }),
    prisma.contentPlanItem.createMany({
      data: strategy.calendario.map((post) => {
        const winner = post.hook === "ganador";
        return {
          businessId,
          source: "distribution",
          status: winner ? "idea" : "planned",
          date: addDays(start, post.dia - 1),
          time: post.momento.match(/\b([01]?\d|2[0-3]):[0-5]\d\b/)?.[0]?.padStart(5, "0") ?? null,
          platform: PLATFORM_FROM_NAME.find(([re]) => re.test(post.plataforma))?.[1] ?? "other",
          format: "reel",
          title: winner
            ? `Fase 2 · hook ganador + ${post.cta}: “${ctaText.get(post.cta) ?? ""}”`
            : `Fase ${post.fase} · ${variantCode(post.hook, post.cta)}: “${hookText.get(post.hook) ?? ""}”`,
          brief: [post.momento && `Momento sugerido: ${post.momento}`, post.nota, `Formato ${post.formato}.`]
            .filter(Boolean)
            .join("\n"),
          copy: post.copy || null,
          contentPieceId: pieceId,
          variantCode: winner ? null : variantCode(post.hook, post.cta),
        };
      }),
    }),
  ]);
  revalidatePath(calendarPath(businessId));
  redirect(withParams(calendarPath(businessId), { month: isoDay(start).slice(0, 7) }));
}
