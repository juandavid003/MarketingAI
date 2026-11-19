import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { destinationWithUtm, deviceType, isBot, normalizeDestination, referrerHost } from "@/lib/links";

// The /r/[slug] route handler runs against an in-memory fake of Prisma.
const db = vi.hoisted(() => ({
  links: new Map<string, Record<string, unknown>>(),
  clicks: [] as Record<string, unknown>[],
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    trackedLink: { findUnique: async ({ where }: { where: { slug: string } }) => db.links.get(where.slug) ?? null },
    linkClick: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        db.clicks.push(data);
        return data;
      },
    },
  },
}));

const { GET } = await import("@/app/r/[slug]/route");

const PHONE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

function hit(slug: string, headers: Record<string, string> = {}) {
  const req = new NextRequest(`https://app.example.com/r/${slug}`, { headers });
  return GET(req, { params: Promise.resolve({ slug }) });
}

beforeEach(() => {
  process.env.PUBLIC_APP_URL = "https://app.example.com";
  db.links.clear();
  db.clicks.length = 0;
  db.links.set("abc1234", {
    id: "link1",
    slug: "abc1234",
    archived: false,
    destinationUrl: "https://shop.example.com/pasteles?ref=bio",
    utmSource: "instagram",
    utmMedium: "social",
    utmCampaign: "navidad",
    utmContent: null,
  });
  db.links.set("wa12345", {
    id: "link2",
    slug: "wa12345",
    archived: false,
    destinationUrl: "https://wa.me/593990000000?text=Hola%20(ref%3A%20wa12345)",
    utmSource: "instagram",
    utmMedium: null,
    utmCampaign: null,
    utmContent: null,
  });
  db.links.set("old0000", { id: "link3", slug: "old0000", archived: true, destinationUrl: "https://x.example.com/" });
});

describe("/r/[slug] tracked-link redirect", () => {
  it("redirects to the destination with UTM and counts a person's click", async () => {
    const res = await hit("abc1234", { "user-agent": PHONE_UA, referer: "https://www.instagram.com/" });
    expect(res.status).toBe(302);
    const target = new URL(res.headers.get("location")!);
    expect(target.host).toBe("shop.example.com");
    expect(target.searchParams.get("ref")).toBe("bio");
    expect(target.searchParams.get("utm_source")).toBe("instagram");
    expect(target.searchParams.get("utm_campaign")).toBe("navidad");
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(db.clicks).toEqual([{ linkId: "link1", device: "mobile", referrerHost: "instagram.com" }]);
  });

  it("does not count link previews / bots, but still redirects them", async () => {
    const res = await hit("abc1234", { "user-agent": "WhatsApp/2.23.20 A" });
    expect(res.status).toBe(302);
    expect(db.clicks).toHaveLength(0);
    const resNoUa = await hit("abc1234");
    expect(resNoUa.status).toBe(302);
    expect(db.clicks).toHaveLength(0);
  });

  it("leaves WhatsApp destinations untouched (no UTM in the message)", async () => {
    const res = await hit("wa12345", { "user-agent": PHONE_UA });
    expect(res.headers.get("location")).toBe("https://wa.me/593990000000?text=Hola%20(ref%3A%20wa12345)");
  });

  it("sends unknown, malformed and archived slugs to the public home, never elsewhere", async () => {
    for (const slug of ["nope999", "../../etc", "old0000", "A"]) {
      const res = await hit(slug, { "user-agent": PHONE_UA });
      expect(res.status).toBe(302);
      expect(res.headers.get("location")).toBe("https://app.example.com/");
    }
    expect(db.clicks).toHaveLength(0);
  });
});

describe("link helpers", () => {
  it("never overwrites UTM the destination already has", () => {
    const out = new URL(destinationWithUtm("https://a.com/?utm_source=mine", { source: "ig", medium: "social" }));
    expect(out.searchParams.get("utm_source")).toBe("mine");
    expect(out.searchParams.get("utm_medium")).toBe("social");
  });

  it("only accepts http(s) destinations with a real host", () => {
    expect(normalizeDestination("tienda.com/promo")).toBe("https://tienda.com/promo");
    expect(normalizeDestination("javascript:alert(1)")).toBeNull();
    expect(normalizeDestination("localhost")).toBeNull();
    expect(normalizeDestination("   ")).toBeNull();
  });

  it("classifies devices and bots", () => {
    expect(deviceType(PHONE_UA)).toBe("mobile");
    expect(deviceType("Mozilla/5.0 (Windows NT 10.0; Win64; x64)")).toBe("desktop");
    expect(isBot("facebookexternalhit/1.1")).toBe(true);
    expect(isBot(PHONE_UA)).toBe(false);
    expect(referrerHost("not a url")).toBeNull();
  });
});
