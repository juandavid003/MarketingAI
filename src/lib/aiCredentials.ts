import "server-only";
import { decryptSecret } from "@/lib/crypto";
import type { AiProvider } from "@/lib/ai";
import type { AiCredentials } from "@/lib/contentAi";

// Each business brings its own AI keys (docs/PRODUCT_VISION.md); these
// resolve them, or return null when not configured.

export function businessAi(business: {
  aiProvider: string | null;
  aiApiKeyEncrypted: string | null;
  aiModel: string | null;
}): AiCredentials | null {
  if (!business.aiProvider || !business.aiApiKeyEncrypted) return null;
  return {
    provider: business.aiProvider as AiProvider,
    apiKey: decryptSecret(business.aiApiKeyEncrypted),
    model: business.aiModel,
  };
}

// Whisper is OpenAI-only. If the business already uses OpenAI for text, that
// key works for transcription too.
export function transcriptionKey(business: {
  aiProvider: string | null;
  aiApiKeyEncrypted: string | null;
  openaiTranscriptionKeyEncrypted: string | null;
}): string | null {
  if (business.openaiTranscriptionKeyEncrypted) return decryptSecret(business.openaiTranscriptionKeyEncrypted);
  if (business.aiProvider === "openai" && business.aiApiKeyEncrypted) return decryptSecret(business.aiApiKeyEncrypted);
  return null;
}

// Keys usable for "Editar con IA" (lib/aiVideoEdit.ts), per provider: Claude
// needs the business's text key to be Anthropic's; any saved OpenAI key works
// for OpenAI; Gemini uses the visual-review key.
export function videoEditKeys(business: {
  aiProvider: string | null;
  aiApiKeyEncrypted: string | null;
  openaiTranscriptionKeyEncrypted: string | null;
  openaiImageKeyEncrypted: string | null;
  geminiApiKeyEncrypted: string | null;
}): Record<"anthropic" | "openai" | "gemini", string | null> {
  const enc = (v: string | null) => (v ? decryptSecret(v) : null);
  return {
    anthropic: business.aiProvider === "anthropic" ? enc(business.aiApiKeyEncrypted) : null,
    openai:
      transcriptionKey(business) ?? enc(business.openaiImageKeyEncrypted),
    gemini: enc(business.geminiApiKeyEncrypted),
  };
}
