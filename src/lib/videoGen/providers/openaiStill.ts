import { mkdtemp, readFile, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import { generateImage, IMAGE_MODEL } from "@/lib/images";
import { probeMedia } from "@/lib/videoEdit";
import { VideoGenError, type VideoGenProvider } from "../types";
import { clamp } from "../http";
import { synthesizeSpeech } from "../openaiSpeech";
import { renderStillMotion, type Motion } from "../stillMotion";

// Works with only an OpenAI key (no video model needed): GPT Image draws
// the scene as a vertical photo, ffmpeg adds a slow camera move, and OpenAI
// TTS reads the narration. No real motion — right for products, dishes,
// places and details; wrong for action or people doing things (the picker
// and lib/videoGen/recommend.ts say so).

const MOTIONS: Motion[] = ["zoom_in", "pan_up", "zoom_out"];

export const openaiStillProvider: VideoGenProvider = {
  id: "openai",
  label: "OpenAI (imagen + movimiento + voz)",
  keySource: "openai",
  strengths:
    "Funciona con tu key de OpenAI. Foto realista de la escena con movimiento de cámara y voz IA: ideal para producto, platos, local y detalles; no muestra acción.",
  realMotion: false,
  defaultModel: IMAGE_MODEL,
  suggestedModels: [{ id: IMAGE_MODEL, label: "GPT Image 2 (imagen vertical)" }],

  clampDuration: (seconds) => clamp(seconds, 3, 15),

  async generate(req, { apiKey, model, signal }) {
    if (req.aspectRatio !== "9:16") throw new VideoGenError("Este proveedor solo genera escenas verticales 9:16.");
    const dir = await mkdtemp(path.join(tmpdir(), "scene-"));
    try {
      const imagePrompt = `${req.visual.trim()}\nPhotorealistic vertical photo, natural light, shallow depth of field, leave room around the subject for a slow camera move. Absolutely no text, letters or logos.`;
      const [image, voice] = await Promise.all([
        generateImage(apiKey, imagePrompt, "1024x1536", { model, signal }).catch((err: unknown) => {
          throw new VideoGenError(`OpenAI no pudo crear la imagen: ${err instanceof Error ? err.message.slice(0, 240) : "error"}`);
        }),
        req.narration.trim()
          ? synthesizeSpeech({ apiKey, text: req.narration, language: req.language, signal })
          : Promise.resolve(null),
      ]);
      const imagePath = path.join(dir, "scene.png");
      await writeFile(imagePath, image);

      // The clip lasts what the scene asks, or longer if the voice needs it.
      let duration = req.durationSeconds;
      let audioPath: string | null = null;
      if (voice) {
        audioPath = path.join(dir, "voice.mp3");
        await writeFile(audioPath, voice);
        const { durationSeconds: spoken } = await probeMedia(audioPath);
        duration = Math.max(duration, Math.min(spoken + 0.6, 20));
      }

      const outputPath = path.join(dir, "scene.mp4");
      await renderStillMotion({
        imagePath,
        audioPath,
        durationSeconds: duration,
        outputPath,
        motion: MOTIONS[req.visual.length % MOTIONS.length],
      });
      return { data: await readFile(outputPath), mimeType: "video/mp4" };
    } finally {
      await rm(dir, { recursive: true, force: true }).catch(() => {});
    }
  },
};
