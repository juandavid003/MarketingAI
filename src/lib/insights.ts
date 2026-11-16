// Shape of an insight card on the business dashboard.
//
// Insights are ONLY ever derived from real data (see lib/realInsights.ts).
// An earlier version generated "example" insights with seeded-random numbers
// and per-industry hardcoded topics when no data was connected — removed:
// the product must never show invented metrics or competitor data, and must
// not hardcode industry-specific logic. No data → honest empty state.
export type InsightKind = "opportunity" | "problem" | "competitor" | "trend";

export type Insight = {
  kind: InsightKind;
  emoji: string;
  title: string;
  description: string;
  recommendation?: string;
  actionLabel?: string;
  potential?: "Alto" | "Medio" | "Bajo";
};
