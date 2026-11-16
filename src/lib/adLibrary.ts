const GRAPH_VERSION = process.env.META_GRAPH_VERSION ?? "v21.0";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

// The Ad Library is public transparency data — unlike everything else in
// lib/meta.ts, it needs no per-business OAuth token, just our own app's
// credentials as an app access token. This is how we can see a competitor's
// active ads without ever having a token for their Page.
//
// In practice ads_archive still rejects a plain app token with "Application
// does not have permission for this action" until the app itself requests
// Ad Library API access (a Standard/Advanced Access feature, same gate as
// pages_manage_posts and likes.summary elsewhere in this app) — confirmed
// against this app's own credentials, not just a theoretical caveat.
function appAccessToken(): string {
  return `${requireEnv("META_APP_ID")}|${requireEnv("META_APP_SECRET")}`;
}

// business.location is free text ("Quito, Ecuador"), but ad_reached_countries
// needs an ISO 3166-1 alpha-2 code. Best-effort keyword match; defaults to EC
// since that's this app's current user base — a business elsewhere should
// still get results, just not geo-narrowed correctly until this map grows.
const COUNTRY_CODE_BY_KEYWORD: Record<string, string> = {
  ecuador: "EC",
  méxico: "MX",
  mexico: "MX",
  colombia: "CO",
  perú: "PE",
  peru: "PE",
  chile: "CL",
  argentina: "AR",
  "estados unidos": "US",
  usa: "US",
  españa: "ES",
  spain: "ES",
};

export function guessCountryCode(location: string): string {
  const lower = location.toLowerCase();
  for (const [keyword, code] of Object.entries(COUNTRY_CODE_BY_KEYWORD)) {
    if (lower.includes(keyword)) return code;
  }
  return "EC";
}

// Public Ad Library web page for a search term — what the business owner can
// always open themselves. We only link to it; we never scrape it.
export function adLibraryWebUrl(searchTerm: string, countryCode: string): string {
  const url = new URL("https://www.facebook.com/ads/library/");
  url.searchParams.set("active_status", "active");
  url.searchParams.set("ad_type", "all");
  url.searchParams.set("country", countryCode);
  url.searchParams.set("q", searchTerm);
  url.searchParams.set("search_type", "keyword_unordered");
  return url.toString();
}

// Thrown when the app hasn't been granted Ad Library API access yet (needs
// Business Verification + the "Ads Library API" product approved by Meta).
export class AdLibraryAccessError extends Error {}

export type AdLibraryAd = {
  id: string;
  pageName: string;
  bodies: string[];
  snapshotUrl: string;
  startedAt: string | null;
};

export async function searchCompetitorAds(
  searchTerm: string,
  countryCode: string,
  limit = 5
): Promise<AdLibraryAd[]> {
  const url = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/ads_archive`);
  url.searchParams.set("access_token", appAccessToken());
  url.searchParams.set("search_terms", searchTerm);
  url.searchParams.set("ad_type", "ALL");
  url.searchParams.set("ad_reached_countries", JSON.stringify([countryCode]));
  url.searchParams.set("ad_active_status", "ACTIVE");
  url.searchParams.set("limit", String(limit));
  url.searchParams.set(
    "fields",
    "id,page_name,ad_creative_bodies,ad_snapshot_url,ad_delivery_start_time"
  );

  const res = await fetch(url.toString());
  const json = await res.json();
  if (!res.ok) {
    const message: string = json?.error?.message ?? JSON.stringify(json);
    const code = json?.error?.code;
    if (code === 10 || code === 200 || /permission/i.test(message)) {
      throw new AdLibraryAccessError(message);
    }
    throw new Error(`Meta Ad Library API error: ${message}`);
  }

  type RawAd = {
    id: string;
    page_name?: string;
    ad_creative_bodies?: string[];
    ad_snapshot_url?: string;
    ad_delivery_start_time?: string;
  };

  return (json.data as RawAd[]).map((ad) => ({
    id: ad.id,
    pageName: ad.page_name ?? searchTerm,
    bodies: ad.ad_creative_bodies ?? [],
    snapshotUrl: ad.ad_snapshot_url ?? "",
    startedAt: ad.ad_delivery_start_time ?? null,
  }));
}
