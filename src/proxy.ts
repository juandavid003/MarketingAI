import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

// Optimistic check only (cookie presence, no DB round-trip) — Next.js 16
// renamed middleware.ts to proxy.ts, same mechanism. The real checks
// (valid session, active subscription, business ownership) happen in
// src/lib/dal.ts, close to the data, per Next's own auth guidance: this
// file alone is never a full authorization solution.
const AUTH_PAGES = ["/login", "/signup", "/forgot-password", "/reset-password"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = Boolean(getSessionCookie(request));

  const isProtected = pathname.startsWith("/onboarding") || pathname.startsWith("/business");
  if (isProtected && !hasSession) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const isAuthPage = AUTH_PAGES.some((page) => pathname.startsWith(page));
  if (isAuthPage && hasSession) {
    return NextResponse.redirect(new URL("/onboarding", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|.*\\..*).*)"],
};
