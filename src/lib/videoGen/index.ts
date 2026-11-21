import type { PieceScene } from "@/lib/contentAi";
import type { AspectRatio, VideoGenProvider } from "./types";
import { geminiProvider } from "./providers/gemini";
import { falProvider } from "./providers/fal";

export type { AspectRatio, VideoGenProvider, VideoGenRequest, VideoGenResult } from "./types";
export { VideoGenError } from "./types";

// Registry of AI video providers. To add one: implement VideoGenProvider in
// ./providers/<id>.ts and list it here — Settings, the scene button and the
// background job pick it up from this list. Order = order in Settings.
export const VIDEO_PROVIDERS: VideoGenProvider[] = [geminiProvider, falProvider];

export function getVideoProvider(id: string | null | undefined): VideoGenProvider | null {
  return VIDEO_PROVIDERS.find((p) => p.id === id) ?? null;
}

// Business override → server default (VIDEO_AI_DEFAULT_MODEL_<ID>) → the
// provider's built-in default. The env lets ops move every business that
// didn't pick a model to a new one without a deploy of code.
export function resolveVideoModel(provider: VideoGenProvider, override: string | null | undefined): string {
  return override?.trim() || process.env[`VIDEO_AI_DEFAULT_MODEL_${provider.id.toUpperCase()}`]?.trim() || provider.defaultModel;
}

// Scene → prompt. Deterministic (no extra LLM call) and shown to the owner
// in an editable box before generating, so they see and control what is sent.
// On-screen text is left out on purpose: subtitles, hook text and logo are
// burned in later by the assembly, in the brand's colors.
export function sceneVideoPrompt(
  scene: PieceScene,
  business: { name: string; industry: string; location: string; brandTone: string | null; brandColors: string | null },
  language: string,
  aspectRatio: AspectRatio = "9:16"
): string {
  const lines = [
    `${aspectRatio === "9:16" ? "Vertical 9:16" : aspectRatio} realistic video clip for a social media reel of "${business.name}", ${business.industry} in ${business.location}.`,
    `What we see: ${scene.queMostrar}`,
    scene.comoGrabar ? `Camera and light: ${scene.comoGrabar}` : "",
    business.brandTone ? `Mood: ${business.brandTone}.` : "",
    business.brandColors ? `Where it fits naturally, use the brand colors ${business.brandColors}.` : "",
    "No on-screen text, captions, logos or watermarks (they are added later). No recognizable real people or brands.",
    scene.queDecir.trim()
      ? `Audio: an off-camera narrator says, in ${language}: "${scene.queDecir.trim()}". Natural ambient sound underneath, no music.`
      : "Audio: natural ambient sound only, no speech, no music.",
  ];
  return lines.filter(Boolean).join("\n");
}
