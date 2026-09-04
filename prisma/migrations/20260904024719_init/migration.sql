-- CreateTable
CREATE TABLE "Business" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "industry" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "targetAudience" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "avgTicket" DOUBLE PRECISION,
    "objective" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "aiProvider" TEXT,
    "aiApiKeyEncrypted" TEXT,
    "aiModel" TEXT,
    "aiConfiguredAt" TIMESTAMP(3),
    "openaiTranscriptionKeyEncrypted" TEXT,
    "openaiImageKeyEncrypted" TEXT,

    CONSTRAINT "Business_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Competitor" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Competitor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "sourceInsight" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PublishedPost" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "contentIndex" INTEGER NOT NULL,
    "facebookPageId" TEXT NOT NULL,
    "pageName" TEXT NOT NULL,
    "facebookPostId" TEXT NOT NULL,
    "permalinkUrl" TEXT,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PublishedPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdCampaign" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "contentIndex" INTEGER NOT NULL,
    "metaCampaignId" TEXT NOT NULL,
    "metaAdSetId" TEXT NOT NULL,
    "metaAdId" TEXT NOT NULL,
    "metaCreativeId" TEXT NOT NULL,
    "dailyBudgetCents" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'paused',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignImage" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "contentIndex" INTEGER NOT NULL,
    "prompt" TEXT NOT NULL,
    "imagePath" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CampaignImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Storyboard" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "contentIndex" INTEGER NOT NULL,
    "hook" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "scenes" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Storyboard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VideoAsset" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "originalFilename" TEXT NOT NULL,
    "originalPath" TEXT NOT NULL,
    "durationSeconds" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'uploaded',
    "transcript" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VideoAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VideoVersion" (
    "id" TEXT NOT NULL,
    "videoAssetId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "outputPath" TEXT NOT NULL,
    "thumbnailPath" TEXT,
    "hook" TEXT,
    "cta" TEXT,
    "startSeconds" DOUBLE PRECISION NOT NULL,
    "endSeconds" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VideoVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PublishedVideo" (
    "id" TEXT NOT NULL,
    "videoVersionId" TEXT NOT NULL,
    "facebookPageId" TEXT NOT NULL,
    "pageName" TEXT NOT NULL,
    "facebookVideoId" TEXT NOT NULL,
    "permalinkUrl" TEXT,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PublishedVideo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SocialConnection" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'meta',
    "accessToken" TEXT NOT NULL,
    "tokenExpiresAt" TIMESTAMP(3),
    "metaUserId" TEXT NOT NULL,
    "metaUserName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SocialConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetaAdAccount" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "adAccountId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MetaAdAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SocialPage" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "facebookPageId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "pageAccessToken" TEXT NOT NULL,
    "instagramAccountId" TEXT,
    "instagramUsername" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SocialPage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdCampaign_campaignId_contentIndex_key" ON "AdCampaign"("campaignId", "contentIndex");

-- CreateIndex
CREATE UNIQUE INDEX "SocialConnection_businessId_key" ON "SocialConnection"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "MetaAdAccount_connectionId_key" ON "MetaAdAccount"("connectionId");

-- CreateIndex
CREATE UNIQUE INDEX "SocialPage_connectionId_facebookPageId_key" ON "SocialPage"("connectionId", "facebookPageId");

-- AddForeignKey
ALTER TABLE "Competitor" ADD CONSTRAINT "Competitor_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublishedPost" ADD CONSTRAINT "PublishedPost_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdCampaign" ADD CONSTRAINT "AdCampaign_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignImage" ADD CONSTRAINT "CampaignImage_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Storyboard" ADD CONSTRAINT "Storyboard_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoAsset" ADD CONSTRAINT "VideoAsset_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoVersion" ADD CONSTRAINT "VideoVersion_videoAssetId_fkey" FOREIGN KEY ("videoAssetId") REFERENCES "VideoAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublishedVideo" ADD CONSTRAINT "PublishedVideo_videoVersionId_fkey" FOREIGN KEY ("videoVersionId") REFERENCES "VideoVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialConnection" ADD CONSTRAINT "SocialConnection_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetaAdAccount" ADD CONSTRAINT "MetaAdAccount_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "SocialConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialPage" ADD CONSTRAINT "SocialPage_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "SocialConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
