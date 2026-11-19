import { describe, expect, it } from "vitest";
import { buildAssistantPrompt, buildFacts, parseAnswer, type AssistantData } from "@/lib/assistant";

const zero = { clicks: 0, leads: 0, won: 0, value: 0 };

function data(over: Partial<AssistantData> = {}): AssistantData {
  return {
    businessId: "biz1",
    avgTicket: null,
    current: { clicks: 42, leads: 5, won: 2, value: 1500 },
    previous: { clicks: 10, leads: 1, won: 0, value: 0 },
    attribution30: { high: 3, medium: 1, low: 1 },
    openLeads: { new: 2, contacted: 1, qualified: 0, oldestNewDays: 6 },
    topCampaigns90: [{ name: "Navidad", clicks: 30, leads: 4, won: 2, value: 1500 }],
    topPieces90: [],
    sources30: [{ label: "WhatsApp", leads: 3, won: 1 }],
    topLinks30: [{ label: "Bio de Instagram", clicks: 25, leads: 2 }],
    plan30: { planned: 12, published: 9 },
    planNext14: 4,
    publishing30: { published: 6, failed: 1 },
    scheduledNext14: 3,
    creatives90: [{ code: "H2C1", hook: "¿Sabías que…?", views: 1200, interactions: 80, clicks: 7 }],
    competitors: [{ name: "Panadería Rival", followers: 3400, postsPerWeek: 4.5, avgInteractions: 120, topFormat: "Reel" }],
    seasonal: [{ name: "Navidad", date: "25 de diciembre", daysUntil: 36, prepareNow: true, angle: "regalos" }],
    profileMissing: ["Tono de la marca"],
    videosReady: 3,
    ...over,
  };
}

describe("growth assistant facts", () => {
  it("numbers facts in order and links each to the page it comes from", () => {
    const facts = buildFacts(data());
    expect(facts.map((f) => f.id)).toEqual(facts.map((_, i) => `F${i + 1}`));
    for (const f of facts) expect(f.href).toMatch(/^\/business\/biz1(\/|$)/);
    const leads = facts.find((f) => f.label.startsWith("Leads registrados"))!;
    expect(leads.value).toBe("5");
    expect(leads.href).toBe("/business/biz1/results?days=30");
  });

  it("says when nothing brought results instead of leaving a gap", () => {
    const facts = buildFacts(data({ current: zero, previous: zero, topCampaigns90: [], topPieces90: [], sources30: [], topLinks30: [] }));
    expect(facts.find((f) => f.label.startsWith("Campañas con clics"))?.value).toBe("ninguna");
    // No attribution breakdown when there are no leads.
    expect(facts.some((f) => f.label.startsWith("Confianza"))).toBe(false);
  });

  it("keeps platform metrics apart from business results", () => {
    const creative = buildFacts(data()).find((f) => f.label.includes("H2C1"))!;
    expect(creative.topic).toBe("Distribuidor");
    expect(creative.label).toMatch(/métricas de redes/);
  });

  it("puts every fact in the prompt with its id, plus the rules", () => {
    const facts = buildFacts(data());
    const prompt = buildAssistantPrompt({
      business: {
        name: "Dulce Hogar",
        industry: "Panadería",
        description: "Pan",
        products: [],
        targetAudience: "Familias",
        location: "Quito",
        objective: "sales",
        contentLanguage: "es",
        mainPlatforms: [],
      },
      facts,
      history: [{ role: "user", content: "hola" }],
      question: "¿Qué funciona?",
      today: "jueves, 19 de noviembre de 2026",
    });
    for (const f of facts) expect(prompt).toContain(`[${f.id}]`);
    expect(prompt).toMatch(/No inventes cifras/);
    expect(prompt).toContain("Usuario: hola");
    expect(prompt.trim().endsWith("¿Qué funciona?")).toBe(true);
  });
});

describe("growth assistant answer checks", () => {
  const facts = buildFacts(data());
  const id = (prefix: string) => facts.find((f) => f.label.startsWith(prefix))!.id;

  it("turns citations into links to real facts", () => {
    const text = `Tuviste 5 leads [${id("Leads registrados")}] y 42 clics [${id("Clics")}].`;
    const parsed = parseAnswer(text, facts);
    expect(parsed.cited.map((f) => f.value)).toEqual(["5", "42"]);
    expect(parsed.unknownIds).toEqual([]);
    expect(parsed.unsourcedNumbers).toEqual([]);
    expect(parsed.parts.filter((p) => p.type === "cite")).toHaveLength(2);
    // The text around the citations is kept intact.
    expect(parsed.parts.map((p) => (p.type === "text" ? p.text : "")).join("")).toBe("Tuviste 5 leads  y 42 clics .");
  });

  it("flags citations that point to nothing", () => {
    const parsed = parseAnswer("Vendiste mucho [F999].", facts);
    expect(parsed.unknownIds).toEqual(["F999"]);
    expect(parsed.cited).toEqual([]);
  });

  it("flags figures that are not in the data", () => {
    const parsed = parseAnswer(`Tus ventas subieron 37% y tuviste 250 visitas [${id("Leads registrados")}].`, facts);
    expect(parsed.unsourcedNumbers).toEqual(["37", "250"]);
  });

  it("accepts figures from the data in any thousands format, and small advice counts", () => {
    const parsed = parseAnswer(`Vendiste 1.500 [${id("Ventas")}] y tu creativo tuvo 1200 vistas. Publica 3 reels esta semana.`, facts);
    expect(parsed.unsourcedNumbers).toEqual([]);
  });
});
