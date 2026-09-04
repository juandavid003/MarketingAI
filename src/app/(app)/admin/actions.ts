"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/dal";

export async function setClientEnabled(userId: string, enabled: boolean) {
  await requireAdmin();

  await prisma.user.updateMany({
    where: { id: userId, role: "client" },
    data: { enabled },
  });

  revalidatePath("/admin");
}
