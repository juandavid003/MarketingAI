-- CreateTable
CREATE TABLE "AdCampaign" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT NOT NULL,
    "contentIndex" INTEGER NOT NULL,
    "metaCampaignId" TEXT NOT NULL,
    "metaAdSetId" TEXT NOT NULL,
    "metaAdId" TEXT NOT NULL,
    "metaCreativeId" TEXT NOT NULL,
    "dailyBudgetCents" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'paused',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AdCampaign_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MetaAdAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "connectionId" TEXT NOT NULL,
    "adAccountId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MetaAdAccount_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "SocialConnection" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "AdCampaign_campaignId_contentIndex_key" ON "AdCampaign"("campaignId", "contentIndex");

-- CreateIndex
CREATE UNIQUE INDEX "MetaAdAccount_connectionId_key" ON "MetaAdAccount"("connectionId");
