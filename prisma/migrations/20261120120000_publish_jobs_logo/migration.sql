-- AlterTable
ALTER TABLE "Business" ADD COLUMN     "logoPath" TEXT;

-- CreateTable
CREATE TABLE "PublishJob" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "videoVersionId" TEXT NOT NULL,
    "planItemId" TEXT,
    "target" TEXT NOT NULL,
    "socialPageId" TEXT,
    "platform" TEXT NOT NULL,
    "caption" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3),
    "lastError" TEXT,
    "externalId" TEXT,
    "permalink" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PublishJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PublishJob_status_scheduledAt_idx" ON "PublishJob"("status", "scheduledAt");

-- CreateIndex
CREATE INDEX "PublishJob_businessId_scheduledAt_idx" ON "PublishJob"("businessId", "scheduledAt");

-- AddForeignKey
ALTER TABLE "PublishJob" ADD CONSTRAINT "PublishJob_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublishJob" ADD CONSTRAINT "PublishJob_videoVersionId_fkey" FOREIGN KEY ("videoVersionId") REFERENCES "VideoVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublishJob" ADD CONSTRAINT "PublishJob_planItemId_fkey" FOREIGN KEY ("planItemId") REFERENCES "ContentPlanItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

