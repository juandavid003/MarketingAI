import { execFile } from "child_process";
import { promisify } from "util";
import { ffmpegPath } from "@/lib/video";
import { OUTPUT_FPS } from "@/lib/videoEdit";

const execFileAsync = promisify(execFile);

// A still image → a vertical clip with a slow camera move (Ken Burns), plus
// a narration track or silence. Used when the business has no video model
// (only an OpenAI key): the image comes from GPT Image, the motion from
// ffmpeg, so the clip costs one image and a few seconds of voice.
//
// The image (any aspect) is center-cropped to 9:16 and upscaled before
// zoompan so the move is smooth instead of stepping pixel by pixel.

export type Motion = "zoom_in" | "zoom_out" | "pan_up";

export function motionFilter(motion: Motion, frames: number, width: number, height: number): string {
  const zoomTo = 0.12;
  const z =
    motion === "zoom_out" ? `${1 + zoomTo}-${zoomTo}*on/${frames}` : motion === "pan_up" ? `${1 + zoomTo / 2}` : `1+${zoomTo}*on/${frames}`;
  const y = motion === "pan_up" ? `(ih-ih/zoom)*(1-on/${frames})` : "ih/2-(ih/zoom/2)";
  // Upscale 1.5× the output before moving.
  const upW = Math.round((width * 1.5) / 2) * 2;
  const upH = Math.round((height * 1.5) / 2) * 2;
  return [
    `[0:v]crop='min(iw,ih*${width}/${height})':'min(ih,iw*${height}/${width})'`,
    `scale=${upW}:${upH}`,
    `zoompan=z='${z}':x='iw/2-(iw/zoom/2)':y='${y}':d=${frames}:s=${width}x${height}:fps=${OUTPUT_FPS}`,
    "setsar=1,format=yuv420p[v]",
  ].join(",");
}

export async function renderStillMotion(input: {
  imagePath: string;
  audioPath: string | null;
  durationSeconds: number;
  outputPath: string;
  motion?: Motion;
  width?: number;
  height?: number;
}): Promise<void> {
  const width = input.width ?? 1080;
  const height = input.height ?? 1920;
  const duration = Math.max(1, input.durationSeconds);
  const frames = Math.ceil(duration * OUTPUT_FPS);

  const args = ["-y", "-i", input.imagePath];
  if (input.audioPath) args.push("-i", input.audioPath);
  else args.push("-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo");
  args.push(
    "-filter_complex",
    `${motionFilter(input.motion ?? "zoom_in", frames, width, height)};[1:a]apad,aresample=48000,aformat=channel_layouts=stereo[a]`,
    "-map",
    "[v]",
    "-map",
    "[a]",
    "-t",
    duration.toFixed(2),
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
    "-movflags",
    "+faststart",
    // Same cap as the assembly: 1 vCPU droplet.
    "-threads",
    "2",
    input.outputPath
  );
  await execFileAsync(ffmpegPath(), args, { maxBuffer: 1024 * 1024 * 64 });
}
