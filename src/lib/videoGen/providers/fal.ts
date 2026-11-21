import { VideoGenError, type KeyCheck, type VideoGenProvider } from "../types";
import { clamp, download, readError, sleep } from "../http";

// fal.ai: one key, many video models (Kling, Seedance, …) behind the same
// queue API — the cheapest way to follow the market: changing model is
// changing the endpoint id in Settings. Client's own key.
// Queue docs: https://fal.ai/docs/model-apis/model-endpoints/queue

const QUEUE = "https://queue.fal.run";
const WHO = "fal.ai";
const POLL_MS = 5_000;

type Submit = { request_id: string; status_url: string; response_url: string };
type Status = { status: "IN_QUEUE" | "IN_PROGRESS" | "COMPLETED"; error?: string; error_type?: string };

// Allowed durations differ per model family; unknown models get the common
// 3–15 s range and fal's own validation has the last word.
function durationFor(model: string, seconds: number): number {
  if (/kling-video\/v(1|2)/.test(model)) return seconds > 7 ? 10 : 5;
  if (/seedance/.test(model)) return clamp(seconds, 4, 15);
  return clamp(seconds, 3, 15);
}

export const falProvider: VideoGenProvider = {
  id: "fal",
  label: "fal.ai (Kling, Seedance y otros)",
  keyLabel: "fal.ai API key",
  keyPlaceholder: "xxxxxxxx-xxxx-…:…",
  keyHelp:
    "Créala en fal.ai → Dashboard → Keys. Con una sola key puedes usar varios modelos de video; fal cobra cada generación a tu cuenta.",
  defaultModel: "fal-ai/kling-video/o3/standard/text-to-video",
  suggestedModels: [
    { id: "fal-ai/kling-video/o3/standard/text-to-video", label: "Kling O3 Standard (3–15 s)" },
    { id: "fal-ai/kling-video/o3/pro/text-to-video", label: "Kling O3 Pro (más calidad, más caro)" },
    { id: "fal-ai/seedance-2/fast/text-to-video", label: "Seedance 2.0 Fast (4–15 s)" },
  ],

  clampDuration: (seconds, model) => durationFor(model, seconds),

  async generate(req, { apiKey, model, signal }) {
    const auth = { Authorization: `Key ${apiKey}` };
    const validPath =
      /^[A-Za-z0-9_.-]+(\/[A-Za-z0-9_.-]+)+$/.test(model) && !model.split("/").some((part) => /^\.+$/.test(part));
    if (!validPath) {
      throw new VideoGenError(`"${model}" no parece un modelo de fal.ai (ej. fal-ai/kling-video/o3/standard/text-to-video).`);
    }
    const submit = await fetch(`${QUEUE}/${model}`, {
      method: "POST",
      headers: { ...auth, "content-type": "application/json" },
      body: JSON.stringify({
        prompt: req.prompt,
        aspect_ratio: req.aspectRatio,
        duration: String(req.durationSeconds),
        generate_audio: req.generateAudio,
      }),
      signal,
      cache: "no-store",
    });
    if (!submit.ok) throw await readError(submit, WHO);
    const job = (await submit.json()) as Submit;

    for (;;) {
      await sleep(POLL_MS, signal);
      const res = await fetch(job.status_url, { headers: auth, signal, cache: "no-store" });
      if (!res.ok) throw await readError(res, WHO);
      const status = (await res.json()) as Status;
      if (status.status !== "COMPLETED") continue;
      if (status.error) throw new VideoGenError(`fal.ai no pudo generar el video: ${status.error}`);
      break;
    }

    const result = await fetch(job.response_url, { headers: auth, signal, cache: "no-store" });
    if (!result.ok) throw await readError(result, WHO);
    const output = (await result.json()) as { video?: { url?: string; content_type?: string } };
    if (!output.video?.url) throw new VideoGenError("fal.ai terminó pero no devolvió un video.");
    return { data: await download(output.video.url, {}, signal), mimeType: output.video.content_type ?? "video/mp4" };
  },

  // fal has no "who am I" endpoint: asking for a request that doesn't exist
  // answers 401/403 for a bad key and 404 for a good one.
  async checkKey(apiKey): Promise<KeyCheck> {
    try {
      const res = await fetch(`${QUEUE}/fal-ai/kling-video/requests/00000000-0000-0000-0000-000000000000/status`, {
        headers: { Authorization: `Key ${apiKey}` },
        signal: AbortSignal.timeout(10_000),
        cache: "no-store",
      });
      if (res.status === 401 || res.status === 403) {
        return { status: "invalid", message: "fal.ai rechazó la API key. Revisa que la copiaste completa." };
      }
      if (res.ok || res.status === 404 || res.status === 400) return { status: "ok" };
      return { status: "unknown", message: `fal.ai respondió ${res.status}; guardamos la key sin verificar.` };
    } catch {
      return { status: "unknown", message: "No pudimos contactar a fal.ai para verificar la key; la guardamos igual." };
    }
  },
};
