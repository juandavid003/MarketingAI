// AI video generation, provider-agnostic.
//
// Video models change fast (OpenAI shut down the Sora 2 API on 2026-09-24;
// Google retired the Veo 3.1 previews on 2026-10-22). So the app never talks
// to a model directly: it asks a VideoGenProvider for "a clip of N seconds
// in this aspect ratio from this prompt" and gets an mp4 back. Swapping
// models is a settings change (Business.videoAiModel or the env default);
// adding a provider is one file in ./providers plus a line in ./index.ts.
// See docs/AI_VIDEO.md.

export type AspectRatio = "9:16" | "16:9" | "1:1";

export type VideoGenRequest = {
  prompt: string;
  aspectRatio: AspectRatio;
  durationSeconds: number; // already clamped with provider.clampDuration()
  generateAudio: boolean; // native ambient sound / voice, when the model can
};

export type VideoGenResult = {
  data: Buffer;
  mimeType: string;
};

export type VideoGenContext = {
  apiKey: string;
  model: string;
  signal?: AbortSignal;
};

export type KeyCheck = { status: "ok" | "invalid" | "unknown"; message?: string };

export interface VideoGenProvider {
  id: string;
  label: string;
  // Settings copy: where to get a key and what it looks like.
  keyLabel: string;
  keyPlaceholder: string;
  keyHelp: string;
  // Used when the business leaves the model empty. Overridable per server
  // with VIDEO_AI_DEFAULT_MODEL_<ID> (e.g. VIDEO_AI_DEFAULT_MODEL_FAL).
  defaultModel: string;
  // Shown as suggestions; any model id the provider accepts can be typed.
  suggestedModels: { id: string; label: string }[];
  clampDuration(seconds: number, model: string): number;
  generate(req: VideoGenRequest, ctx: VideoGenContext): Promise<VideoGenResult>;
  checkKey(apiKey: string): Promise<KeyCheck>;
}

// Thrown for problems the owner can fix (bad key, blocked prompt, quota):
// the message is shown on the take as-is.
export class VideoGenError extends Error {}
