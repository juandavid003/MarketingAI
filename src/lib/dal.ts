import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { accountActive, can, resolveBusinessAccess, type Permission } from "@/lib/access";

// Real session check against the database (not just the optimistic cookie
// check in proxy.ts) — this is the check close to the data, per Next.js's
// own auth guidance: proxy.ts alone is not a full authorization solution.
export const requireUser = cache(async () => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect("/login");
  }
  return session.user;
});

// No payment gateway in this version — access is a manual on/off switch the
// admin flips from /admin once a client's bank transfer arrives. Admins are
// always treated as enabled.
export const requireEnabledAccount = cache(async () => {
  const user = await requireUser();
  if (!accountActive(user)) {
    redirect("/pending");
  }
  return user;
});

export const requireAdmin = cache(async () => {
  const user = await requireUser();
  if (user.role !== "admin") {
    notFound();
  }
  return user;
});

// The one function every business-scoped page/action should call first.
// Composes auth + owner/member check + the owner's paid status, so a client
// can never reach, read, or mutate another client's business. Rules live in
// lib/access.ts. `permission` defaults to "work" (what managers can do);
// owner-only actions pass e.g. "manage_settings".
export async function requireBusinessAccess(businessId: string, permission: Permission = "work") {
  const user = await requireUser();
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    include: {
      user: { select: { role: true, enabled: true } },
      members: { where: { userId: user.id }, select: { userId: true, acceptedAt: true }, take: 1 },
    },
  });
  if (!business) notFound();

  const decision = resolveBusinessAccess(user, business, business.user, business.members[0] ?? null);
  if (!decision.ok) {
    if (decision.reason === "owner_not_enabled" && business.userId === user.id) redirect("/pending");
    notFound();
  }
  if (!can(decision.role, permission)) notFound();

  const { user: _owner, members: _members, ...plain } = business;
  void _owner;
  void _members;
  return { user, business: plain, role: decision.role };
}

// Better Auth's session user, with our additionalFields (lib/auth.ts).
export type SessionUser = { id: string; email: string; role: string; enabled: boolean };

// Same rules for route handlers, which must answer 404 instead of
// redirecting. Returns null when the user may not use the business.
export async function businessAccessForUser(
  user: SessionUser,
  businessId: string,
  permission: Permission = "work"
) {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: {
      userId: true,
      user: { select: { role: true, enabled: true } },
      members: { where: { userId: user.id }, select: { userId: true, acceptedAt: true }, take: 1 },
    },
  });
  if (!business) return null;
  const decision = resolveBusinessAccess(user, business, business.user, business.members[0] ?? null);
  if (!decision.ok || !can(decision.role, permission)) return null;
  return { role: decision.role };
}

// Businesses the user can open: their own (when their account is active)
// plus the ones they manage for an active owner.
export async function listAccessibleBusinesses(user: { id: string; role: string; enabled: boolean }) {
  const businesses = await prisma.business.findMany({
    where: {
      OR: [{ userId: user.id }, { members: { some: { userId: user.id, acceptedAt: { not: null } } } }],
    },
    select: {
      id: true,
      name: true,
      industry: true,
      userId: true,
      isDemo: true,
      user: { select: { role: true, enabled: true } },
      members: { where: { userId: user.id }, select: { userId: true, acceptedAt: true }, take: 1 },
    },
    orderBy: { createdAt: "desc" },
  });
  return businesses.flatMap((b) => {
    const decision = resolveBusinessAccess(user, b, b.user, b.members[0] ?? null);
    return decision.ok ? [{ id: b.id, name: b.name, industry: b.industry, isDemo: b.isDemo, role: decision.role }] : [];
  });
}
