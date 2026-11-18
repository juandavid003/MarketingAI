// Compares creatives from the results the owner enters by hand. Pure and
// deliberately conservative: it never declares a winner from too little data
// or a small difference — organic posts vary a lot from one day to the next.

export type ResultInput = {
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  clicks: number | null;
};

export type ResultSummary = {
  posts: number;
  views: number | null; // total; null when no post has views
  viewsPerPost: number | null;
  interactions: number;
  interactionRate: number | null; // % of views
  clicks: number | null;
  clicksPer1000: number | null;
};

export function summarizeResults(rows: ResultInput[]): ResultSummary {
  const withViews = rows.filter((r) => r.views != null);
  const views = withViews.length > 0 ? withViews.reduce((s, r) => s + (r.views ?? 0), 0) : null;
  const interactions = rows.reduce(
    (s, r) => s + (r.likes ?? 0) + (r.comments ?? 0) + (r.shares ?? 0) + (r.saves ?? 0),
    0
  );
  const withClicks = rows.filter((r) => r.clicks != null);
  const clicks = withClicks.length > 0 ? withClicks.reduce((s, r) => s + (r.clicks ?? 0), 0) : null;
  // Rates only over posts that reported both numbers, so a post without
  // views can't inflate them.
  const viewsWithClicks = withClicks.reduce((s, r) => s + (r.views ?? 0), 0);
  const interactionViews = views ?? 0;
  const interactionsWithViews = withViews.reduce(
    (s, r) => s + (r.likes ?? 0) + (r.comments ?? 0) + (r.shares ?? 0) + (r.saves ?? 0),
    0
  );

  return {
    posts: rows.length,
    views,
    viewsPerPost: views != null ? views / withViews.length : null,
    interactions,
    interactionRate: interactionViews > 0 ? round1((interactionsWithViews / interactionViews) * 100) : null,
    clicks,
    clicksPer1000: clicks != null && viewsWithClicks > 0 ? round1((clicks / viewsWithClicks) * 1000) : null,
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export type Comparison = {
  leader: string | null; // code of the leading creative
  conclusive: boolean;
  message: string;
};

export const MIN_VIEWS_PER_CREATIVE = 300;
const MIN_LEAD = 1.2; // the leader must beat the runner-up by 20%

// Phase 1 (hooks): which opening reaches more people — views per post, the
// best organic proxy for "stopped the scroll" without retention data.
// Phase 2 (CTAs): which closing gets more action — clicks/messages per 1,000
// views, or the interaction rate when no clicks were recorded.
export function compareCreatives(
  candidates: { code: string; summary: ResultSummary }[],
  metric: "hook" | "cta"
): Comparison {
  if (candidates.length < 2) {
    return { leader: null, conclusive: false, message: "Hacen falta al menos dos creativos para comparar." };
  }
  const missing = candidates.filter((c) => c.summary.posts === 0);
  if (missing.length > 0) {
    return {
      leader: null,
      conclusive: false,
      message: `Faltan resultados de ${missing.map((c) => c.code).join(", ")}.`,
    };
  }

  const useClicks = metric === "cta" && candidates.every((c) => c.summary.clicksPer1000 != null);
  const value = (s: ResultSummary): number | null =>
    metric === "hook" ? s.viewsPerPost : useClicks ? s.clicksPer1000 : s.interactionRate;
  const label =
    metric === "hook" ? "vistas por publicación" : useClicks ? "clics o mensajes por cada 1.000 vistas" : "% de interacción";

  if (candidates.some((c) => value(c.summary) == null)) {
    return { leader: null, conclusive: false, message: "Faltan las vistas de alguna publicación para comparar." };
  }
  const ranked = [...candidates].sort((a, b) => (value(b.summary) ?? 0) - (value(a.summary) ?? 0));
  const [first, second] = ranked;
  const a = value(first.summary) ?? 0;
  const b = value(second.summary) ?? 0;
  const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

  const lowViews = candidates.filter((c) => (c.summary.views ?? 0) < MIN_VIEWS_PER_CREATIVE);
  if (lowViews.length > 0) {
    return {
      leader: first.code,
      conclusive: false,
      message: `Va adelante ${first.code} (${fmt(a)} ${label}), pero ${lowViews
        .map((c) => c.code)
        .join(", ")} tiene menos de ${MIN_VIEWS_PER_CREATIVE} vistas: todavía no es concluyente.`,
    };
  }
  if (a === 0 || (b > 0 && a / b < MIN_LEAD)) {
    return {
      leader: first.code,
      conclusive: false,
      message: `${first.code} y ${second.code} están muy parejos (${fmt(a)} frente a ${fmt(b)} ${label}). Publica una vez más cada uno antes de decidir.`,
    };
  }
  return {
    leader: first.code,
    conclusive: true,
    message: `${first.code} gana con ${fmt(a)} ${label} frente a ${fmt(b)} de ${second.code}.`,
  };
}
