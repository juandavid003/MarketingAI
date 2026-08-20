import { readFile } from "fs/promises";
import { basename } from "path";

export type TranscriptSegment = {
  start: number;
  end: number;
  text: string;
};

export type Transcript = {
  text: string;
  segments: TranscriptSegment[];
};

// OpenAI's audio transcription model — kept separate from the business's
// chosen text provider, since Anthropic has no transcription API.
const TRANSCRIPTION_MODEL = "whisper-1";

export async function transcribeVideo(apiKey: string, filePath: string): Promise<Transcript> {
  const buffer = await readFile(filePath);
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(buffer)]), basename(filePath));
  form.append("model", TRANSCRIPTION_MODEL);
  form.append("response_format", "verbose_json");

  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(`OpenAI Whisper error: ${json?.error?.message ?? JSON.stringify(json)}`);
  }

  const rawSegments: Array<{ start: number; end: number; text: string }> = Array.isArray(json?.segments)
    ? json.segments
    : [];
  const segments = rawSegments.map((s) => ({
    start: s.start,
    end: s.end,
    text: s.text.trim(),
  }));

  return {
    text: typeof json?.text === "string" ? json.text : segments.map((s) => s.text).join(" "),
    segments,
  };
}

function pad(n: number, width: number): string {
  return String(Math.floor(n)).padStart(width, "0");
}

function formatSrtTime(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  const ms = Math.round((totalSeconds - Math.floor(totalSeconds)) * 1000);
  return `${pad(h, 2)}:${pad(m, 2)}:${pad(s, 2)},${pad(ms, 3)}`;
}

// Builds an SRT for a clip trimmed to [offsetSeconds, offsetSeconds + duration],
// re-basing segment timestamps to start at 0.
export function generateSrt(segments: TranscriptSegment[], offsetSeconds = 0): string {
  const relevant = segments
    .map((seg) => ({ start: seg.start - offsetSeconds, end: seg.end - offsetSeconds, text: seg.text }))
    .filter((seg) => seg.end > 0)
    .map((seg) => ({ ...seg, start: Math.max(0, seg.start) }));

  return relevant
    .map((seg, i) => `${i + 1}\r\n${formatSrtTime(seg.start)} --> ${formatSrtTime(seg.end)}\r\n${seg.text}\r\n`)
    .join("\r\n");
}
