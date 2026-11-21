import "server-only";
import { decryptSecret } from "@/lib/crypto";
import { getVideoProvider, resolveVideoModel } from "./index";
import type { VideoGenProvider } from "./types";

export type VideoAi = { provider: VideoGenProvider; apiKey: string; model: string };

// The business's AI video setup, or null when not configured. For Gemini an
// empty video key falls back to the Gemini key saved for visual review.
export function businessVideoAi(business: {
  videoAiProvider: string | null;
  videoAiKeyEncrypted: string | null;
  videoAiModel: string | null;
  geminiApiKeyEncrypted: string | null;
}): VideoAi | null {
  const provider = getVideoProvider(business.videoAiProvider);
  if (!provider) return null;
  const encrypted =
    business.videoAiKeyEncrypted ?? (provider.id === "gemini" ? business.geminiApiKeyEncrypted : null);
  if (!encrypted) return null;
  return { provider, apiKey: decryptSecret(encrypted), model: resolveVideoModel(provider, business.videoAiModel) };
}
