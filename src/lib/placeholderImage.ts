import { execFile } from "child_process";
import { promisify } from "util";
import { writeFile, unlink } from "fs/promises";
import path from "path";
import os from "os";
import { randomUUID } from "crypto";

const execFileAsync = promisify(execFile);

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

// Same escaping ffmpeg's filter parser needs for Windows paths inside -vf,
// reused from lib/video.ts's approach (colon/backslash are filter syntax).
function escapeForFilter(p: string): string {
  return p.replace(/\\/g, "/").replace(/:/g, "\\:");
}

function wrapText(text: string, maxCharsPerLine = 24, maxLines = 6): string {
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxCharsPerLine && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
    if (lines.length === maxLines) break;
  }
  if (lines.length < maxLines && current) lines.push(current);

  if (lines.length === maxLines) {
    lines[maxLines - 1] = `${lines[maxLines - 1].slice(0, maxCharsPerLine - 1)}…`;
  }

  return lines.join("\n");
}

function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const toHex = (n: number) =>
    Math.round(f(n) * 255)
      .toString(16)
      .padStart(2, "0");
  return `0x${toHex(0)}${toHex(8)}${toHex(4)}`;
}

// Deterministic, pleasant-enough background color derived from the caption
// text, so the same content always renders the same placeholder. ffmpeg's
// lavfi color source only accepts names or 0xRRGGBB[AA] — not CSS hsl().
function colorForText(text: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash * 31 + text.charCodeAt(i)) | 0;
  }
  const hue = Math.abs(hash) % 360;
  return hslToHex(hue, 55, 32);
}

const FONT_PATH = "C:\\Windows\\Fonts\\segoeui.ttf";

// Renders a simple text-on-background PNG locally via ffmpeg's drawtext
// filter — no external AI API involved. Used as a stand-in for real
// AI-generated images when no OpenAI image key is configured, so the rest
// of the pipeline (campaign → image → publish) can still be exercised.
export async function generatePlaceholderImage(
  caption: string,
  outputPath: string,
  width = 1024,
  height = 1536
): Promise<void> {
  const wrapped = wrapText(caption);
  const textFilePath = path.join(os.tmpdir(), `placeholder-${randomUUID()}.txt`);
  await writeFile(textFilePath, wrapped, "utf8");

  const watermark = "VISTA PREVIA — no generada por IA";
  const bgColor = colorForText(caption);

  const filters = [
    `drawtext=fontfile='${escapeForFilter(FONT_PATH)}':textfile='${escapeForFilter(
      textFilePath
    )}':fontcolor=white:fontsize=56:line_spacing=14:box=1:boxcolor=black@0.35:boxborderw=24:x=(w-text_w)/2:y=(h-text_h)/2`,
    `drawtext=fontfile='${escapeForFilter(
      FONT_PATH
    )}':text='${watermark}':fontcolor=white@0.85:fontsize=28:x=(w-text_w)/2:y=h-80`,
  ];

  const args = [
    "-y",
    "-f",
    "lavfi",
    "-i",
    `color=c=${bgColor}:s=${width}x${height}:d=1`,
    "-vf",
    filters.join(","),
    "-frames:v",
    "1",
    outputPath,
  ];

  try {
    await execFileAsync(requireEnv("FFMPEG_PATH"), args, { maxBuffer: 1024 * 1024 * 16 });
  } finally {
    await unlink(textFilePath).catch(() => {});
  }
}
