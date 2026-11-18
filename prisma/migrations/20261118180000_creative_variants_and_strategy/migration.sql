-- DropIndex
DROP INDEX "SceneTake_contentPieceId_sceneNumber_key";

-- AlterTable
ALTER TABLE "ContentPiece" ADD COLUMN     "strategy" TEXT,
ADD COLUMN     "variantsStatus" TEXT NOT NULL DEFAULT 'idle';

-- AlterTable
ALTER TABLE "SceneTake" ADD COLUMN     "slot" TEXT NOT NULL DEFAULT 'main';

-- AlterTable
ALTER TABLE "VideoAsset" ADD COLUMN     "variantCode" TEXT;

-- CreateTable
CREATE TABLE "CreativeVariant" (
    "id" TEXT NOT NULL,
    "contentPieceId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "hookCode" TEXT NOT NULL,
    "ctaCode" TEXT NOT NULL,
    "renderStatus" TEXT NOT NULL DEFAULT 'idle',
    "renderError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreativeVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VariantResult" (
    "id" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "postUrl" TEXT,
    "postedAt" TIMESTAMP(3),
    "views" INTEGER,
    "likes" INTEGER,
    "comments" INTEGER,
    "shares" INTEGER,
    "saves" INTEGER,
    "clicks" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VariantResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CreativeVariant_contentPieceId_code_key" ON "CreativeVariant"("contentPieceId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "SceneTake_contentPieceId_sceneNumber_slot_key" ON "SceneTake"("contentPieceId", "sceneNumber", "slot");

-- AddForeignKey
ALTER TABLE "CreativeVariant" ADD CONSTRAINT "CreativeVariant_contentPieceId_fkey" FOREIGN KEY ("contentPieceId") REFERENCES "ContentPiece"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VariantResult" ADD CONSTRAINT "VariantResult_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "CreativeVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

