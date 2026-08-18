-- CreateTable
CREATE TABLE "SocialConnection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'meta',
    "accessToken" TEXT NOT NULL,
    "tokenExpiresAt" DATETIME,
    "metaUserId" TEXT NOT NULL,
    "metaUserName" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SocialConnection_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SocialPage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "connectionId" TEXT NOT NULL,
    "facebookPageId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "pageAccessToken" TEXT NOT NULL,
    "instagramAccountId" TEXT,
    "instagramUsername" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SocialPage_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "SocialConnection" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "SocialConnection_businessId_key" ON "SocialConnection"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "SocialPage_connectionId_facebookPageId_key" ON "SocialPage"("connectionId", "facebookPageId");
