import { NextRequest, NextResponse } from "next/server";
import { publicBaseUrl } from "@/lib/links";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { businessAccessForUser, type SessionUser } from "@/lib/dal";
import { audit } from "@/lib/audit";
import { encryptToken } from "@/lib/crypto";
import {
  exchangeCodeForToken,
  exchangeForLongLivedToken,
  fetchMe,
  fetchPages,
} from "@/lib/meta";

const STATE_COOKIE = "meta_oauth_state";

function redirectWithError(request: NextRequest, businessId: string | null, message: string) {
  const target = businessId ? `/business/${businessId}/connections` : "/start";
  // Not request.url: behind the reverse proxy it is the container address
  // (https://localhost:3000), so redirects must use the public URL.
  const url = new URL(target, publicBaseUrl());
  url.searchParams.set("meta_error", message);
  const response = NextResponse.redirect(url);
  response.cookies.delete(STATE_COOKIE);
  return response;
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const state = params.get("state");
  const code = params.get("code");
  const oauthError = params.get("error_description") ?? params.get("error");

  const stateBusinessId = state?.split(":")[0] ?? null;

  if (oauthError) {
    return redirectWithError(request, stateBusinessId, oauthError);
  }

  const cookieState = request.cookies.get(STATE_COOKIE)?.value;
  if (!state || !code || !cookieState || cookieState !== state) {
    return redirectWithError(request, stateBusinessId, "No se pudo verificar la solicitud de conexión.");
  }

  const [businessId] = state.split(":");
  // The state cookie already ties this callback to the browser that started
  // it; also require that the signed-in user may still manage connections.
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session || !(await businessAccessForUser(session.user as SessionUser, businessId, "manage_connections"))) {
    return redirectWithError(request, null, "Negocio no encontrado.");
  }

  try {
    const shortLived = await exchangeCodeForToken(code);
    const longLived = await exchangeForLongLivedToken(shortLived.access_token);
    const me = await fetchMe(longLived.access_token);
    const pages = await fetchPages(longLived.access_token);

    const expiresAt = longLived.expires_in
      ? new Date(Date.now() + longLived.expires_in * 1000)
      : null;

    await prisma.socialConnection.upsert({
      where: { businessId },
      create: {
        businessId,
        provider: "meta",
        accessToken: encryptToken(longLived.access_token),
        tokenExpiresAt: expiresAt,
        metaUserId: me.id,
        metaUserName: me.name,
        pages: {
          create: pages.map((page) => ({
            facebookPageId: page.id,
            name: page.name,
            pageAccessToken: encryptToken(page.access_token),
            instagramAccountId: page.instagram_business_account?.id,
            instagramUsername: page.instagram_business_account?.username,
          })),
        },
      },
      update: {
        accessToken: encryptToken(longLived.access_token),
        tokenExpiresAt: expiresAt,
        metaUserId: me.id,
        metaUserName: me.name,
        pages: {
          deleteMany: {},
          create: pages.map((page) => ({
            facebookPageId: page.id,
            name: page.name,
            pageAccessToken: encryptToken(page.access_token),
            instagramAccountId: page.instagram_business_account?.id,
            instagramUsername: page.instagram_business_account?.username,
          })),
        },
      },
    });

    await audit({
      action: "meta.connected",
      actor: session.user,
      businessId,
      details: { metaUser: me.name, pages: pages.length },
    });

    const url = new URL(`/business/${businessId}/connections`, publicBaseUrl());
    url.searchParams.set("connected", "1");
    const response = NextResponse.redirect(url);
    response.cookies.delete(STATE_COOKIE);
    return response;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido al conectar con Meta.";
    return redirectWithError(request, businessId, message);
  }
}
