import "server-only";
import { prisma } from "@/lib/prisma";
import { leadTotals, groupResults, type LeadRow, type Totals } from "@/lib/results";
import { leadSourceLabel } from "@/lib/leads";
import { daysAgo, addDays } from "@/lib/contentPlan";
import { competitorStats } from "@/lib/competitorStats";
import { detectCountry } from "@/lib/adLibrary";
import { upcomingSeasonal } from "@/lib/seasonal";
import { profileCompleteness } from "@/lib/profileCompleteness";
import type { AssistantData, RankedRow } from "@/lib/assistant";
import type { Business } from "@/generated/prisma/client";

// Loads everything the growth assistant may talk about, for one business,
// as plain numbers (lib/assistant.ts turns them into cited facts). Same
// definitions as the Resultados page, so a cited figure matches what the
// owner sees when they click through.

const DAY_MS = 86_400_000;

const LEAD_SELECT = {
  status: true,
  value: true,
  attribution: true,
  source: true,
  trackedLinkId: true,
  campaignId: true,
  contentPieceId: true,
  occurredAt: true,
} as const;

function top(rows: Map<string | null, Totals>, name: Map<string, string>, n = 3): RankedRow[] {
  return [...rows.entries()]
    .filter(([key, r]) => key && (r.clicks > 0 || r.leads > 0))
    .sort((a, b) => b[1].won - a[1].won || b[1].leads - a[1].leads || b[1].clicks - a[1].clicks)
    .slice(0, n)
    .map(([key, r]) => ({ name: name.get(key!) ?? "eliminado", ...r }));
}

export async function loadAssistantData(business: Business, now = new Date()): Promise<AssistantData> {
  const id = business.id;
  const d30 = daysAgo(30);
  const d60 = daysAgo(60);
  const d90 = daysAgo(90);
  const in14 = addDays(now, 14);

  const [leads90, openLeads, links, clicks90, campaigns, pieces, plan30, planNext14, jobs30, scheduledNext14, variantResults, competitors, videosReady] =
    await Promise.all([
      prisma.lead.findMany({ where: { businessId: id, occurredAt: { gte: d90 } }, select: LEAD_SELECT }),
      prisma.lead.findMany({
        where: { businessId: id, status: { in: ["new", "contacted", "qualified"] } },
        select: { status: true, occurredAt: true },
      }),
      prisma.trackedLink.findMany({ where: { businessId: id }, select: { id: true, label: true, campaignId: true, contentPieceId: true } }),
      prisma.linkClick.findMany({
        where: { link: { businessId: id }, createdAt: { gte: d90 } },
        select: { linkId: true, createdAt: true },
      }),
      prisma.campaign.findMany({ where: { businessId: id }, select: { id: true, title: true } }),
      prisma.contentPiece.findMany({ where: { businessId: id }, select: { id: true, hook: true } }),
      prisma.contentPlanItem.findMany({
        where: { businessId: id, date: { gte: d30, lte: now } },
        select: { status: true },
      }),
      prisma.contentPlanItem.count({ where: { businessId: id, date: { gt: now, lte: in14 } } }),
      prisma.publishJob.groupBy({
        by: ["status"],
        where: { businessId: id, target: { not: "manual" }, scheduledAt: { gte: d30, lte: now } },
        _count: { _all: true },
      }),
      prisma.publishJob.count({ where: { businessId: id, status: "scheduled", scheduledAt: { gt: now, lte: in14 } } }),
      prisma.variantResult.findMany({
        where: { variant: { contentPiece: { businessId: id } }, createdAt: { gte: d90 } },
        select: {
          views: true,
          likes: true,
          comments: true,
          shares: true,
          saves: true,
          clicks: true,
          variant: { select: { code: true, contentPiece: { select: { hook: true } } } },
        },
      }),
      prisma.competitor.findMany({
        where: { businessId: id },
        orderBy: { createdAt: "asc" },
        take: 5,
        include: {
          posts: {
            orderBy: { postedAt: "desc" },
            take: 30,
            select: { id: true, source: true, mediaType: true, likeCount: true, commentsCount: true, postedAt: true },
          },
        },
      }),
      prisma.videoAsset.count({ where: { businessId: id, status: "ready" } }),
    ]);

  // Business results, current vs previous 30 days.
  const inRange = (t: Date, from: Date, to: Date) => t >= from && t < to;
  const leads30 = leads90.filter((l) => l.occurredAt >= d30);
  const leadsPrev = leads90.filter((l) => inRange(l.occurredAt, d60, d30));
  const clicks30 = clicks90.filter((c) => c.createdAt >= d30);
  const clicksPrev = clicks90.filter((c) => inRange(c.createdAt, d60, d30));
  const current = leadTotals(leads30, clicks30.length);
  const previous = leadTotals(leadsPrev, clicksPrev.length);

  // What brought customers (90 days, same grouping as Resultados).
  const countBy = (rows: { linkId: string }[]) => {
    const m = new Map<string, number>();
    for (const r of rows) m.set(r.linkId, (m.get(r.linkId) ?? 0) + 1);
    return m;
  };
  const clicks90By = countBy(clicks90);
  const clicks30By = countBy(clicks30);
  const links90 = links.map((l) => ({ ...l, clicks: clicks90By.get(l.id) ?? 0 }));
  const leadRows: LeadRow[] = leads90;
  const campaignName = new Map(campaigns.map((c) => [c.id, c.title]));
  const pieceName = new Map(pieces.map((p) => [p.id, p.hook]));

  const sources = new Map<string, { leads: number; won: number }>();
  for (const l of leads30) {
    const r = sources.get(l.source) ?? { leads: 0, won: 0 };
    r.leads++;
    if (l.status === "won") r.won++;
    sources.set(l.source, r);
  }

  const topLinks30 = links
    .map((l) => ({
      label: l.label,
      clicks: clicks30By.get(l.id) ?? 0,
      leads: leads30.filter((x) => x.trackedLinkId === l.id).length,
    }))
    .filter((l) => l.clicks > 0 || l.leads > 0)
    .sort((a, b) => b.clicks - a.clicks || b.leads - a.leads)
    .slice(0, 3);

  // Open leads.
  const newLeads = openLeads.filter((l) => l.status === "new");
  const oldestNew = newLeads.reduce<Date | null>((min, l) => (!min || l.occurredAt < min ? l.occurredAt : min), null);

  // Platform metrics per creative.
  const creatives = new Map<string, { code: string; hook: string; views: number; interactions: number; clicks: number }>();
  for (const r of variantResults) {
    const key = `${r.variant.contentPiece.hook}|${r.variant.code}`;
    const c = creatives.get(key) ?? { code: r.variant.code, hook: r.variant.contentPiece.hook, views: 0, interactions: 0, clicks: 0 };
    c.views += r.views ?? 0;
    c.interactions += (r.likes ?? 0) + (r.comments ?? 0) + (r.shares ?? 0) + (r.saves ?? 0);
    c.clicks += r.clicks ?? 0;
    creatives.set(key, c);
  }

  const jobCount = (s: string) => jobs30.find((j) => j.status === s)?._count._all ?? 0;

  const country = detectCountry(business.location);
  const seasonal = upcomingSeasonal(country.code, business.location, now, 60)
    .slice(0, 4)
    .map((e) => ({
      name: e.name,
      date: e.date.toLocaleDateString("es", { day: "numeric", month: "long", timeZone: "UTC" }),
      daysUntil: e.daysUntil,
      prepareNow: e.status === "prepare_now",
      angle: e.angle,
    }));

  return {
    businessId: id,
    avgTicket: business.avgTicket,
    current,
    previous,
    attribution30: current.byAttribution,
    openLeads: {
      new: newLeads.length,
      contacted: openLeads.filter((l) => l.status === "contacted").length,
      qualified: openLeads.filter((l) => l.status === "qualified").length,
      oldestNewDays: oldestNew ? Math.floor((now.getTime() - oldestNew.getTime()) / DAY_MS) : null,
    },
    topCampaigns90: top(groupResults(leadRows, links90, "campaignId"), campaignName),
    topPieces90: top(groupResults(leadRows, links90, "contentPieceId"), pieceName),
    sources30: [...sources.entries()]
      .sort((a, b) => b[1].leads - a[1].leads)
      .slice(0, 5)
      .map(([source, r]) => ({ label: leadSourceLabel(source), ...r })),
    topLinks30,
    plan30: { planned: plan30.length, published: plan30.filter((p) => p.status === "published").length },
    planNext14,
    publishing30: { published: jobCount("published"), failed: jobCount("failed") },
    scheduledNext14,
    creatives90: [...creatives.values()]
      .sort((a, b) => b.clicks - a.clicks || b.views - a.views)
      .slice(0, 3),
    competitors: competitors.slice(0, 3).map((c) => {
      const stats = competitorStats(c.posts, c.followersCount);
      return {
        name: c.name,
        followers: c.followersCount,
        postsPerWeek: stats.postsPerWeek,
        avgInteractions: stats.avgInteractions,
        topFormat: stats.formats[0]?.format ?? null,
      };
    }),
    seasonal,
    profileMissing: profileCompleteness(business).missing,
    videosReady,
  };
}
