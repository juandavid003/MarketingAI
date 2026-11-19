"use server";

import { prisma } from "@/lib/prisma";
import { requireUser, businessAccessForUser, type SessionUser } from "@/lib/dal";

const KINDS = new Set(["idea", "problem", "praise"]);

export type FeedbackState = { ok?: boolean; error?: string };

export async function sendFeedback(_prev: FeedbackState, formData: FormData): Promise<FeedbackState> {
  const user = await requireUser();
  const message = String(formData.get("message") ?? "").trim();
  const kindRaw = String(formData.get("kind") ?? "idea");
  const kind = KINDS.has(kindRaw) ? kindRaw : "idea";
  const path = String(formData.get("path") ?? "").slice(0, 300) || null;
  const businessIdRaw = String(formData.get("businessId") ?? "");

  if (message.length < 3) return { error: "Escribe un poco más." };
  if (message.length > 4000) return { error: "Máximo 4000 caracteres." };

  // Only attach a business the user can actually see.
  const businessId =
    businessIdRaw && (await businessAccessForUser(user as SessionUser, businessIdRaw)) ? businessIdRaw : null;

  await prisma.feedback.create({
    data: { userId: user.id, userEmail: user.email, businessId, path, kind, message },
  });
  return { ok: true };
}
