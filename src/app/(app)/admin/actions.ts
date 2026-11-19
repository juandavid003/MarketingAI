"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/dal";
import { audit } from "@/lib/audit";

export async function setClientEnabled(userId: string, enabled: boolean) {
  const admin = await requireAdmin();

  const { count } = await prisma.user.updateMany({
    where: { id: userId, role: "client" },
    data: { enabled },
  });
  if (count > 0) {
    await audit({ action: enabled ? "account.enabled" : "account.disabled", actor: admin, target: userId });
  }

  revalidatePath("/admin");
}

export async function markFeedbackRead(feedbackId: string) {
  await requireAdmin();
  await prisma.feedback.updateMany({ where: { id: feedbackId }, data: { status: "read" } });
  revalidatePath("/admin");
}
