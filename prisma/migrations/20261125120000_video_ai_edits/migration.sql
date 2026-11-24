-- "Editar con IA" requests on uploaded videos (lib/jobs/aiVideoEdit.ts).
CREATE TABLE "VideoEdit" (
    "id" TEXT NOT NULL,
    "videoAssetId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "instructions" TEXT,
    "removeSilences" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'planning',
    "errorMessage" TEXT,
    "plan" TEXT,
    "videoVersionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VideoEdit_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "VideoEdit_videoAssetId_idx" ON "VideoEdit"("videoAssetId");

ALTER TABLE "VideoEdit" ADD CONSTRAINT "VideoEdit_videoAssetId_fkey" FOREIGN KEY ("videoAssetId") REFERENCES "VideoAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
