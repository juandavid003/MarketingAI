-- AlterTable
ALTER TABLE "Competitor" ADD COLUMN     "followersCount" INTEGER,
ADD COLUMN     "instagramUsername" TEXT,
ADD COLUMN     "lastSyncedAt" TIMESTAMP(3),
ADD COLUMN     "mediaCount" INTEGER,
ADD COLUMN     "syncError" TEXT;

-- AlterTable
ALTER TABLE "VideoAsset" ADD COLUMN     "contentPieceId" TEXT;

-- AlterTable
ALTER TABLE "VideoVersion" ADD COLUMN     "caption" TEXT;

-- CreateTable
CREATE TABLE "CompetitorPost" (
    "id" TEXT NOT NULL,
    "competitorId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "externalId" TEXT,
    "permalink" TEXT,
    "caption" TEXT,
    "mediaType" TEXT,
    "likeCount" INTEGER,
    "commentsCount" INTEGER,
    "postedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompetitorPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompetitorIdeaBatch" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompetitorIdeaBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentPiece" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "campaignId" TEXT,
    "contentIndex" INTEGER,
    "sourceType" TEXT NOT NULL,
    "sourceSummary" TEXT NOT NULL,
    "sourceRefs" TEXT,
    "purpose" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "hook" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "assemblyStatus" TEXT NOT NULL DEFAULT 'idle',
    "assemblyError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContentPiece_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SceneTake" (
    "id" TEXT NOT NULL,
    "contentPieceId" TEXT NOT NULL,
    "sceneNumber" INTEGER NOT NULL,
    "originalFilename" TEXT NOT NULL,
    "originalPath" TEXT NOT NULL,
    "durationSeconds" DOUBLE PRECISION,
    "hasAudio" BOOLEAN,
    "status" TEXT NOT NULL DEFAULT 'uploaded',
    "transcript" TEXT,
    "keepIntervals" TEXT,
    "review" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SceneTake_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CompetitorPost_competitorId_externalId_key" ON "CompetitorPost"("competitorId", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "SceneTake_contentPieceId_sceneNumber_key" ON "SceneTake"("contentPieceId", "sceneNumber");

-- AddForeignKey
ALTER TABLE "CompetitorPost" ADD CONSTRAINT "CompetitorPost_competitorId_fkey" FOREIGN KEY ("competitorId") REFERENCES "Competitor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitorIdeaBatch" ADD CONSTRAINT "CompetitorIdeaBatch_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentPiece" ADD CONSTRAINT "ContentPiece_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentPiece" ADD CONSTRAINT "ContentPiece_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SceneTake" ADD CONSTRAINT "SceneTake_contentPieceId_fkey" FOREIGN KEY ("contentPieceId") REFERENCES "ContentPiece"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoAsset" ADD CONSTRAINT "VideoAsset_contentPieceId_fkey" FOREIGN KEY ("contentPieceId") REFERENCES "ContentPiece"("id") ON DELETE SET NULL ON UPDATE CASCADE;

