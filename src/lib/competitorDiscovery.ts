// Instagram Business Discovery: public data of OTHER Business/Creator
// accounts, read through the business's own connected Instagram account.
// Official endpoint — no scraping:
//   GET /{own-ig-user-id}?fields=business_discovery.username(<target>){...}
// https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/business_discovery
//
// Requirements (per Meta's docs, checked 2026-11-18): a token with
// instagram_basic + instagram_manage_insights + pages_read_engagement.
// instagram_manage_insights is only requested when META_REQUEST_IG_INSIGHTS
// is "true" (lib/meta.ts) — it must first be enabled for the app in Meta's
// dashboard, otherwise the OAuth dialog rejects the whole login.
//
// Limits: only Business/Creator accounts; age-gated accounts return nothing;
// like_count can be missing when the owner hides likes. No reach or views of
// other accounts are available, so we never show them.

const GRAPH_VERSION = process.env.META_GRAPH_VERSION ?? "v21.0";

export class DiscoveryPermissionError extends Error {}
export class DiscoveryNotFoundError extends Error {}

export type DiscoveredMedia = {
  id: string;
  caption?: string;
  media_type?: string;
  media_product_type?: string;
  permalink?: string;
  timestamp?: string;
  like_count?: number;
  comments_count?: number;
};

export type DiscoveredAccount = {
  username: string;
  followersCount: number | null;
  mediaCount: number | null;
  media: DiscoveredMedia[];
};

export function normalizeInstagramUsername(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  // Accept "@name", "name", or a profile URL.
  const fromUrl = trimmed.match(/instagram\.com\/([A-Za-z0-9._]+)/i)?.[1];
  const candidate = (fromUrl ?? trimmed).replace(/^@/, "").replace(/\/$/, "");
  return /^[A-Za-z0-9._]{1,30}$/.test(candidate) ? candidate.toLowerCase() : null;
}

export async function discoverInstagramAccount(input: {
  ownIgUserId: string;
  pageAccessToken: string;
  username: string;
  mediaLimit?: number;
}): Promise<DiscoveredAccount> {
  const limit = input.mediaLimit ?? 25;
  const fields = `business_discovery.username(${input.username}){username,followers_count,media_count,media.limit(${limit}){id,caption,media_type,media_product_type,permalink,timestamp,like_count,comments_count}}`;
  const url = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/${input.ownIgUserId}`);
  url.searchParams.set("fields", fields);
  url.searchParams.set("access_token", input.pageAccessToken);

  const res = await fetch(url.toString());
  const json = await res.json();
  if (!res.ok) {
    const message: string = json?.error?.message ?? JSON.stringify(json);
    const code = json?.error?.code;
    if (code === 10 || code === 200 || /permission/i.test(message)) {
      throw new DiscoveryPermissionError(message);
    }
    if (code === 110 || code === 100 || /cannot be found|does not exist|invalid user/i.test(message)) {
      throw new DiscoveryNotFoundError(message);
    }
    throw new Error(`Instagram Business Discovery: ${message}`);
  }

  const bd = json?.business_discovery;
  if (!bd) throw new DiscoveryNotFoundError("Sin datos para esa cuenta.");
  return {
    username: bd.username ?? input.username,
    followersCount: typeof bd.followers_count === "number" ? bd.followers_count : null,
    mediaCount: typeof bd.media_count === "number" ? bd.media_count : null,
    media: Array.isArray(bd.media?.data) ? (bd.media.data as DiscoveredMedia[]) : [],
  };
}

// Reels come back as media_type VIDEO + media_product_type REELS.
export function mediaFormat(m: { media_type?: string; media_product_type?: string }): string {
  if (m.media_product_type === "REELS") return "REELS";
  return m.media_type ?? "DESCONOCIDO";
}
