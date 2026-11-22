-- AI video: one key per provider (reusing the Gemini/OpenAI keys already
-- saved), per-provider model choices, and the narration of generated takes.
ALTER TABLE "Business" ADD COLUMN "falApiKeyEncrypted" TEXT;
ALTER TABLE "Business" ADD COLUMN "videoAiModels" TEXT;

-- Carry over anything configured with the previous single-key layout.
UPDATE "Business" SET "falApiKeyEncrypted" = "videoAiKeyEncrypted"
  WHERE "videoAiProvider" = 'fal' AND "videoAiKeyEncrypted" IS NOT NULL;
UPDATE "Business" SET "geminiApiKeyEncrypted" = "videoAiKeyEncrypted"
  WHERE "videoAiProvider" = 'gemini' AND "videoAiKeyEncrypted" IS NOT NULL AND "geminiApiKeyEncrypted" IS NULL;
UPDATE "Business" SET "videoAiModels" = json_build_object("videoAiProvider", "videoAiModel")::text
  WHERE "videoAiProvider" IS NOT NULL AND "videoAiModel" IS NOT NULL;

ALTER TABLE "Business" DROP COLUMN "videoAiKeyEncrypted";
ALTER TABLE "Business" DROP COLUMN "videoAiModel";

ALTER TABLE "SceneTake" ADD COLUMN "aiNarration" TEXT;
