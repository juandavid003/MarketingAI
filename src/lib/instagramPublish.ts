// Instagram Reels via the official Content Publishing API:
//   1. POST /{ig-user-id}/media (media_type=REELS, video_url, caption) → container
//   2. Instagram downloads and processes the video (status_code IN_PROGRESS → FINISHED)
//   3. POST /{ig-user-id}/media_publish (creation_id) → published media id
// https://developers.facebook.com/docs/instagram-platform/content-publishing
//
// Needs instagram_content_publish on the token (requested when
// META_REQUEST_IG_PUBLISH is "true", see lib/meta.ts) and a video_url Instagram
// can download — we pass a signed, expiring link (lib/signedMedia.ts).

const GRAPH = `https://graph.facebook.com/${process.env.META_GRAPH_VERSION ?? "v21.0"}`;

export class InstagramPermissionError extends Error {}

type GraphError = { message?: string; code?: number; error_user_msg?: string };

async function call<T>(method: "GET" | "POST", path: string, params: Record<string, string>): Promise<T> {
  const url = new URL(`${GRAPH}${path}`);
  let body: URLSearchParams | undefined;
  if (method === "GET") {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  } else {
    body = new URLSearchParams(params);
  }
  const res = await fetch(url, { method, body, signal: AbortSignal.timeout(60_000) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json?.error) {
    const err: GraphError = json?.error ?? {};
    const message = err.error_user_msg || err.message || `HTTP ${res.status}`;
    if (err.code === 10 || err.code === 200 || /permission/i.test(message)) {
      throw new InstagramPermissionError(
        "Instagram no autorizó la publicación: falta el permiso instagram_content_publish o la cuenta no es profesional. Reconecta Meta después de activarlo."
      );
    }
    throw new Error(`Instagram: ${message}`);
  }
  return json as T;
}

export async function createReelContainer(input: {
  igUserId: string;
  accessToken: string;
  videoUrl: string;
  caption: string;
  coverUrl?: string | null;
}): Promise<string> {
  const params: Record<string, string> = {
    media_type: "REELS",
    video_url: input.videoUrl,
    caption: input.caption.slice(0, 2200),
    share_to_feed: "true",
    access_token: input.accessToken,
  };
  if (input.coverUrl) params.cover_url = input.coverUrl;
  const { id } = await call<{ id: string }>("POST", `/${input.igUserId}/media`, params);
  return id;
}

export type ContainerStatus = "IN_PROGRESS" | "FINISHED" | "ERROR" | "EXPIRED" | "PUBLISHED";

export async function containerStatus(
  containerId: string,
  accessToken: string
): Promise<{ status: ContainerStatus; detail: string }> {
  const r = await call<{ status_code?: string; status?: string }>("GET", `/${containerId}`, {
    fields: "status_code,status",
    access_token: accessToken,
  });
  const status = (r.status_code ?? "IN_PROGRESS") as ContainerStatus;
  return { status, detail: r.status ?? "" };
}

export async function publishContainer(input: {
  igUserId: string;
  accessToken: string;
  containerId: string;
}): Promise<{ mediaId: string; permalink: string | null }> {
  const { id } = await call<{ id: string }>("POST", `/${input.igUserId}/media_publish`, {
    creation_id: input.containerId,
    access_token: input.accessToken,
  });
  let permalink: string | null = null;
  try {
    const m = await call<{ permalink?: string }>("GET", `/${id}`, { fields: "permalink", access_token: input.accessToken });
    permalink = m.permalink ?? null;
  } catch {
    // Published anyway; the permalink is a nice-to-have.
  }
  return { mediaId: id, permalink };
}
