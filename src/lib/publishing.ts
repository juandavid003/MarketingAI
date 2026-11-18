// Shared vocabulary for the Publicaciones module (UI + actions). The runner
// is lib/jobs/publishJobs.ts.

export const MANUAL_PLATFORMS = [
  { value: "tiktok", label: "TikTok" },
  { value: "youtube", label: "YouTube Shorts" },
  { value: "instagram", label: "Instagram (lo publico yo)" },
  { value: "facebook", label: "Facebook (lo publico yo)" },
  { value: "other", label: "Otra red" },
] as const;

export const JOB_STATUS: Record<string, { label: string; tone: "neutral" | "warning" | "success" | "danger" | "brand" }> = {
  scheduled: { label: "Programada", tone: "brand" },
  publishing: { label: "Publicando…", tone: "warning" },
  published: { label: "Publicada", tone: "success" },
  failed: { label: "Con error", tone: "danger" },
  canceled: { label: "Cancelada", tone: "neutral" },
};

export function platformName(platform: string): string {
  return (
    { facebook: "Facebook", instagram: "Instagram", tiktok: "TikTok", youtube: "YouTube Shorts", other: "Otra red" }[platform] ??
    platform
  );
}

// Destination field: "fb:<socialPageId>", "ig:<socialPageId>" or "manual:<platform>".
export function parseDestination(raw: string):
  | { target: "facebook_page" | "instagram_reels"; socialPageId: string; platform: "facebook" | "instagram" }
  | { target: "manual"; platform: string }
  | null {
  const [kind, value] = raw.split(":", 2);
  if (!value) return null;
  if (kind === "fb") return { target: "facebook_page", socialPageId: value, platform: "facebook" };
  if (kind === "ig") return { target: "instagram_reels", socialPageId: value, platform: "instagram" };
  if (kind === "manual" && MANUAL_PLATFORMS.some((p) => p.value === value)) return { target: "manual", platform: value };
  return null;
}

// "2026-11-20T18:30" typed in the owner's browser + its getTimezoneOffset()
// (minutes, UTC − local) → the UTC instant.
export function localInputToUtc(local: string, tzOffsetMinutes: number): Date | null {
  const m = local.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!m || !Number.isFinite(tzOffsetMinutes) || Math.abs(tzOffsetMinutes) > 14 * 60) return null;
  const utc = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5])) + tzOffsetMinutes * 60_000;
  const d = new Date(utc);
  return Number.isNaN(d.getTime()) ? null : d;
}

export const IG_PUBLISH_ENABLED = process.env.META_REQUEST_IG_PUBLISH === "true";
