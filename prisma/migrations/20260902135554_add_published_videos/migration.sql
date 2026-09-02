-- CreateTable
CREATE TABLE "PublishedVideo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "videoVersionId" TEXT NOT NULL,
    "facebookPageId" TEXT NOT NULL,
    "pageName" TEXT NOT NULL,
    "facebookVideoId" TEXT NOT NULL,
    "permalinkUrl" TEXT,
    "message" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PublishedVideo_videoVersionId_fkey" FOREIGN KEY ("videoVersionId") REFERENCES "VideoVersion" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
