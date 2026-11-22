import { VideoGenError, type VideoGenProvider } from "../types";
import { clamp, download, readError } from "../http";
import { promptWithNarration } from "../prompt";

// Google, through the Gemini API with the client's own key (the same key the
// visual review of takes uses). Generation goes through the Interactions
// API: one POST returns the finished clip, inline (base64) or as a file URI.
// Docs: https://aistudio.google.com/docs/omni
// Veo 3.1 *preview* models were retired from the Gemini API on 2026-10-22;
// Gemini Omni Flash is the current video model there.

const BASE = "https://generativelanguage.googleapis.com/v1beta";
const WHO = "Google (Gemini)";

type MediaPart = { type?: string; mime_type?: string; data?: string; uri?: string };

// The clip is in steps[type=model_output].content[type=video]; the SDKs also
// expose output_video. Search for the first video part instead of trusting
// one path, so a reshuffled response doesn't break generation.
function findVideo(node: unknown, depth = 0): MediaPart | null {
  if (!node || typeof node !== "object" || depth > 8) return null;
  const part = node as MediaPart;
  if ((part.type === "video" || part.mime_type?.startsWith("video/")) && (part.data || part.uri)) return part;
  for (const value of Object.values(node)) {
    const found = findVideo(value, depth + 1);
    if (found) return found;
  }
  return null;
}

export const geminiProvider: VideoGenProvider = {
  id: "gemini",
  label: "Google Gemini (Omni Flash)",
  keySource: "gemini",
  strengths: "Movimiento real con sonido propio (ambiente y voz) en un solo paso. Bueno para acción, ambiente y lugares.",
  realMotion: true,
  defaultModel: "gemini-omni-1.2-flash",
  suggestedModels: [{ id: "gemini-omni-1.2-flash", label: "Gemini Omni Flash 1.2 (3–15 s, con audio)" }],

  clampDuration: (seconds) => clamp(seconds, 3, 15),

  async generate(req, { apiKey, model, signal }) {
    const res = await fetch(`${BASE}/interactions`, {
      method: "POST",
      headers: { "x-goog-api-key": apiKey, "content-type": "application/json" },
      body: JSON.stringify({
        model,
        // Omni always generates native audio; the prompt says what it should be.
        input: promptWithNarration(req),
        response_format: { type: "video", aspect_ratio: req.aspectRatio, duration: `${req.durationSeconds}s` },
        // Synchronous, and nothing kept on Google's side for later edits.
        store: false,
      }),
      signal,
      cache: "no-store",
    });
    if (!res.ok) throw await readError(res, WHO);
    const json = (await res.json()) as unknown;
    const video = findVideo(json);
    if (!video) {
      throw new VideoGenError(
        "Google no devolvió un video (puede que el filtro de seguridad bloqueara la escena). Cambia la descripción e intenta otra vez."
      );
    }
    if (video.data) return { data: Buffer.from(video.data, "base64"), mimeType: video.mime_type ?? "video/mp4" };
    return { data: await download(video.uri!, { "x-goog-api-key": apiKey }, signal), mimeType: video.mime_type ?? "video/mp4" };
  },
};
