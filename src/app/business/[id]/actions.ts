"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

export async function disconnectMeta(businessId: string) {
  await prisma.socialConnection.deleteMany({ where: { businessId } });
  revalidatePath(`/business/${businessId}`);
}
