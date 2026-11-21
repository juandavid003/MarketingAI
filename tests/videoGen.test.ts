import { afterEach, describe, expect, it, vi } from "vitest";
import { VIDEO_PROVIDERS, getVideoProvider, resolveVideoModel, sceneVideoPrompt, VideoGenError } from "@/lib/videoGen";
import { businessVideoAi } from "@/lib/videoGen/credentials";
import { encryptSecret } from "@/lib/crypto";
import type { PieceScene } from "@/lib/contentAi";

// The AI video layer must keep working when a provider or model changes:
// these pin the contract (registry, model resolution, prompt, and each
// provider's HTTP flow) without calling any real API.

const scene: PieceScene = {
  numero: 2,
  duracionSegundos: 6,
  queMostrar: "Manos amasando pan en una mesa de madera",
  queDecir: "Todo lo hacemos a mano, cada mañana.",
  textoPantalla: "Hecho a mano",
  comoGrabar: "Plano cenital, luz natural de ventana",
};
const business = { name: "Panadería Sol", industry: "Panadería", location: "Quito", brandTone: "cálido", brandColors: "#F59E0B" };

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("registry and model resolution", () => {
  it("lists unique providers with a default model each", () => {
    const ids = VIDEO_PROVIDERS.map((p) => p.id);
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

describe("credentials", () => {
  const base = { videoAiProvider: "gemini", videoAiKeyEncrypted: null, videoAiModel: null, geminiApiKeyEncrypted: null };

  it("is null without provider or key", () => {
    expect(businessVideoAi({ ...base, videoAiProvider: null })).toBeNull();
    expect(businessVideoAi(base)).toBeNull();
    expect(businessVideoAi({ ...base, videoAiProvider: "fal", geminiApiKeyEncrypted: encryptSecret("g") })).toBeNull();
  });

  it("reuses the Gemini review key for the Gemini provider", () => {
    const ai = businessVideoAi({ ...base, geminiApiKeyEncrypted: encryptSecret("AIza-review-key") });
    expect(ai?.apiKey).toBe("AIza-review-key");
    expect(ai?.model).toBe(getVideoProvider("gemini")!.defaultModel);
  });
});

describe("scene prompt", () => {
  it("describes the shot, asks for no on-screen text and carries the narration", () => {
    const prompt = sceneVideoPrompt(scene, business, "español");
    expect(prompt).toContain("Vertical 9:16");
    expect(prompt).toContain(scene.queMostrar);
    expect(prompt).toContain(scene.comoGrabar);
    expect(prompt).toContain("No on-screen text");
    expect(prompt).toContain(`"${scene.queDecir}"`);
    expect(prompt).not.toContain(scene.textoPantalla);
  });

  it("asks for ambient sound only when the scene has no dialogue", () => {
    expect(sceneVideoPrompt({ ...scene, queDecir: "" }, business, "español")).toContain("no speech");
  });
});

const mp4 = Buffer.from("fake-mp4-bytes");
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("gemini provider", () => {
  const gemini = getVideoProvider("gemini")!;
  const req = { prompt: "p", aspectRatio: "9:16" as const, durationSeconds: 6, generateAudio: true };

  it("sends model, aspect ratio and duration, and decodes the inline video", async () => {
    const fetchMock = vi.fn(async () =>
      json({ steps: [{ type: "model_output", content: [{ type: "video", mime_type: "video/mp4", data: mp4.toString("base64") }] }] })
    );
    vi.stubGlobal("fetch", fetchMock);
    const out = await gemini.generate(req, { apiKey: "k", model: "gemini-omni-1.2-flash" });
    expect(out.data.equals(mp4)).toBe(true);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toMatch(/\/v1beta\/interactions$/);
    expect(JSON.parse(String(init.body))).toMatchObject({
      model: "gemini-omni-1.2-flash",
      response_format: { type: "video", aspect_ratio: "9:16", duration: "6s" },
      store: false,
    });
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
  const req = { prompt: "p", aspectRatio: "9:16" as const, durationSeconds: 5, generateAudio: true };

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
    const done = fal.generate(req, { apiKey: "id:secret", model: "fal-ai/kling-video/o3/standard/text-to-video" });
    await vi.runAllTimersAsync();
    const out = await done;
    vi.useRealTimers();
    expect(out.data.equals(mp4)).toBe(true);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://queue.fal.run/fal-ai/kling-video/o3/standard/text-to-video");
    expect((init.headers as Record<string, string>).Authorization).toBe("Key id:secret");
    expect(JSON.parse(String(init.body))).toEqual({ prompt: "p", aspect_ratio: "9:16", duration: "5", generate_audio: true });
    expect(fetchMock.mock.calls[1][0]).toBe("https://q/status");
  });

  it("rejects model ids that aren't fal endpoint paths", async () => {
    vi.stubGlobal("fetch", vi.fn());
    await expect(fal.generate(req, { apiKey: "k", model: "../../etc" })).rejects.toBeInstanceOf(VideoGenError);
  });
});
