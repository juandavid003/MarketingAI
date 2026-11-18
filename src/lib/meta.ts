import { ADS_ENABLED } from "@/lib/features";

const GRAPH_VERSION = process.env.META_GRAPH_VERSION ?? "v21.0";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

// instagram_manage_insights isn't offered by the "API setup with Facebook
// Login" use-case customizer (only instagram_basic is) — it likely needs App
// Review/Advanced Access, same as the Pages like/comment counts.
//
// pages_manage_posts works without full App Review for Pages the connecting
// account actually administers (Standard Access) — that covers our own
// testing, but a business publishing to a Page it doesn't admin would need
// Advanced Access.
//
// ads_management lets us create/pause/activate campaigns and change budgets
// on ad accounts the connecting user administers (Standard Access, same deal
// as pages_manage_posts) — a business running ads through someone else's ad
// account would need Advanced Access + Business Verification.
//
// ads_management is only requested while paid ads are enabled (frozen for
// now — see lib/features.ts), so App Review doesn't need to cover it yet.
export const META_SCOPES = [
  "pages_show_list",
  "pages_read_engagement",
  "pages_manage_posts",
  "business_management",
  "instagram_basic",
  // Needed by Business Discovery (competitors' public Instagram data, see
  // lib/competitorDiscovery.ts). Opt-in: requesting it before it's enabled
  // for the app in Meta's dashboard makes the OAuth dialog fail entirely.
  ...(process.env.META_REQUEST_IG_INSIGHTS === "true" ? ["instagram_manage_insights"] : []),
  ...(ADS_ENABLED ? ["ads_management"] : []),
].join(",");

export function buildMetaAuthUrl(state: string): string {
  const url = new URL(`https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth`);
  url.searchParams.set("client_id", requireEnv("META_APP_ID"));
  url.searchParams.set("redirect_uri", requireEnv("META_REDIRECT_URI"));
  url.searchParams.set("state", state);
  url.searchParams.set("scope", META_SCOPES);
  url.searchParams.set("response_type", "code");
  return url.toString();
}

type TokenResponse = {
  access_token: string;
  token_type: string;
  expires_in?: number;
};

async function graphGet<T>(path: string, params: Record<string, string>): Promise<T> {
  const url = new URL(`https://graph.facebook.com/${GRAPH_VERSION}${path}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  const res = await fetch(url.toString());
  const json = await res.json();
  if (!res.ok) {
    const message = json?.error?.message ?? JSON.stringify(json);
    throw new Error(`Meta Graph API error (${path}): ${message}`);
  }
  return json as T;
}

async function graphPost<T>(path: string, params: Record<string, string>): Promise<T> {
  const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}${path}`, {
    method: "POST",
    body: new URLSearchParams(params),
  });
  const json = await res.json();
  if (!res.ok) {
    const message = json?.error?.message ?? JSON.stringify(json);
    throw new Error(`Meta Graph API error (${path}): ${message}`);
  }
  return json as T;
}

export async function exchangeCodeForToken(code: string): Promise<TokenResponse> {
  return graphGet<TokenResponse>("/oauth/access_token", {
    client_id: requireEnv("META_APP_ID"),
    client_secret: requireEnv("META_APP_SECRET"),
    redirect_uri: requireEnv("META_REDIRECT_URI"),
    code,
  });
}

export async function exchangeForLongLivedToken(
  shortLivedToken: string
): Promise<TokenResponse> {
  return graphGet<TokenResponse>("/oauth/access_token", {
    grant_type: "fb_exchange_token",
    client_id: requireEnv("META_APP_ID"),
    client_secret: requireEnv("META_APP_SECRET"),
    fb_exchange_token: shortLivedToken,
  });
}

export async function fetchMe(accessToken: string): Promise<{ id: string; name: string }> {
  return graphGet("/me", { access_token: accessToken, fields: "id,name" });
}

export type MetaPage = {
  id: string;
  name: string;
  access_token: string;
  instagram_business_account?: { id: string; username?: string };
};

export async function fetchPages(accessToken: string): Promise<MetaPage[]> {
  const json = await graphGet<{ data: MetaPage[] }>("/me/accounts", {
    access_token: accessToken,
    fields: "id,name,access_token,instagram_business_account{id,username}",
  });
  return json.data;
}

export type PagePost = {
  id: string;
  message?: string;
  created_time: string;
  permalink_url?: string;
  full_picture?: string;
  shares?: { count: number };
};

// Like/comment counts (likes.summary, comments.summary) require Meta's
// "Page Public Content Access" Advanced Access feature, which needs App
// Review + Business Verification even for the page's own admin. Until that's
// done, only post content + share count are readable.
export async function fetchPagePosts(
  pageId: string,
  pageAccessToken: string,
  limit = 10
): Promise<PagePost[]> {
  const json = await graphGet<{ data: PagePost[] }>(`/${pageId}/posts`, {
    access_token: pageAccessToken,
    fields: "message,created_time,permalink_url,full_picture,shares",
    limit: String(limit),
  });
  return json.data;
}

export type InstagramAccount = {
  id: string;
  username: string;
  followers_count?: number;
  media_count?: number;
  profile_picture_url?: string;
};

export async function fetchInstagramAccount(
  igAccountId: string,
  pageAccessToken: string
): Promise<InstagramAccount> {
  return graphGet<InstagramAccount>(`/${igAccountId}`, {
    access_token: pageAccessToken,
    fields: "username,followers_count,media_count,profile_picture_url",
  });
}

export type InstagramMedia = {
  id: string;
  caption?: string;
  timestamp: string;
  media_type?: string;
  permalink?: string;
  like_count?: number;
  comments_count?: number;
};

// Unlike Facebook Pages, Instagram exposes like_count/comments_count under
// just instagram_basic — no Advanced Access wall here.
export async function fetchInstagramMedia(
  igAccountId: string,
  pageAccessToken: string,
  limit = 10
): Promise<InstagramMedia[]> {
  const json = await graphGet<{ data: InstagramMedia[] }>(`/${igAccountId}/media`, {
    access_token: pageAccessToken,
    fields: "caption,timestamp,media_type,permalink,like_count,comments_count",
    limit: String(limit),
  });
  return json.data;
}

export type PublishPhotoResult = {
  postId: string;
  permalinkUrl: string | null;
};

// Uploads the image bytes directly (multipart "source" field) rather than
// requiring a publicly reachable image URL — works from localhost.
export async function publishPagePhoto(
  pageId: string,
  pageAccessToken: string,
  imageBuffer: Buffer,
  caption: string
): Promise<PublishPhotoResult> {
  const form = new FormData();
  form.append("source", new Blob([new Uint8Array(imageBuffer)]), "image.png");
  form.append("caption", caption);
  form.append("access_token", pageAccessToken);

  const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${pageId}/photos`, {
    method: "POST",
    body: form,
  });
  const json = await res.json();
  if (!res.ok) {
    const message = json?.error?.message ?? JSON.stringify(json);
    throw new Error(`Meta Graph API error (/${pageId}/photos): ${message}`);
  }

  const postId: string = json.post_id ?? json.id;

  let permalinkUrl: string | null = null;
  try {
    const photoId: string = json.id;
    const details = await graphGet<{ permalink_url?: string }>(`/${photoId}`, {
      access_token: pageAccessToken,
      fields: "permalink_url",
    });
    permalinkUrl = details.permalink_url ?? null;
  } catch {
    // Non-fatal: the post succeeded even if we couldn't resolve its permalink.
  }

  return { postId, permalinkUrl };
}

export type PublishVideoResult = {
  videoId: string;
  permalinkUrl: string | null;
};

// Same direct multipart upload as publishPagePhoto — fine for the short
// vertical clips this app produces. Larger files would need the resumable
// upload session API (start/transfer/finish) instead of this single POST.
export async function publishPageVideo(
  pageId: string,
  pageAccessToken: string,
  videoBuffer: Buffer,
  caption: string
): Promise<PublishVideoResult> {
  const form = new FormData();
  form.append("source", new Blob([new Uint8Array(videoBuffer)]), "video.mp4");
  form.append("description", caption);
  form.append("access_token", pageAccessToken);

  const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${pageId}/videos`, {
    method: "POST",
    body: form,
  });
  const json = await res.json();
  if (!res.ok) {
    const message = json?.error?.message ?? JSON.stringify(json);
    throw new Error(`Meta Graph API error (/${pageId}/videos): ${message}`);
  }

  const videoId: string = json.id;

  let permalinkUrl: string | null = null;
  try {
    const details = await graphGet<{ permalink_url?: string }>(`/${videoId}`, {
      access_token: pageAccessToken,
      fields: "permalink_url",
    });
    permalinkUrl = details.permalink_url ?? null;
  } catch {
    // Non-fatal: the upload succeeded even if we couldn't resolve its permalink.
  }

  return { videoId, permalinkUrl };
}

export type PostEngagement = {
  shares: number;
  likes: number | null;
  comments: number | null;
};

// shares is readable on a page's own posts without Advanced Access (see
// fetchPagePosts above); likes.summary/comments.summary need "Page Public
// Content Access", so they're fetched separately and tolerated as
// unavailable (null) rather than failing the whole call.
export async function fetchPostEngagement(
  postId: string,
  pageAccessToken: string
): Promise<PostEngagement> {
  const base = await graphGet<{ shares?: { count: number } }>(`/${postId}`, {
    access_token: pageAccessToken,
    fields: "shares",
  });

  let likes: number | null = null;
  let comments: number | null = null;
  try {
    const summary = await graphGet<{
      likes?: { summary?: { total_count: number } };
      comments?: { summary?: { total_count: number } };
    }>(`/${postId}`, {
      access_token: pageAccessToken,
      fields: "likes.summary(true),comments.summary(true)",
    });
    likes = summary.likes?.summary?.total_count ?? null;
    comments = summary.comments?.summary?.total_count ?? null;
  } catch {
    // Advanced Access gate — non-fatal, shares still gives a usable signal.
  }

  return { shares: base.shares?.count ?? 0, likes, comments };
}

// ---------------------------------------------------------------------------
// Marketing API (Meta Ads). Everything this app creates here starts PAUSED —
// setAdSetStatus/setAdStatus are the only calls that can turn spend on, and
// they're only ever invoked from an explicit user click (see
// activateAdCampaign in ads-actions.ts), never automatically.
// ---------------------------------------------------------------------------

export type AdAccount = {
  id: string; // "act_123456789"
  name: string;
  currency: string;
  account_status: number;
};

export async function fetchAdAccounts(accessToken: string): Promise<AdAccount[]> {
  const json = await graphGet<{ data: AdAccount[] }>("/me/adaccounts", {
    access_token: accessToken,
    fields: "id,name,currency,account_status",
  });
  return json.data;
}

export type AdGeoLocation = {
  key: string;
  type: string; // "city" | "region" | "country" | ...
  name: string;
  country_code?: string;
};

// Ad targeting needs a Meta geo key, not free text — resolves business.location
// (e.g. "Quito, Ecuador") to the most specific match Meta's own search returns.
export async function searchAdGeoLocation(
  accessToken: string,
  query: string
): Promise<AdGeoLocation | null> {
  const json = await graphGet<{ data: AdGeoLocation[] }>("/search", {
    access_token: accessToken,
    type: "adgeolocation",
    location_types: JSON.stringify(["city", "region", "country"]),
    q: query,
  });
  return json.data[0] ?? null;
}

export type AdGeoTargeting =
  | { cities: { key: string; radius: number; distance_unit: "kilometer" }[] }
  | { regions: { key: string }[] }
  | { countries: string[] };

export function buildGeoTargeting(location: AdGeoLocation): AdGeoTargeting {
  if (location.type === "city") {
    return { cities: [{ key: location.key, radius: 25, distance_unit: "kilometer" }] };
  }
  if (location.type === "region") {
    return { regions: [{ key: location.key }] };
  }
  return { countries: [location.country_code ?? location.key] };
}

export async function createAdCampaign(
  adAccountId: string,
  accessToken: string,
  name: string
): Promise<string> {
  const json = await graphPost<{ id: string }>(`/${adAccountId}/campaigns`, {
    access_token: accessToken,
    name,
    objective: "OUTCOME_ENGAGEMENT",
    status: "PAUSED",
    special_ad_categories: JSON.stringify([]),
  });
  return json.id;
}

// POST_ENGAGEMENT/IMPRESSIONS needs no pixel or lead form set up, so it works
// for any business regardless of whether they have a website — trades off
// against being a less sales-focused objective than OUTCOME_SALES/LEADS.
export async function createAdSet(
  adAccountId: string,
  accessToken: string,
  params: { name: string; campaignId: string; dailyBudgetCents: number; geoTargeting: AdGeoTargeting }
): Promise<string> {
  const json = await graphPost<{ id: string }>(`/${adAccountId}/adsets`, {
    access_token: accessToken,
    name: params.name,
    campaign_id: params.campaignId,
    daily_budget: String(params.dailyBudgetCents),
    billing_event: "IMPRESSIONS",
    optimization_goal: "POST_ENGAGEMENT",
    bid_strategy: "LOWEST_COST_WITHOUT_CAP",
    targeting: JSON.stringify({ age_min: 18, age_max: 65, geo_locations: params.geoTargeting }),
    status: "PAUSED",
  });
  return json.id;
}

// Reuses the already-published organic post as the ad creative (a "boost")
// via object_story_id, instead of re-uploading the image — see PublishedPost.
export async function createAdCreativeFromPost(
  adAccountId: string,
  accessToken: string,
  pageId: string,
  facebookPostId: string,
  name: string
): Promise<string> {
  const objectStoryId = facebookPostId.includes("_") ? facebookPostId : `${pageId}_${facebookPostId}`;
  const json = await graphPost<{ id: string }>(`/${adAccountId}/adcreatives`, {
    access_token: accessToken,
    name,
    object_story_id: objectStoryId,
  });
  return json.id;
}

export async function createAd(
  adAccountId: string,
  accessToken: string,
  params: { name: string; adSetId: string; creativeId: string }
): Promise<string> {
  const json = await graphPost<{ id: string }>(`/${adAccountId}/ads`, {
    access_token: accessToken,
    name: params.name,
    adset_id: params.adSetId,
    creative: JSON.stringify({ creative_id: params.creativeId }),
    status: "PAUSED",
  });
  return json.id;
}

export async function setAdSetStatus(
  adSetId: string,
  accessToken: string,
  status: "ACTIVE" | "PAUSED"
): Promise<void> {
  await graphPost(`/${adSetId}`, { access_token: accessToken, status });
}

export async function setAdStatus(
  adId: string,
  accessToken: string,
  status: "ACTIVE" | "PAUSED"
): Promise<void> {
  await graphPost(`/${adId}`, { access_token: accessToken, status });
}

export async function updateAdSetDailyBudget(
  adSetId: string,
  accessToken: string,
  dailyBudgetCents: number
): Promise<void> {
  await graphPost(`/${adSetId}`, { access_token: accessToken, daily_budget: String(dailyBudgetCents) });
}

export type AdSetInsights = {
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number | null;
  cpc: number | null;
};

export async function fetchAdSetInsights(
  adSetId: string,
  accessToken: string
): Promise<AdSetInsights | null> {
  const json = await graphGet<{
    data: { spend?: string; impressions?: string; clicks?: string; ctr?: string; cpc?: string }[];
  }>(`/${adSetId}/insights`, {
    access_token: accessToken,
    fields: "spend,impressions,clicks,ctr,cpc",
    date_preset: "last_7d",
  });

  const row = json.data[0];
  if (!row) return null;

  return {
    spend: Number(row.spend ?? 0),
    impressions: Number(row.impressions ?? 0),
    clicks: Number(row.clicks ?? 0),
    ctr: row.ctr != null ? Number(row.ctr) : null,
    cpc: row.cpc != null ? Number(row.cpc) : null,
  };
}
