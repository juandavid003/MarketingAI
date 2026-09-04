import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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

export const requireActiveSubscription = cache(async () => {
  const user = await requireUser();
  const subscriptions = await auth.api.listActiveSubscriptions({
    query: { referenceId: user.id },
    headers: await headers(),
  });
  const active = subscriptions.find(
    (sub) => sub.status === "active" || sub.status === "trialing"
  );
  if (!active) {
    redirect("/pricing");
  }
  return { user, subscription: active };
});

// The one function every business-scoped page/action should call first.
// Composes auth + billing + ownership so a client can never reach, read, or
// mutate another client's business — no route today does this check at all.
export async function requireBusinessAccess(businessId: string) {
  const { user } = await requireActiveSubscription();
  const business = await prisma.business.findUnique({ where: { id: businessId } });
  if (!business || business.userId !== user.id) {
    notFound();
  }
  return { user, business };
}
