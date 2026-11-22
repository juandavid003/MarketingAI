import "server-only";
import { decryptSecret } from "@/lib/crypto";
import { VIDEO_PROVIDERS, getVideoProvider, parseVideoModels, resolveVideoModel } from "./index";
import type { KeySource, VideoGenProvider } from "./types";

export type VideoAi = { provider: VideoGenProvider; apiKey: string; model: string };

export type VideoKeyFields = {
  aiProvider: string | null;
  aiApiKeyEncrypted: string | null;
  openaiImageKeyEncrypted: string | null;
  openaiTranscriptionKeyEncrypted: string | null;
  geminiApiKeyEncrypted: string | null;
  falApiKeyEncrypted: string | null;
  videoAiModels: string | null;
};

// Each provider runs on a key the business already saved: Gemini on the
// visual-review key, fal on its own, OpenAI on any OpenAI key (images,
// text or transcription — same account).
export function encryptedKeyFor(source: KeySource, b: VideoKeyFields): string | null {
  if (source === "gemini") return b.geminiApiKeyEncrypted;
  if (source === "fal") return b.falApiKeyEncrypted;
  return (
    b.openaiImageKeyEncrypted ??
    (b.aiProvider === "openai" ? b.aiApiKeyEncrypted : null) ??
    b.openaiTranscriptionKeyEncrypted
  );
}

// Provider ids the business can use right now (no decryption: safe for pages).
export function availableVideoProviderIds(b: VideoKeyFields): string[] {
  return VIDEO_PROVIDERS.filter((p) => encryptedKeyFor(p.keySource, b) != null).map((p) => p.id);
}

export function businessVideoAi(b: VideoKeyFields, providerId: string): VideoAi | null {
  const provider = getVideoProvider(providerId);
  if (!provider) return null;
  const encrypted = encryptedKeyFor(provider.keySource, b);
  if (!encrypted) return null;
  return {
    provider,
    apiKey: decryptSecret(encrypted),
    model: resolveVideoModel(provider, parseVideoModels(b.videoAiModels)[provider.id]),
  };
}
