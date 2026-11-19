import { randomUUID } from "crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { loadAssistantData } from "@/lib/assistantData";
import { buildFacts } from "@/lib/assistant";

// The growth assistant's figures, computed from real rows: a "__test__"
// business with known leads, clicks and plan items, plus a second business
// whose rows must never leak into the first one's facts. Everything is
// deleted in afterAll (the user cascades to both businesses).

const run = randomUUID().slice(0, 8);
const userId = `__test__assistant-${run}`;
let businessId = "";
const DAY = 86_400_000;
const ago = (days: number) => new Date(Date.now() - days * DAY);

const businessData = (name: string) => ({
  userId,
  name: `__test__ ${name} ${run}`,
  industry: "test",
  description: "test",
  targetAudience: "test",
  location: "Quito, Ecuador",
  objective: "sales",
  avgTicket: 25,
});

beforeAll(async () => {
  await prisma.user.create({ data: { id: userId, name: "__test__ assistant", email: `${userId}@example.invalid`, enabled: true } });
  const biz = await prisma.business.create({ data: businessData("A") });
  const other = await prisma.business.create({ data: businessData("B") });
  businessId = biz.id;

  const campaign = await prisma.campaign.create({
    data: { businessId, title: "Navidad test", sourceInsight: "x", provider: "openai", model: "x", content: "{}" },
  });
  const link = await prisma.trackedLink.create({
    data: { businessId, slug: `t${run}a`, label: "Bio test", destinationUrl: "https://example.com", campaignId: campaign.id },
  });
  await prisma.linkClick.createMany({
    data: [
      ...Array.from({ length: 4 }, () => ({ linkId: link.id, createdAt: ago(2) })),
      ...Array.from({ length: 2 }, () => ({ linkId: link.id, createdAt: ago(40) })), // previous period
    ],
  });
  await prisma.lead.createMany({
    data: [
      { businessId, source: "tracked_link", trackedLinkId: link.id, campaignId: campaign.id, attribution: "high", status: "won", value: 80, occurredAt: ago(3) },
      { businessId, source: "whatsapp", attribution: "low", status: "new", occurredAt: ago(5) },
      { businessId, source: "whatsapp", attribution: "low", status: "lost", occurredAt: ago(45) },
    ],
  });
  await prisma.contentPlanItem.createMany({
    data: [
      { businessId, date: ago(4), platform: "instagram", format: "reel", title: "a", status: "published" },
      { businessId, date: ago(6), platform: "instagram", format: "post", title: "b", status: "planned" },
      { businessId, date: new Date(Date.now() + 3 * DAY), platform: "facebook", format: "post", title: "c" },
    ],
  });

  // Noise in the other business: must not show up.
  const otherLink = await prisma.trackedLink.create({
    data: { businessId: other.id, slug: `t${run}b`, label: "Otro", destinationUrl: "https://example.com" },
  });
  await prisma.linkClick.createMany({ data: Array.from({ length: 9 }, () => ({ linkId: otherLink.id })) });
  await prisma.lead.create({ data: { businessId: other.id, source: "other", attribution: "low", status: "won", value: 999 } });
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: userId } });
  await prisma.$disconnect();
});

describe("growth assistant data (real database)", () => {
  it("computes the figures from this business only", async () => {
    const business = await prisma.business.findUniqueOrThrow({ where: { id: businessId } });
    const d = await loadAssistantData(business);

    expect(d.current).toMatchObject({ clicks: 4, leads: 2, won: 1, value: 80 });
    expect(d.previous).toMatchObject({ clicks: 2, leads: 1, won: 0, value: 0 });
    expect(d.attribution30).toEqual({ high: 1, medium: 0, low: 1 });
    expect(d.openLeads).toEqual({ new: 1, contacted: 0, qualified: 0, oldestNewDays: 5 });
    expect(d.topCampaigns90).toEqual([{ name: "Navidad test", clicks: 6, leads: 1, won: 1, value: 80 }]);
    expect(d.topLinks30).toEqual([{ label: "Bio test", clicks: 4, leads: 1 }]);
    expect(d.sources30.map((s) => [s.label, s.leads]).sort()).toEqual([["Enlace rastreable", 1], ["WhatsApp", 1]]);
    expect(d.plan30).toEqual({ planned: 2, published: 1 });
    expect(d.planNext14).toBe(1);
    expect(d.avgTicket).toBe(25);

    const facts = buildFacts(d);
    expect(facts.find((f) => f.label.startsWith("Ventas registradas"))?.value).toBe("80");
    expect(JSON.stringify(facts)).not.toContain("999");
    expect(JSON.stringify(facts)).not.toContain("Otro");
  });
});
