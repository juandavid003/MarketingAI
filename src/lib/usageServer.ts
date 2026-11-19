import "server-only";
import { prisma } from "@/lib/prisma";
import { businessStorageBytes } from "@/lib/storage";
import { checkUpload, monthStart, usageLimits, type Usage } from "@/lib/usage";

// Loads a business's current usage (lib/usage.ts has the rules).
// Minutes = uploaded originals (not renders) + scene takes recorded this
// month, by their measured duration.
export async function currentUsage(businessId: string): Promise<Usage> {
  const since = monthStart();
  const [videos, takes, storageBytes] = await Promise.all([
    prisma.videoAsset.aggregate({
      where: { businessId, contentPieceId: null, variantCode: null, createdAt: { gte: since } },
      _sum: { durationSeconds: true },
    }),
    prisma.sceneTake.aggregate({
      where: { contentPiece: { businessId }, updatedAt: { gte: since } },
      _sum: { durationSeconds: true },
    }),
    businessStorageBytes(businessId),
  ]);
  const seconds = (videos._sum.durationSeconds ?? 0) + (takes._sum.durationSeconds ?? 0);
  return { videoMinutes: Math.round((seconds / 60) * 10) / 10, storageBytes };
}

export async function uploadBlockedReason(businessId: string, fileBytes: number): Promise<string | null> {
  return checkUpload(await currentUsage(businessId), usageLimits(), fileBytes);
}
