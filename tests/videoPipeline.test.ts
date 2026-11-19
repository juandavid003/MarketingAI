import { execFile, execFileSync } from "child_process";
import { mkdtempSync, rmSync, writeFileSync, existsSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { promisify } from "util";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ffmpegPath, ffprobePath } from "@/lib/video";
import {
  concatScenes,
  cuesToAss,
  detectSilences,
  keepIntervalsFromSilences,
  probeMedia,
  renderFinal,
  renderNormalizedScene,
  totalLength,
  parseSilenceDetect,
  type Interval,
} from "@/lib/videoEdit";

// End-to-end check of the assembly pipeline on a generated sample video:
// probe → silence detection → keep the spoken parts → normalize scenes →
// concatenate → final render with crop, burned subtitles and logo.
// Uses small frame sizes so it runs in a few seconds. Skipped (with a
// visible notice) only when ffmpeg isn't installed.

const execFileAsync = promisify(execFile);

function hasFfmpeg(): boolean {
  try {
    execFileSync(ffmpegPath(), ["-version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

const FFMPEG = hasFfmpeg();
if (!FFMPEG) console.warn("[videoPipeline.test] ffmpeg not found — pipeline tests skipped");

let dir = "";
const p = (name: string) => path.join(dir, name);

async function ffmpeg(args: string[]) {
  await execFileAsync(ffmpegPath(), ["-hide_banner", "-loglevel", "error", "-y", ...args]);
}

async function dimensions(file: string): Promise<{ width: number; height: number }> {
  const { stdout } = await execFileAsync(ffprobePath(), [
    "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "json", file,
  ]);
  const s = (JSON.parse(stdout) as { streams: { width: number; height: number }[] }).streams[0];
  return { width: s.width, height: s.height };
}

describe.skipIf(!FFMPEG)("video pipeline (sample video)", () => {
  beforeAll(async () => {
    dir = mkdtempSync(path.join(tmpdir(), "mai-video-"));
    // 5 s take: 1.5 s tone ("speech"), 2 s silence, 1.5 s tone. 360x640 portrait.
    await ffmpeg([
      "-f", "lavfi", "-i", "testsrc2=size=360x640:rate=30:duration=5",
      "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=48000:duration=5",
      "-filter_complex", "[1:a]volume='if(between(t,1.5,3.5),0,1)':eval=frame[a]",
      "-map", "0:v", "-map", "[a]", "-c:v", "libx264", "-preset", "ultrafast", "-c:a", "aac", "-shortest",
      p("take1.mp4"),
    ]);
    // Silent B-roll take, 2 s, landscape (gets cropped to portrait).
    await ffmpeg([
      "-f", "lavfi", "-i", "testsrc=size=640x360:rate=25:duration=2",
      "-c:v", "libx264", "-preset", "ultrafast", p("broll.mp4"),
    ]);
    // Small PNG logo.
    await ffmpeg(["-f", "lavfi", "-i", "color=c=red:s=120x60", "-frames:v", "1", p("logo.png")]);
  });

  afterAll(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  let keep: Interval[] = [];

  it("probes duration and audio", async () => {
    const take = await probeMedia(p("take1.mp4"));
    expect(take.durationSeconds).toBeGreaterThan(4.8);
    expect(take.durationSeconds).toBeLessThan(5.3);
    expect(take.hasAudio).toBe(true);
    expect((await probeMedia(p("broll.mp4"))).hasAudio).toBe(false);
  });

  it("detects the silence in the middle and keeps the spoken parts", async () => {
    const { durationSeconds } = await probeMedia(p("take1.mp4"));
    const silences = await detectSilences(p("take1.mp4"), durationSeconds);
    expect(silences).toHaveLength(1);
    expect(silences[0][0]).toBeGreaterThan(1.3);
    expect(silences[0][1]).toBeLessThan(3.7);

    keep = keepIntervalsFromSilences(silences, durationSeconds);
    expect(keep).toHaveLength(2);
    // ~3 s of "speech" + padding, the 2 s gap removed.
    expect(totalLength(keep)).toBeGreaterThan(2.9);
    expect(totalLength(keep)).toBeLessThan(3.8);
  });

  it("normalizes scenes, concatenates them, and renders every final format", async () => {
    const W = 270;
    const H = 480;
    await renderNormalizedScene({ inputPath: p("take1.mp4"), outputPath: p("s1.mp4"), keep, hasAudio: true, width: W, height: H });
    await renderNormalizedScene({ inputPath: p("broll.mp4"), outputPath: p("s2.mp4"), keep: [[0, 2]], hasAudio: false, width: W, height: H });
    for (const s of ["s1.mp4", "s2.mp4"]) {
      expect(await dimensions(p(s))).toEqual({ width: W, height: H });
      expect((await probeMedia(p(s))).hasAudio).toBe(true); // silent scene gets a silent track
    }

    await concatScenes([p("s1.mp4"), p("s2.mp4")], p("list.txt"), p("master.mp4"));
    const master = await probeMedia(p("master.mp4"));
    expect(master.durationSeconds).toBeGreaterThan(totalLength(keep) + 1.7);
    expect(master.durationSeconds).toBeLessThan(totalLength(keep) + 2.4);

    writeFileSync(
      p("subs.ass"),
      cuesToAss([{ start: 0, end: 1.5, text: "Hola, esto es una prueba" }], { width: W, height: H, brandAssColor: null }),
      "utf8"
    );
    // 1:1 crop with subtitles and logo (the heaviest path).
    await renderFinal({
      inputPath: p("master.mp4"),
      outputPath: p("final-1x1.mp4"),
      assPath: p("subs.ass"),
      crop: { width: W, height: W },
      logoPath: p("logo.png"),
    });
    expect(existsSync(p("final-1x1.mp4"))).toBe(true);
    expect(await dimensions(p("final-1x1.mp4"))).toEqual({ width: W, height: W });
    const final = await probeMedia(p("final-1x1.mp4"));
    expect(final.hasAudio).toBe(true);
    expect(Math.abs(final.durationSeconds - master.durationSeconds)).toBeLessThan(0.3);
  });
});

describe("silencedetect parsing", () => {
  it("handles a trailing silence with no end", () => {
    const stderr = "[silencedetect] silence_start: 1.2\n[silencedetect] silence_end: 2.5 | silence_duration: 1.3\nsilence_start: 4.1\n";
    expect(parseSilenceDetect(stderr, 5)).toEqual([[1.2, 2.5], [4.1, 5]]);
  });

  it("keeps the whole take when there is no speech at all", () => {
    expect(keepIntervalsFromSilences([[0, 3]], 3)).toEqual([[0, 3]]);
  });
});
