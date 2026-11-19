import { prisma } from "@/lib/prisma";
import { deleteStored, siblingKey } from "@/lib/storage";
import { audit } from "@/lib/audit";
import { ORIGINAL_RETENTION_DAYS } from "@/lib/usage";

// Deletes the uploaded original (and its extracted audio) of edited videos
// once they've been ready for ORIGINAL_RETENTION_DAYS. The rendered versions
// and thumbnails stay, so nothing the owner publishes or downloads breaks.
//
// Only plain uploads: assembled videos (contentPieceId) and creative renders
// (variantCode) keep originalPath pointing at a render output, and scene
// takes are kept because re-assembling and creatives re-render from them.
export async function cleanupOldOriginals(now: Date = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - ORIGINAL_RETENTION_DAYS * 86_400_000);
  const assets = await prisma.videoAsset.findMany({
    where: {
      contentPieceId: null,
      variantCode: null,
      status: "ready",
      originalDeletedAt: null,
      updatedAt: { lt: cutoff },
      NOT: { originalPath: { startsWith: "/uploads/" } }, // legacy public files: leave alone
    },
    select: { id: true, businessId: true, originalPath: true },
    take: 200,
  });

  let cleaned = 0;
  for (const asset of assets) {
    try {
      await deleteStored(asset.originalPath);
      await deleteStored(siblingKey(asset.originalPath, "audio.mp3")).catch(() => {});
      await prisma.videoAsset.update({ where: { id: asset.id }, data: { originalDeletedAt: now } });
      cleaned++;
    } catch (err) {
      console.error(`[storageCleanup] ${asset.id}`, err);
    }
  }
  if (cleaned > 0) {
    await audit({ action: "storage.originals_cleaned", details: { count: cleaned, retentionDays: ORIGINAL_RETENTION_DAYS } });
  }
  return cleaned;
}
