-- AlterTable
ALTER TABLE "Business" ADD COLUMN "openaiTranscriptionKeyEncrypted" TEXT;

-- CreateTable
CREATE TABLE "VideoAsset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "originalFilename" TEXT NOT NULL,
    "originalPath" TEXT NOT NULL,
    "durationSeconds" REAL,
    "status" TEXT NOT NULL DEFAULT 'uploaded',
    "transcript" TEXT,
    "errorMessage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VideoAsset_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VideoVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "videoAssetId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "outputPath" TEXT NOT NULL,
    "thumbnailPath" TEXT,
    "hook" TEXT,
    "cta" TEXT,
    "startSeconds" REAL NOT NULL,
    "endSeconds" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VideoVersion_videoAssetId_fkey" FOREIGN KEY ("videoAssetId") REFERENCES "VideoAsset" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
