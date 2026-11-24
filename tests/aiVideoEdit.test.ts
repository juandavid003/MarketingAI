import { describe, expect, it } from "vitest";
import { validateEditPlan, clipKeepToCut, planCaption, buildEditPrompt } from "@/lib/aiVideoEdit";

describe("validateEditPlan", () => {
  it("keeps the AI's order, clamps to the video and drops slivers", () => {
    const plan = validateEditPlan(
      {
        cortes: [
          { inicio: 20, fin: 24 },
          { inicio: 2, fin: 10 },
          { inicio: 50, fin: 80 }, // clamped to 60
          { inicio: 5, fin: 5.1 }, // sliver
        ],
        hook: "¿Sabías esto?",
        cta: "Escríbenos",
        titulo: "",
        caption: "Mira esto",
        hashtags: ["tacos", "#cdmx", " "],
        razon: "Empieza con la frase más fuerte",
      },
      60
    );
    expect(plan.cuts).toEqual([
      [20, 24],
      [2, 10],
      [50, 60],
    ]);
    expect(plan.hashtags).toEqual(["#tacos", "#cdmx"]);
    expect(plan.reason).toBe("Empieza con la frase más fuerte");
  });

  it("never repeats footage when cuts overlap", () => {
    const plan = validateEditPlan({ cortes: [{ inicio: 0, fin: 10 }, { inicio: 8, fin: 15 }, { inicio: 2, fin: 6 }] }, 30);
    expect(plan.cuts).toEqual([
      [0, 10],
      [10, 15],
    ]);
  });

  it("caps the total length", () => {
    const plan = validateEditPlan({ cortes: [{ inicio: 0, fin: 50 }, { inicio: 60, fin: 120 }] }, 200, 70);
    expect(plan.cuts).toEqual([
      [0, 50],
      [60, 80],
    ]);
  });

  it("rejects an answer with no usable cuts", () => {
    expect(() => validateEditPlan({ cortes: [{ inicio: "x", fin: 3 }] }, 30)).toThrow();
    expect(() => validateEditPlan({}, 30)).toThrow();
  });
});

describe("clipKeepToCut", () => {
  it("keeps only the speech inside the cut", () => {
    expect(
      clipKeepToCut(
        [
          [0, 3],
          [4, 9],
          [12, 20],
        ],
        [2, 14]
      )
    ).toEqual([
      [2, 3],
      [4, 9],
      [12, 14],
    ]);
  });

  it("falls back to the whole cut when it has no speech", () => {
    expect(clipKeepToCut([[0, 3]], [5, 8])).toEqual([[5, 8]]);
  });
});

describe("planCaption / prompt", () => {
  it("joins title, caption and hashtags", () => {
    expect(
      planCaption({ cuts: [[0, 1]], hook: "", cta: "", title: "Título", caption: "Texto", hashtags: ["#a", "#b"], reason: "" })
    ).toBe("Título\n\nTexto\n\n#a #b");
  });

  it("includes the platform rules and the owner's instructions", () => {
    const prompt = buildEditPrompt({
      business: { name: "Taquería", industry: "Restaurantes", description: "", targetAudience: "", location: "", objective: "", products: [], mainPlatforms: [], contentLanguage: "es" } as never,
      platform: "tiktok",
      segments: [{ start: 0, end: 2.5, text: "Hola" }],
      durationSeconds: 30,
      instructions: "enfócate en el 2x1",
      watchesVideo: false,
    });
    expect(prompt).toContain("TikTok");
    expect(prompt).toContain("enfócate en el 2x1");
    expect(prompt).toContain("[0.0 - 2.5] Hola");
  });
});
