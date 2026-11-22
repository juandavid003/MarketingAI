// AI video generation, provider-agnostic.
//
// Video models change fast (OpenAI shut down the Sora 2 API on 2026-09-24;
// Google retired the Veo 3.1 previews on 2026-10-22). So the app never talks
// to a model directly: it asks a VideoGenProvider for "a clip of N seconds
// in this aspect ratio, showing this, with this narration" and gets an mp4
// back. Swapping models is a settings change (Business.videoAiModels or the
// env default); adding a provider is one file in ./providers plus a line in
// ./index.ts. See docs/AI_VIDEO.md.

export type AspectRatio = "9:16" | "16:9" | "1:1";

export type VideoGenRequest = {
  visual: string; // what we see — no on-screen text (added by the assembly)
  narration: string; // what the off-camera voice says ("" = no voice)
  language: string; // human name of the narration language, e.g. "español"
  aspectRatio: AspectRatio;
  durationSeconds: number; // already clamped with provider.clampDuration()
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

// Which saved key a provider runs on. "openai" = any OpenAI key the business
// already has (text, images or transcription).
export type KeySource = "gemini" | "fal" | "openai";

export interface VideoGenProvider {
  id: string;
  label: string;
  keySource: KeySource;
  // One line for the scene picker and Settings: what it's good at.
  strengths: string;
  // True motion from a video model; false = a still image with camera
  // movement (cheaper, faithful to products, can't show action).
  realMotion: boolean;
  // Used when the business leaves the model empty. Overridable per server
  // with VIDEO_AI_DEFAULT_MODEL_<ID> (e.g. VIDEO_AI_DEFAULT_MODEL_FAL).
  defaultModel: string;
  // Shown as suggestions; any model id the provider accepts can be typed.
  suggestedModels: { id: string; label: string }[];
  clampDuration(seconds: number, model: string): number;
  generate(req: VideoGenRequest, ctx: VideoGenContext): Promise<VideoGenResult>;
}

// Thrown for problems the owner can fix (bad key, blocked prompt, quota):
// the message is shown on the take as-is.
export class VideoGenError extends Error {}
