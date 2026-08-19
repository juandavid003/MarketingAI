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
export const META_SCOPES = [
  "pages_show_list",
  "pages_read_engagement",
  "business_management",
  "instagram_basic",
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
