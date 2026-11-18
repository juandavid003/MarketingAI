import { execFile } from "child_process";
import { promisify } from "util";
import { writeFile } from "fs/promises";
import { ffmpegPath, ffprobePath } from "@/lib/video";
import type { TranscriptSegment } from "@/lib/whisper";

// Editing primitives for assembling a video from scene takes:
//   probe → detect silences → keep the spoken parts → normalize each take to
//   the same format → concatenate → burn subtitles/on-screen text per aspect.
//
// The interval math is pure (and unit-tested in videoEdit.test.ts); only the
// run* functions shell out to ffmpeg.

const execFileAsync = promisify(execFile);

export type Interval = [number, number];

export const OUTPUT_FPS = 30;

export async function probeMedia(inputPath: string): Promise<{ durationSeconds: number; hasAudio: boolean }> {
  const { stdout } = await execFileAsync(ffprobePath(), [
    "-v",
    "error",
    "-show_entries",
    "format=duration:stream=codec_type",
    "-of",
    "json",
    inputPath,
  ]);
  const parsed = JSON.parse(stdout) as {
    format?: { duration?: string };
    streams?: { codec_type?: string }[];
  };
  const durationSeconds = Number(parsed.format?.duration);
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    throw new Error("No se pudo leer la duración del video.");
  }
  return {
    durationSeconds,
    hasAudio: (parsed.streams ?? []).some((s) => s.codec_type === "audio"),
  };
}

// ---------------------------------------------------------------------------
// Silence detection
// ---------------------------------------------------------------------------

// Parses ffmpeg's silencedetect stderr into silent intervals. A trailing
// "silence_start" with no end means silence until the end of the file.
export function parseSilenceDetect(stderr: string, durationSeconds: number): Interval[] {
  const silences: Interval[] = [];
  let open: number | null = null;
  for (const line of stderr.split(/\r?\n/)) {
    const start = line.match(/silence_start:\s*(-?[\d.]+)/);
    if (start) {
      open = Math.max(0, Number(start[1]));
      continue;
    }
    const end = line.match(/silence_end:\s*(-?[\d.]+)/);
    if (end && open !== null) {
      silences.push([open, Math.min(durationSeconds, Number(end[1]))]);
      open = null;
    }
  }
  if (open !== null) silences.push([open, durationSeconds]);
  return silences;
}

export async function detectSilences(
  inputPath: string,
  durationSeconds: number,
  opts: { noiseDb?: number; minSilenceSeconds?: number } = {}
): Promise<Interval[]> {
  const noise = opts.noiseDb ?? -35;
  const minSilence = opts.minSilenceSeconds ?? 0.6;
  // silencedetect logs to stderr; -f null discards the decoded output.
  const { stderr } = await execFileAsync(
    ffmpegPath(),
    ["-hide_banner", "-nostats", "-i", inputPath, "-vn", "-af", `silencedetect=noise=${noise}dB:d=${minSilence}`, "-f", "null", "-"],
    { maxBuffer: 1024 * 1024 * 16 }
  );
  return parseSilenceDetect(stderr, durationSeconds);
}

// The parts of the take to keep: everything that isn't silence, padded so
// words aren't clipped, with short gaps merged so the cut doesn't feel jumpy.
// Returns the whole take when there's (almost) no speech — a silent B-roll
// scene is valid and must not be cut to nothing.
export function keepIntervalsFromSilences(
  silences: Interval[],
  durationSeconds: number,
  opts: { padSeconds?: number; mergeGapSeconds?: number; minKeepSeconds?: number } = {}
): Interval[] {
  const pad = opts.padSeconds ?? 0.15;
  const mergeGap = opts.mergeGapSeconds ?? 0.35;
  const minKeep = opts.minKeepSeconds ?? 0.2;

  const sorted = [...silences].sort((a, b) => a[0] - b[0]);
  const speech: Interval[] = [];
  let cursor = 0;
  for (const [s, e] of sorted) {
    if (s > cursor) speech.push([cursor, s]);
    cursor = Math.max(cursor, e);
  }
  if (cursor < durationSeconds) speech.push([cursor, durationSeconds]);

  const padded = speech
    .filter(([s, e]) => e - s >= minKeep)
    .map(([s, e]): Interval => [Math.max(0, s - pad), Math.min(durationSeconds, e + pad)]);

  const merged: Interval[] = [];
  for (const iv of padded) {
    const last = merged[merged.length - 1];
    if (last && iv[0] - last[1] <= mergeGap) {
      last[1] = Math.max(last[1], iv[1]);
    } else {
      merged.push([iv[0], iv[1]]);
    }
  }

  const kept = totalLength(merged);
  if (merged.length === 0 || kept < 0.5) return [[0, durationSeconds]];
  return merged.map(([s, e]) => [round3(s), round3(e)]);
}

export function totalLength(intervals: Interval[]): number {
  return intervals.reduce((sum, [s, e]) => sum + Math.max(0, e - s), 0);
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

// Maps a timestamp in the original take onto the cut timeline (silences
// removed). Times inside a removed gap snap to the next kept part.
export function mapToCutTimeline(t: number, keep: Interval[]): number {
  let offset = 0;
  for (const [s, e] of keep) {
    if (t < s) return offset;
    if (t <= e) return offset + (t - s);
    offset += e - s;
  }
  return offset;
}

// ---------------------------------------------------------------------------
// Subtitles
// ---------------------------------------------------------------------------

export type Cue = { start: number; end: number; text: string; top?: boolean };

// Whisper segments can be a whole sentence (~10 s): split them into short
// cues (≤ maxWords), timing each chunk proportionally to its length.
export function splitIntoCues(segments: TranscriptSegment[], maxWords = 6): Cue[] {
  const cues: Cue[] = [];
  for (const seg of segments) {
    const words = seg.text.split(/\s+/).filter(Boolean);
    if (words.length === 0 || seg.end <= seg.start) continue;
    const chunks: string[][] = [];
    for (let i = 0; i < words.length; i += maxWords) chunks.push(words.slice(i, i + maxWords));
    const totalChars = words.join(" ").length;
    let t = seg.start;
    for (const chunk of chunks) {
      const text = chunk.join(" ");
      const dur = ((seg.end - seg.start) * text.length) / totalChars;
      cues.push({ start: t, end: t + dur, text });
      t += dur;
    }
  }
  return cues;
}

// Builds the cue list for the assembled video: each take's speech cues
// re-timed onto the cut timeline and shifted by where the scene starts, plus
// the scene's on-screen text pinned to the top for the whole scene.
export function buildAssemblyCues(
  scenes: {
    offsetSeconds: number;
    lengthSeconds: number;
    keep: Interval[];
    segments: TranscriptSegment[];
    onScreenText: string;
  }[]
): Cue[] {
  const cues: Cue[] = [];
  for (const scene of scenes) {
    if (scene.onScreenText.trim()) {
      cues.push({
        start: scene.offsetSeconds,
        end: scene.offsetSeconds + scene.lengthSeconds,
        text: scene.onScreenText.trim(),
        top: true,
      });
    }
    for (const cue of splitIntoCues(scene.segments)) {
      const start = mapToCutTimeline(cue.start, scene.keep);
      const end = mapToCutTimeline(cue.end, scene.keep);
      if (end - start < 0.15) continue;
      cues.push({
        start: scene.offsetSeconds + start,
        end: scene.offsetSeconds + Math.min(end, scene.lengthSeconds),
        text: cue.text,
      });
    }
  }
  return cues.sort((a, b) => a.start - b.start);
}

// ASS time format: H:MM:SS.cc (centiseconds).
function assTime(totalSeconds: number): string {
  const cs = Math.max(0, Math.round(totalSeconds * 100));
  const h = Math.floor(cs / 360_000);
  const m = Math.floor((cs % 360_000) / 6000);
  const s = Math.floor((cs % 6000) / 100);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${h}:${p(m)}:${p(s)}.${p(cs % 100)}`;
}

// "#0EA5E9" → libass "&H00E9A50E" (alpha, blue, green, red).
export function hexToAssColor(hex: string | null | undefined): string | null {
  const m = hex?.trim().match(/^#?([0-9a-f]{6})$/i);
  if (!m) return null;
  const [r, g, b] = [m[1].slice(0, 2), m[1].slice(2, 4), m[1].slice(4, 6)];
  return `&H00${b}${g}${r}`.toUpperCase();
}

// An ASS script (not SRT: ffmpeg's SRT decoder drops position/color tags)
// with two styles — "Sub" for speech at the bottom, "Top" for each scene's
// on-screen text on a box in the brand color. PlayRes matches the output
// size, so the same cues render undistorted in 9:16 and 4:5.
export function cuesToAss(cues: Cue[], opts: { width: number; height: number; brandAssColor: string | null }): string {
  const { width, height } = opts;
  const box = opts.brandAssColor ?? "&H00111111";
  const subSize = Math.round(width * 0.06);
  const topSize = Math.round(width * 0.065);
  const side = Math.round(width * 0.07);
  // Below the logo slot (logoBox) so the text box never covers the logo.
  const logo = logoBox(width, height);
  const topMargin = Math.round(Math.max(height * 0.09, logo.y + logo.h + topSize * 0.6));
  const clean = (t: string) => t.replace(/[{}\\]/g, "").replace(/\r?\n/g, "\\N");

  const header = `[Script Info]
ScriptType: v4.00+
PlayResX: ${width}
PlayResY: ${height}
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Sub,DejaVu Sans,${subSize},&H00FFFFFF,&H00FFFFFF,&H00000000,&H64000000,-1,0,0,0,100,100,0,0,1,${Math.round(subSize * 0.09)},0,2,${side},${side},${Math.round(height * 0.12)},1
Style: Top,DejaVu Sans,${topSize},&H00FFFFFF,&H00FFFFFF,${box},${box},-1,0,0,0,100,100,0,0,3,${Math.round(topSize * 0.3)},0,8,${side},${side},${topMargin},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;
  const events = cues
    .map((c) => `Dialogue: 0,${assTime(c.start)},${assTime(c.end)},${c.top ? "Top" : "Sub"},,0,0,0,,${clean(c.text)}`)
    .join("\n");
  return `${header}${events}\n`;
}

// First hex color in the profile's free-text "brandColors" field.
export function firstBrandColor(brandColors: string | null | undefined): string | null {
  return brandColors?.match(/#[0-9a-f]{6}/i)?.[0] ?? null;
}

// ---------------------------------------------------------------------------
// ffmpeg runners
// ---------------------------------------------------------------------------

function escapeForFilter(p: string): string {
  return p.replace(/\\/g, "/").replace(/:/g, "\\:").replace(/'/g, "\\'");
}

const ENCODE_ARGS = [
  "-c:v",
  "libx264",
  "-preset",
  "veryfast",
  "-crf",
  "23",
  "-pix_fmt",
  "yuv420p",
  "-c:a",
  "aac",
  "-b:a",
  "128k",
  "-ar",
  "48000",
  "-ac",
  "2",
  "-movflags",
  "+faststart",
  // The droplet has 1 vCPU / 2 GB: cap threads so a render can't starve the
  // web server.
  "-threads",
  "2",
];

// Cuts the kept intervals out of one take and normalizes it to WxH @ 30fps
// with stereo 48 kHz audio, so every scene can be concatenated losslessly.
export async function renderNormalizedScene(input: {
  inputPath: string;
  outputPath: string;
  keep: Interval[];
  hasAudio: boolean;
  width: number;
  height: number;
}): Promise<void> {
  const { keep, width, height } = input;
  const parts: string[] = [];
  const concatInputs: string[] = [];
  keep.forEach(([s, e], i) => {
    parts.push(`[0:v]trim=start=${s}:end=${e},setpts=PTS-STARTPTS[v${i}]`);
    if (input.hasAudio) {
      parts.push(`[0:a]atrim=start=${s}:end=${e},asetpts=PTS-STARTPTS[a${i}]`);
      concatInputs.push(`[v${i}][a${i}]`);
    } else {
      concatInputs.push(`[v${i}]`);
    }
  });
  const audioOut = input.hasAudio ? 1 : 0;
  parts.push(`${concatInputs.join("")}concat=n=${keep.length}:v=1:a=${audioOut}[vc]${input.hasAudio ? "[ac]" : ""}`);
  parts.push(
    `[vc]scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},fps=${OUTPUT_FPS},setsar=1,format=yuv420p[vout]`
  );

  const args = ["-y", "-i", input.inputPath];
  if (input.hasAudio) {
    parts.push(`[ac]aresample=48000,aformat=channel_layouts=stereo[aout]`);
  } else {
    // Silent take: add a silent track so all scenes share the same streams.
    args.push("-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo");
  }
  args.push("-filter_complex", parts.join(";"), "-map", "[vout]");
  args.push("-map", input.hasAudio ? "[aout]" : "1:a");
  if (!input.hasAudio) args.push("-shortest");
  args.push(...ENCODE_ARGS, input.outputPath);

  await execFileAsync(ffmpegPath(), args, { maxBuffer: 1024 * 1024 * 64 });
}

// Joins already-normalized scenes (same codec/size/fps) without re-encoding.
export async function concatScenes(scenePaths: string[], listPath: string, outputPath: string): Promise<void> {
  const list = scenePaths.map((p) => `file '${p.replace(/\\/g, "/").replace(/'/g, "'\\''")}'`).join("\n");
  await writeFile(listPath, list, "utf8");
  await execFileAsync(
    ffmpegPath(),
    ["-y", "-f", "concat", "-safe", "0", "-i", listPath, "-c", "copy", "-movflags", "+faststart", outputPath],
    { maxBuffer: 1024 * 1024 * 16 }
  );
}

// Final render for one aspect ratio: optional center crop (9:16 → 4:5 or
// 1:1), burned-in subtitles (an ASS script built for that output size) and
// the brand logo in the top-left corner — clear of the platforms' buttons on
// the right and of the on-screen text box, which starts lower.
export async function renderFinal(input: {
  inputPath: string;
  outputPath: string;
  assPath: string | null;
  crop?: { width: number; height: number };
  logoPath?: string | null;
}): Promise<void> {
  const filters: string[] = [];
  if (input.crop) filters.push(`crop=${input.crop.width}:${input.crop.height}`);
  if (input.assPath) filters.push(`ass='${escapeForFilter(input.assPath)}'`);
  const args = ["-y", "-i", input.inputPath];
  if (input.logoPath) {
    const { width, height } = input.crop ?? { width: 1080, height: 1920 };
    const box = logoBox(width, height);
    args.push("-i", input.logoPath);
    const base = filters.length > 0 ? `[0:v]${filters.join(",")}[base]` : "[0:v]null[base]";
    args.push(
      "-filter_complex",
      `${base};[1:v]scale=${box.w}:${box.h}:force_original_aspect_ratio=decrease,format=rgba[logo];[base][logo]overlay=${box.x}:${box.y}:format=auto,format=yuv420p[v]`,
      "-map",
      "[v]",
      "-map",
      "0:a?"
    );
  } else if (filters.length > 0) {
    args.push("-vf", filters.join(","));
  }
  args.push(...ENCODE_ARGS, input.outputPath);
  await execFileAsync(ffmpegPath(), args, { maxBuffer: 1024 * 1024 * 64 });
}

// Logo size and position for an output: at most 16% of the width and 6% of
// the height, inset 4% of the width from the top-left corner.
export function logoBox(width: number, height: number): { w: number; h: number; x: number; y: number } {
  const even = (n: number) => Math.max(2, Math.round(n / 2) * 2);
  const inset = Math.round(width * 0.04);
  return { w: even(width * 0.16), h: even(height * 0.06), x: inset, y: inset };
}

// Where an on-screen overlay sits inside a segment of `length` seconds:
// the whole segment, or — when hook and CTA share one take — the opening
// seconds (hook) and the closing seconds (CTA).
export type OverlayAt = "whole" | "start" | "end";

export function overlayWindow(at: OverlayAt, length: number): Interval {
  if (at === "whole") return [0, length];
  const span = Math.min(at === "start" ? 4 : 5, length / 3);
  return at === "start" ? [0, span] : [Math.max(0, length - span), length];
}

// Every assembled video and creative comes out in these formats, cropped
// from the same 1080x1920 master.
export const OUTPUT_FORMATS = [
  { id: "9x16", width: 1080, height: 1920, crop: undefined, label: "Vertical 9:16 (Reels, TikTok, Shorts)" },
  { id: "4x5", width: 1080, height: 1350, crop: { width: 1080, height: 1350 }, label: "Feed 4:5 (Instagram, Facebook)" },
  { id: "1x1", width: 1080, height: 1080, crop: { width: 1080, height: 1080 }, label: "Cuadrado 1:1 (feed, anuncios)" },
] as const;
export type OutputFormat = (typeof OUTPUT_FORMATS)[number];
