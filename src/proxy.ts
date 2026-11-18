import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

// Optimistic check only (cookie presence, no DB round-trip) — Next.js 16
// renamed middleware.ts to proxy.ts, same mechanism. The real checks
// (valid session, enabled account, business ownership) happen in
// src/lib/dal.ts, close to the data, per Next's own auth guidance: this
// file alone is never a full authorization solution.
//
// Deliberately one-directional: only protects private routes when there's
// no cookie at all. An earlier version also bounced /login and /signup to
// /onboarding whenever a cookie was present — but "cookie present" doesn't
// mean "session still valid" (expired/cleared server-side, secret rotated,
// etc.), and dal.ts's requireUser() redirects an invalid session back to
// /login. Combined, those two redirects fought each other into an infinite
// /login <-> /onboarding loop (blank tab, ERR_TOO_MANY_REDIRECTS) for
// anyone with a stale cookie. Auth pages just render now regardless of
// cookie state; a real login overwrites the stale cookie either way.
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = Boolean(getSessionCookie(request));

  const isProtected =
    pathname.startsWith("/onboarding") ||
    pathname.startsWith("/start") ||
    pathname.startsWith("/business") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/pending");
  if (isProtected && !hasSession) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|.*\\..*).*)"],
};
