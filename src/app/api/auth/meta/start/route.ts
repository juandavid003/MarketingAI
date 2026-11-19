import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { businessAccessForUser, type SessionUser } from "@/lib/dal";
import { buildMetaAuthUrl } from "@/lib/meta";
import { auth } from "@/lib/auth";

const STATE_COOKIE = "meta_oauth_state";

export async function GET(request: NextRequest) {
  const businessId = request.nextUrl.searchParams.get("businessId");

  if (!businessId) {
    return NextResponse.json({ error: "Missing businessId" }, { status: 400 });
  }

  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Connecting a network is owner-only (lib/access.ts).
  const access = await businessAccessForUser(session.user as SessionUser, businessId, "manage_connections");
  if (!access) {
    return NextResponse.json({ error: "Business not found" }, { status: 404 });
  }

  const nonce = randomUUID();
  const state = `${businessId}:${nonce}`;

  const response = NextResponse.redirect(buildMetaAuthUrl(state));
  response.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  return response;
}
