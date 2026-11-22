import type { VideoGenProvider } from "./types";
import { geminiProvider } from "./providers/gemini";
import { falProvider } from "./providers/fal";
import { openaiStillProvider } from "./providers/openaiStill";

export type { AspectRatio, KeySource, VideoGenProvider, VideoGenRequest, VideoGenResult } from "./types";
export { VideoGenError } from "./types";

// Registry of AI video providers. To add one: implement VideoGenProvider in
// ./providers/<id>.ts and list it here — Settings, the scene picker, the
// recommendation and the background job read this list.
export const VIDEO_PROVIDERS: VideoGenProvider[] = [geminiProvider, falProvider, openaiStillProvider];

export function getVideoProvider(id: string | null | undefined): VideoGenProvider | null {
  return VIDEO_PROVIDERS.find((p) => p.id === id) ?? null;
}

// Per-provider model overrides chosen by the business, stored as JSON
// ({"fal": "fal-ai/…"}) in Business.videoAiModels.
export function parseVideoModels(raw: string | null | undefined): Record<string, string> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed).filter((e): e is [string, string] => typeof e[1] === "string" && e[1].trim() !== "")
    );
  } catch {
    return {};
  }
}

// Business override → server default (VIDEO_AI_DEFAULT_MODEL_<ID>) → the
// provider's built-in default. The env lets ops move every business that
// didn't pick a model to a new one without changing code.
export function resolveVideoModel(provider: VideoGenProvider, override: string | null | undefined): string {
  const envKey = `VIDEO_AI_DEFAULT_MODEL_${provider.id.toUpperCase().replace(/[^A-Z0-9]/g, "_")}`;
  return override?.trim() || process.env[envKey]?.trim() || provider.defaultModel;
}

export { sceneVideoPrompt, promptWithNarration } from "./prompt";
