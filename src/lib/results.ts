import type { Attribution } from "@/lib/leads";

// Pure aggregation for the Resultados panel. Business results (clicks on our
// links, leads, sales) never mix with platform metrics (views, likes).

export type LeadRow = {
  status: string;
  value: number | null;
  attribution: string;
  source: string;
  trackedLinkId: string | null;
  campaignId: string | null;
  contentPieceId: string | null;
};

export type Totals = { clicks: number; leads: number; won: number; value: number };

export function leadTotals(leads: LeadRow[], clicks: number): Totals & {
  winRate: number | null;
  byAttribution: Record<Attribution, number>;
} {
  const won = leads.filter((l) => l.status === "won");
  const byAttribution: Record<Attribution, number> = { high: 0, medium: 0, low: 0 };
  for (const l of leads) {
    const key = (["high", "medium", "low"].includes(l.attribution) ? l.attribution : "low") as Attribution;
    byAttribution[key]++;
  }
  return {
    clicks,
    leads: leads.length,
    won: won.length,
    value: won.reduce((s, l) => s + (l.value ?? 0), 0),
    winRate: leads.length > 0 ? Math.round((won.length / leads.length) * 100) : null,
    byAttribution,
  };
}

// Rows "what brings customers", keyed by campaign or content piece. Clicks
// come from the links tied to that campaign/piece.
export function groupResults(
  leads: LeadRow[],
  links: { id: string; campaignId: string | null; contentPieceId: string | null; clicks: number }[],
  key: "campaignId" | "contentPieceId"
): Map<string | null, Totals> {
  const rows = new Map<string | null, Totals>();
  const row = (k: string | null) => {
    let r = rows.get(k);
    if (!r) {
      r = { clicks: 0, leads: 0, won: 0, value: 0 };
      rows.set(k, r);
    }
    return r;
  };
  for (const link of links) if (link.clicks > 0) row(link[key]).clicks += link.clicks;
  for (const lead of leads) {
    const r = row(lead[key]);
    r.leads++;
    if (lead.status === "won") {
      r.won++;
      r.value += lead.value ?? 0;
    }
  }
  return rows;
}
