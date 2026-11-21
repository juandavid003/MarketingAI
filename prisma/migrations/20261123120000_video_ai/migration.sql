-- AI video generation for scenes (lib/videoGen).
ALTER TABLE "Business" ADD COLUMN "videoAiProvider" TEXT;
ALTER TABLE "Business" ADD COLUMN "videoAiKeyEncrypted" TEXT;
ALTER TABLE "Business" ADD COLUMN "videoAiModel" TEXT;

ALTER TABLE "SceneTake" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'upload';
ALTER TABLE "SceneTake" ADD COLUMN "aiPrompt" TEXT;
ALTER TABLE "SceneTake" ADD COLUMN "aiModel" TEXT;
