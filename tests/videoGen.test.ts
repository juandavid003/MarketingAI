import { execFile, execFileSync } from "child_process";
import { mkdtempSync, readFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { promisify } from "util";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import {
  VIDEO_PROVIDERS,
  getVideoProvider,
  parseVideoModels,
  promptWithNarration,
  resolveVideoModel,
  sceneVideoPrompt,
  VideoGenError,
} from "@/lib/videoGen";
import { availableVideoProviderIds, businessVideoAi, encryptedKeyFor, type VideoKeyFields } from "@/lib/videoGen/credentials";
import { classifyScene, recommendProvider, stackStatus } from "@/lib/videoGen/recommend";
import { renderStillMotion } from "@/lib/videoGen/stillMotion";
import { encryptSecret } from "@/lib/crypto";
import { ffmpegPath } from "@/lib/video";
import { probeMedia } from "@/lib/videoEdit";
import type { PieceScene } from "@/lib/contentAi";

// The AI video layer must keep working when a provider or model changes:
// these pin the contract (registry, keys, recommendation, prompt, and each
// provider's HTTP flow) without calling any real API. The OpenAI still
// provider also runs real ffmpeg on a generated image and voice.

const execFileAsync = promisify(execFile);

const scene: PieceScene = {
  numero: 2,
  duracionSegundos: 6,
  queMostrar: "Manos amasando pan en una mesa de madera",
  queDecir: "Todo lo hacemos a mano, cada mañana.",
  textoPantalla: "Hecho a mano",
  comoGrabar: "Plano cenital, luz natural de ventana",
};
const productScene: PieceScene = {
  ...scene,
  queMostrar: "El pastel de chocolate en la vitrina, primer plano",
  comoGrabar: "Celular fijo, luz suave",
};
const business = { name: "Panadería Sol", industry: "Panadería", location: "Quito", brandTone: "cálido", brandColors: "#F59E0B" };
const ids = VIDEO_PROVIDERS.map((p) => p.id);

const noKeys: VideoKeyFields = {
  aiProvider: null,
  aiApiKeyEncrypted: null,
  openaiImageKeyEncrypted: null,
  openaiTranscriptionKeyEncrypted: null,
  geminiApiKeyEncrypted: null,
  falApiKeyEncrypted: null,
  videoAiModels: null,
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("registry and models", () => {
  it("lists unique providers with a default model each", () => {
    expect(new Set(ids).size).toBe(ids.length);
    for (const p of VIDEO_PROVIDERS) expect(p.defaultModel).toBeTruthy();
    expect(getVideoProvider("nope")).toBeNull();
  });

  it("business model > env default > built-in default", () => {
    const fal = getVideoProvider("fal")!;
    expect(resolveVideoModel(fal, null)).toBe(fal.defaultModel);
    vi.stubEnv("VIDEO_AI_DEFAULT_MODEL_FAL", "fal-ai/new-model/text-to-video");
    expect(resolveVideoModel(fal, "  ")).toBe("fal-ai/new-model/text-to-video");
    expect(resolveVideoModel(fal, "fal-ai/mine")).toBe("fal-ai/mine");
  });

  it("parses the per-provider model map defensively", () => {
    expect(parseVideoModels('{"fal":"fal-ai/x","gemini":"  ","openai":3}')).toEqual({ fal: "fal-ai/x" });
    expect(parseVideoModels("not json")).toEqual({});
    expect(parseVideoModels("[1]")).toEqual({});
  });

  it("clamps durations to what each model accepts", () => {
    const gemini = getVideoProvider("gemini")!;
    const fal = getVideoProvider("fal")!;
    expect(gemini.clampDuration(1, gemini.defaultModel)).toBe(3);
    expect(gemini.clampDuration(40, gemini.defaultModel)).toBe(15);
    expect(fal.clampDuration(6, "fal-ai/kling-video/v2.1/standard/text-to-video")).toBe(5);
    expect(fal.clampDuration(9, "fal-ai/kling-video/v2.1/standard/text-to-video")).toBe(10);
    expect(fal.clampDuration(2, "fal-ai/seedance-2/fast/text-to-video")).toBe(4);
  });
});

describe("keys per provider", () => {
  it("nothing without keys; Claude alone doesn't make video", () => {
    expect(availableVideoProviderIds(noKeys)).toEqual([]);
    expect(availableVideoProviderIds({ ...noKeys, aiProvider: "anthropic", aiApiKeyEncrypted: "x" })).toEqual([]);
  });

  it("any OpenAI key enables the OpenAI still provider (Claude + OpenAI setup)", () => {
    const claudePlusWhisper = { ...noKeys, aiProvider: "anthropic", aiApiKeyEncrypted: "claude", openaiTranscriptionKeyEncrypted: "oa" };
    expect(availableVideoProviderIds(claudePlusWhisper)).toEqual(["openai"]);
    expect(encryptedKeyFor("openai", { ...claudePlusWhisper, openaiImageKeyEncrypted: "img" })).toBe("img");
    expect(encryptedKeyFor("openai", { ...noKeys, aiProvider: "openai", aiApiKeyEncrypted: "text" })).toBe("text");
  });

  it("Gemini reuses the review key, fal needs its own, model overrides apply", () => {
    const b = { ...noKeys, geminiApiKeyEncrypted: encryptSecret("AIza-review"), videoAiModels: '{"gemini":"gemini-next"}' };
    expect(availableVideoProviderIds(b)).toEqual(["gemini"]);
    const ai = businessVideoAi(b, "gemini");
    expect(ai?.apiKey).toBe("AIza-review");
    expect(ai?.model).toBe("gemini-next");
    expect(businessVideoAi(b, "fal")).toBeNull();
  });
});

describe("recommendation", () => {
  it("classifies scenes by what the camera sees", () => {
    expect(classifyScene(scene)).toBe("action");
    expect(classifyScene(productScene)).toBe("still");
  });

  it("action → real motion; product → OpenAI image is the pick", () => {
    expect(recommendProvider({ scene, platforms: ["instagram"], available: ids, providerIds: ids }).best).not.toBe("openai");
    expect(recommendProvider({ scene: productScene, platforms: ["instagram"], available: ids, providerIds: ids }).best).toBe("openai");
  });

  it("with only OpenAI it still recommends what's usable, and says what would be better", () => {
    const action = recommendProvider({ scene, platforms: ["tiktok"], available: ["openai"], providerIds: ids });
    expect(action.best).toBe("openai");
    expect(action.bestOverall).not.toBe("openai");
    expect(action.upgradeHint).toMatch(/agrega su key/);
    const product = recommendProvider({ scene: productScene, platforms: ["tiktok"], available: ["openai"], providerIds: ids });
    expect(product.upgradeHint).toBeNull();
    for (const r of action.ranking) expect(r.reasons.length).toBeGreaterThan(0);
  });

  it("marks which recommended jobs the business can already do", () => {
    const s = stackStatus({ anthropic: true, openai: true, gemini: false, fal: false });
    expect(s.find((r) => r.job.startsWith("Guiones"))?.ready).toBe(true);
    expect(s.find((r) => r.job.startsWith("Revisión visual"))?.ready).toBe(false);
    expect(s.find((r) => r.job.includes("producto"))?.ready).toBe(true);
  });
});

describe("scene prompt", () => {
  it("visual has the shot and no on-screen text; narration is separate", () => {
    const { visual, narration } = sceneVideoPrompt(scene, business);
    expect(visual).toContain("Vertical 9:16");
    expect(visual).toContain(scene.queMostrar);
    expect(visual).toContain("No on-screen text");
    expect(visual).not.toContain(scene.textoPantalla);
    expect(narration).toBe(scene.queDecir);
  });

  it("models with native sound get the narration inside the prompt", () => {
    expect(promptWithNarration({ visual: "v", narration: "Hola", language: "español" })).toContain('in español: "Hola"');
    expect(promptWithNarration({ visual: "v", narration: " ", language: "español" })).toContain("no speech");
  });
});

const mp4 = Buffer.from("fake-mp4-bytes");
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const req = { visual: "v", narration: "Hola", language: "español", aspectRatio: "9:16" as const, durationSeconds: 6 };

describe("gemini provider", () => {
  const gemini = getVideoProvider("gemini")!;

  it("sends model, aspect ratio, duration and narration, and decodes the inline video", async () => {
    const fetchMock = vi.fn(async () =>
      json({ steps: [{ type: "model_output", content: [{ type: "video", mime_type: "video/mp4", data: mp4.toString("base64") }] }] })
    );
    vi.stubGlobal("fetch", fetchMock);
    const out = await gemini.generate(req, { apiKey: "k", model: "gemini-omni-1.2-flash" });
    expect(out.data.equals(mp4)).toBe(true);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toMatch(/\/v1beta\/interactions$/);
    const body = JSON.parse(String(init.body));
    expect(body).toMatchObject({ model: "gemini-omni-1.2-flash", response_format: { type: "video", aspect_ratio: "9:16", duration: "6s" }, store: false });
    expect(body.input).toContain('"Hola"');
  });

  it("downloads when the video comes as a URI", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json({ steps: [{ content: [{ type: "video", mime_type: "video/mp4", uri: "https://files/x:download?alt=media" }] }] }))
      .mockResolvedValueOnce(new Response(mp4));
    vi.stubGlobal("fetch", fetchMock);
    const out = await gemini.generate(req, { apiKey: "k", model: "m" });
    expect(out.data.equals(mp4)).toBe(true);
    expect(fetchMock.mock.calls[1][0]).toBe("https://files/x:download?alt=media");
  });

  it("turns a missing video and a rejected key into owner-readable errors", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ steps: [{ type: "model_output", content: [{ type: "text", text: "blocked" }] }] })));
    await expect(gemini.generate(req, { apiKey: "k", model: "m" })).rejects.toBeInstanceOf(VideoGenError);
    vi.stubGlobal("fetch", vi.fn(async () => json({ error: { message: "API key not valid" } }, 403)));
    await expect(gemini.generate(req, { apiKey: "k", model: "m" })).rejects.toThrow(/rechazó la API key/);
  });
});

describe("fal provider", () => {
  const fal = getVideoProvider("fal")!;

  it("submits to the queue, polls the status URL and downloads the result", async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json({ request_id: "r1", status_url: "https://q/status", response_url: "https://q/result" }))
      .mockResolvedValueOnce(json({ status: "IN_PROGRESS" }))
      .mockResolvedValueOnce(json({ status: "COMPLETED" }))
      .mockResolvedValueOnce(json({ video: { url: "https://cdn/out.mp4", content_type: "video/mp4" } }))
      .mockResolvedValueOnce(new Response(mp4));
    vi.stubGlobal("fetch", fetchMock);
    const done = fal.generate({ ...req, durationSeconds: 5 }, { apiKey: "id:secret", model: "fal-ai/kling-video/o3/standard/text-to-video" });
    await vi.runAllTimersAsync();
    const out = await done;
    expect(out.data.equals(mp4)).toBe(true);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://queue.fal.run/fal-ai/kling-video/o3/standard/text-to-video");
    expect((init.headers as Record<string, string>).Authorization).toBe("Key id:secret");
    expect(JSON.parse(String(init.body))).toMatchObject({ aspect_ratio: "9:16", duration: "5", generate_audio: true });
    expect(fetchMock.mock.calls[1][0]).toBe("https://q/status");
  });

  it("rejects model ids that aren't fal endpoint paths", async () => {
    vi.stubGlobal("fetch", vi.fn());
    await expect(fal.generate(req, { apiKey: "k", model: "../../etc" })).rejects.toBeInstanceOf(VideoGenError);
  });
});

// --- OpenAI still provider + ffmpeg -------------------------------------

function hasFfmpeg(): boolean {
  try {
    execFileSync(ffmpegPath(), ["-version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}
const FFMPEG = hasFfmpeg();
if (!FFMPEG) console.warn("[videoGen.test] ffmpeg not found — still-motion tests skipped");

describe.skipIf(!FFMPEG)("OpenAI still provider (real ffmpeg)", () => {
  let dir = "";
  let png: Buffer;
  let mp3: Buffer;

  beforeAll(async () => {
    dir = mkdtempSync(path.join(tmpdir(), "videogen-test-"));
    // A 2:3 portrait "photo" like GPT Image returns, and 2 s of "voice".
    await execFileAsync(ffmpegPath(), ["-y", "-f", "lavfi", "-i", "testsrc2=s=256x384", "-frames:v", "1", path.join(dir, "img.png")]);
    await execFileAsync(ffmpegPath(), ["-y", "-f", "lavfi", "-i", "sine=frequency=440:duration=2", "-c:a", "libmp3lame", path.join(dir, "voice.mp3")]);
    png = readFileSync(path.join(dir, "img.png"));
    mp3 = readFileSync(path.join(dir, "voice.mp3"));
  });
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it("renders a vertical clip with movement and a silent track when there's no voice", async () => {
    const out = path.join(dir, "silent.mp4");
    await renderStillMotion({ imagePath: path.join(dir, "img.png"), audioPath: null, durationSeconds: 1.5, outputPath: out, width: 180, height: 320 });
    const { durationSeconds, hasAudio } = await probeMedia(out);
    expect(durationSeconds).toBeGreaterThan(1.3);
    expect(durationSeconds).toBeLessThan(1.8);
    expect(hasAudio).toBe(true);
  });

  it("asks OpenAI for an image and a voice, and lasts as long as the voice needs", async () => {
    const fetchMock = vi.fn(async (url: string) =>
      url.includes("/images/") ? json({ data: [{ b64_json: png.toString("base64") }] }) : new Response(new Uint8Array(mp3))
    );
    vi.stubGlobal("fetch", fetchMock);
    const openai = getVideoProvider("openai")!;
    const out = await openai.generate(
      { visual: "A chocolate cake", narration: "Recién hecho", language: "español", aspectRatio: "9:16", durationSeconds: 1 },
      { apiKey: "sk-test", model: "gpt-image-2" }
    );
    const file = path.join(dir, "generated.mp4");
    await import("fs/promises").then((fs) => fs.writeFile(file, out.data));
    const { durationSeconds, hasAudio } = await probeMedia(file);
    expect(hasAudio).toBe(true);
    expect(durationSeconds).toBeGreaterThan(2.3); // 2 s voice + margin, longer than the 1 s asked

    const calls = fetchMock.mock.calls.map((c) => c[0] as string);
    expect(calls.some((u) => u.endsWith("/v1/images/generations"))).toBe(true);
    expect(calls.some((u) => u.endsWith("/v1/audio/speech"))).toBe(true);
    const imageCall = fetchMock.mock.calls.find((c) => String(c[0]).includes("/images/")) as unknown as [string, RequestInit];
    const imageBody = JSON.parse(String(imageCall[1].body));
    expect(imageBody).toMatchObject({ model: "gpt-image-2", size: "1024x1536" });
    expect(imageBody.prompt).toMatch(/no text/i);
  }, 120_000);

  it("explains a failed image in words the owner can act on", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ error: { message: "Your request was rejected by the safety system" } }, 400)));
    const openai = getVideoProvider("openai")!;
    await expect(
      openai.generate({ visual: "x", narration: "", language: "español", aspectRatio: "9:16", durationSeconds: 3 }, { apiKey: "k", model: "gpt-image-2" })
    ).rejects.toThrow(/OpenAI no pudo crear la imagen/);
  });
});
