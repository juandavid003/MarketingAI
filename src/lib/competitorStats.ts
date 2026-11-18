// Descriptive stats over a competitor's real posts — no AI, no estimates.
// Everything here is computed only from what was actually read or
// registered; missing metrics stay missing instead of being treated as 0.

export type StatPost = {
  id: string;
  source: string;
  mediaType: string | null;
  likeCount: number | null;
  commentsCount: number | null;
  postedAt: Date | null;
};

export const FORMAT_LABEL: Record<string, string> = {
  REELS: "Reel",
  VIDEO: "Video",
  IMAGE: "Imagen",
  CAROUSEL_ALBUM: "Carrusel",
};

export function formatLabel(mediaType: string | null): string {
  return mediaType ? (FORMAT_LABEL[mediaType] ?? mediaType) : "Sin formato";
}

export function interactions(p: { likeCount: number | null; commentsCount: number | null }): number | null {
  if (p.likeCount == null && p.commentsCount == null) return null;
  return (p.likeCount ?? 0) + (p.commentsCount ?? 0);
}

export type CompetitorStats = {
  postCount: number;
  postsPerWeek: number | null; // only when ≥ 2 dated posts
  windowDays: number | null;
  formats: { format: string; count: number; avgInteractions: number | null }[];
  avgInteractions: number | null;
  engagementRate: number | null; // avg interactions / followers
  top: StatPost[];
};

export function competitorStats(posts: StatPost[], followersCount: number | null): CompetitorStats {
  const dated = posts
    .map((p) => p.postedAt?.getTime())
    .filter((t): t is number => typeof t === "number")
    .sort((a, b) => a - b);

  let postsPerWeek: number | null = null;
  let windowDays: number | null = null;
  if (dated.length >= 2) {
    const spanDays = Math.max(1, (dated[dated.length - 1] - dated[0]) / 86_400_000);
    windowDays = Math.round(spanDays);
    postsPerWeek = Math.round(((dated.length - 1) / spanDays) * 7 * 10) / 10;
  }

  const avg = (values: number[]) =>
    values.length > 0 ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : null;

  const withInteractions = posts.filter((p) => interactions(p) != null);
  const avgInteractions = avg(withInteractions.map((p) => interactions(p)!));

  const byFormat = new Map<string, StatPost[]>();
  for (const p of posts) {
    const key = formatLabel(p.mediaType);
    byFormat.set(key, [...(byFormat.get(key) ?? []), p]);
  }
  const formats = [...byFormat.entries()]
    .map(([format, list]) => ({
      format,
      count: list.length,
      avgInteractions: avg(list.map(interactions).filter((n): n is number => n != null)),
    }))
    .sort((a, b) => b.count - a.count);

  const engagementRate =
    avgInteractions != null && followersCount && followersCount > 0
      ? Math.round((avgInteractions / followersCount) * 10000) / 100
      : null;

  const top = [...withInteractions].sort((a, b) => interactions(b)! - interactions(a)!).slice(0, 3);

  return { postCount: posts.length, postsPerWeek, windowDays, formats, avgInteractions, engagementRate, top };
}
