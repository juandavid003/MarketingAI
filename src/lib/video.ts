import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function ffmpegPath(): string {
  return requireEnv("FFMPEG_PATH");
}

function ffprobePath(): string {
  return requireEnv("FFPROBE_PATH");
}

export async function getDurationSeconds(inputPath: string): Promise<number> {
  const { stdout } = await execFileAsync(ffprobePath(), [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "json",
    inputPath,
  ]);
  const parsed = JSON.parse(stdout) as { format?: { duration?: string } };
  const duration = Number(parsed.format?.duration);
  if (!Number.isFinite(duration)) {
    throw new Error("No se pudo leer la duración del video.");
  }
  return duration;
}

// ffmpeg's filter option parser treats ':' and '\' specially, so a Windows
// path used inside -vf/-filter_complex must be escaped this way.
function escapeForFilter(path: string): string {
  return path.replace(/\\/g, "/").replace(/:/g, "\\:");
}

export async function renderVerticalClip(input: {
  inputPath: string;
  outputPath: string;
  startSeconds: number;
  endSeconds: number;
  srtPath?: string;
  width?: number;
  height?: number;
}): Promise<void> {
  const width = input.width ?? 1080;
  const height = input.height ?? 1920;
  const duration = Math.max(0.5, input.endSeconds - input.startSeconds);

  const filters = [
    `scale=${width}:${height}:force_original_aspect_ratio=increase`,
    `crop=${width}:${height}`,
  ];
  if (input.srtPath) {
    filters.push(`subtitles='${escapeForFilter(input.srtPath)}'`);
  }

  const args = [
    "-y",
    "-ss",
    String(input.startSeconds),
    "-i",
    input.inputPath,
    "-t",
    String(duration),
    "-vf",
    filters.join(","),
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "23",
    "-c:a",
    "aac",
    "-movflags",
    "+faststart",
    input.outputPath,
  ];

  await execFileAsync(ffmpegPath(), args, { maxBuffer: 1024 * 1024 * 64 });
}

// OpenAI's transcription endpoint caps requests at 25MB; a compressed
// audio-only track keeps us well under that even for longer clips.
export async function extractAudio(inputPath: string, outputPath: string): Promise<void> {
  const args = ["-y", "-i", inputPath, "-vn", "-c:a", "libmp3lame", "-b:a", "96k", outputPath];
  await execFileAsync(ffmpegPath(), args, { maxBuffer: 1024 * 1024 * 16 });
}

export async function extractThumbnail(input: {
  inputPath: string;
  outputPath: string;
  atSeconds: number;
}): Promise<void> {
  const args = [
    "-y",
    "-ss",
    String(input.atSeconds),
    "-i",
    input.inputPath,
    "-frames:v",
    "1",
    "-q:v",
    "2",
    input.outputPath,
  ];
  await execFileAsync(ffmpegPath(), args, { maxBuffer: 1024 * 1024 * 16 });
}
