import type { PieceScene } from "@/lib/contentAi";
import type { AspectRatio, VideoGenRequest } from "./types";

// Scene → what to show and what the voice says. Deterministic (no LLM call)
// and shown to the owner in editable boxes before generating, so they see
// exactly what is sent. On-screen text is left out on purpose: subtitles,
// hook text and logo are burned in later by the assembly, in brand colors.
export function sceneVideoPrompt(
  scene: PieceScene,
  business: { name: string; industry: string; location: string; brandTone: string | null; brandColors: string | null },
  aspectRatio: AspectRatio = "9:16"
): { visual: string; narration: string } {
  const lines = [
    `${aspectRatio === "9:16" ? "Vertical 9:16" : aspectRatio} realistic shot for a social media reel of "${business.name}", ${business.industry} in ${business.location}.`,
    `What we see: ${scene.queMostrar}`,
    scene.comoGrabar ? `Camera and light: ${scene.comoGrabar}` : "",
    business.brandTone ? `Mood: ${business.brandTone}.` : "",
    business.brandColors ? `Where it fits naturally, use the brand colors ${business.brandColors}.` : "",
    "No on-screen text, captions, logos or watermarks (they are added later). No recognizable real people or brands.",
  ];
  return { visual: lines.filter(Boolean).join("\n"), narration: scene.queDecir.trim() };
}

// For models that make the sound themselves (Gemini Omni, Kling with
// audio): the narration goes into the prompt.
export function promptWithNarration(req: Pick<VideoGenRequest, "visual" | "narration" | "language">): string {
  const audio = req.narration.trim()
    ? `Audio: an off-camera narrator says, in ${req.language}: "${req.narration.trim()}". Natural ambient sound underneath, no music.`
    : "Audio: natural ambient sound only, no speech, no music.";
  return `${req.visual.trim()}\n${audio}`;
}
