const GRAPH_VERSION = process.env.META_GRAPH_VERSION ?? "v21.0";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

// Instagram scopes (instagram_basic, instagram_manage_insights) are added back
// once the Instagram product is enabled on the Meta app and the account is
// registered as an Instagram Tester in dev mode.
export const META_SCOPES = [
  "pages_show_list",
  "pages_read_engagement",
  "business_management",
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
