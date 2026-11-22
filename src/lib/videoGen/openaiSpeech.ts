import { readError } from "./http";

// Narration for scenes generated from a still image (providers/openaiStill).
// OpenAI announced that tts-1, tts-1-hd and gpt-4o-mini-tts shut down on
// 2027-01-06 with no Speech-API replacement named yet: the model and voice
// are env-configurable (OPENAI_TTS_MODEL / OPENAI_TTS_VOICE) so the switch
// is a server setting, and this is the only file that knows the endpoint.

export function ttsModel(): string {
  return process.env.OPENAI_TTS_MODEL?.trim() || "gpt-4o-mini-tts";
}

export async function synthesizeSpeech(input: {
  apiKey: string;
  text: string;
  language: string;
  signal?: AbortSignal;
}): Promise<Buffer> {
  const res = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: { Authorization: `Bearer ${input.apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      model: ttsModel(),
      voice: process.env.OPENAI_TTS_VOICE?.trim() || "marin",
      input: input.text.slice(0, 4000),
      instructions: `Speak in ${input.language}. Natural and warm, like the owner of a local business talking to a customer — not a radio announcer.`,
      response_format: "mp3",
    }),
    signal: input.signal,
    cache: "no-store",
  });
  if (!res.ok) throw await readError(res, "OpenAI (voz)");
  return Buffer.from(await res.arrayBuffer());
}
