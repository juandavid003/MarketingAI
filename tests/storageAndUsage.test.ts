import { describe, expect, it } from "vitest";
import { assertValidKey, businessIdFromKey, localPath, storageKey } from "@/lib/storage";
import { checkUpload, formatBytes, monthStart, type UsageLimits } from "@/lib/usage";
import { safeNextPath } from "@/lib/safeNext";
import { hashInviteToken, newInviteToken, normalizeEmail } from "@/lib/members";
import { sanitizeDetails } from "@/lib/audit";

describe("storage keys (files are authorized by their first segment)", () => {
  it("builds keys under the business id", () => {
    const key = storageKey("biz_1", "videos", "v1", "original.mp4");
    expect(key).toBe("biz_1/videos/v1/original.mp4");
    expect(businessIdFromKey(key)).toBe("biz_1");
  });

  it("rejects traversal and absolute paths", () => {
    for (const bad of ["biz/../other/x.mp4", "../etc/passwd", "/abs/path.mp4", "biz", "biz//x", "biz/./x", "biz\\x\\y"]) {
      expect(() => assertValidKey(bad), bad).toThrow();
    }
    expect(() => storageKey("biz", "..", "x")).toThrow();
  });

  it("keeps resolved paths inside the storage root", () => {
    expect(localPath("biz/videos/a.mp4")).toMatch(/biz[\\/]videos[\\/]a\.mp4$/);
  });
});

describe("usage limits", () => {
  const limits: UsageLimits = { videoMinutesPerMonth: 120, storageBytes: 10 * 1024 ** 3 };

  it("allows uploads under both limits", () => {
    expect(checkUpload({ videoMinutes: 30, storageBytes: 1024 ** 3 }, limits, 200 * 1024 ** 2)).toBeNull();
  });

  it("blocks when the month's minutes are used up", () => {
    expect(checkUpload({ videoMinutes: 120, storageBytes: 0 }, limits, 1)).toMatch(/120 minutos/);
  });

  it("blocks when the file would not fit", () => {
    const msg = checkUpload({ videoMinutes: 0, storageBytes: 9.9 * 1024 ** 3 }, limits, 300 * 1024 ** 2);
    expect(msg).toMatch(/No queda espacio/);
  });

  it("month starts on day 1, UTC", () => {
    expect(monthStart(new Date("2026-11-19T15:00:00Z")).toISOString()).toBe("2026-11-01T00:00:00.000Z");
    expect(formatBytes(1536 * 1024 ** 2)).toBe("1.5 GB");
  });
});

describe("team invitations", () => {
  it("tokens are random and only their hash is comparable", () => {
    const a = newInviteToken();
    const b = newInviteToken();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(hashInviteToken(a)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashInviteToken(a)).not.toContain(a);
  });

  it("normalizes emails", () => {
    expect(normalizeEmail("  Ana@Example.COM ")).toBe("ana@example.com");
    expect(normalizeEmail("no-at-sign")).toBeNull();
  });

  it("post-login redirect only allows invite links (no open redirect)", () => {
    const token = newInviteToken();
    expect(safeNextPath(`/invite/${token}`)).toBe(`/invite/${token}`);
    for (const bad of ["https://evil.com", "//evil.com", "/business/x", `/invite/${token}/../../admin`, undefined]) {
      expect(safeNextPath(bad)).toBeUndefined();
    }
  });
});

describe("audit details", () => {
  it("drops anything that looks like a secret", () => {
    const json = sanitizeDetails({ provider: "openai", apiKey: "sk-123", accessToken: "EAAG", password: "x", page: "Mi página" });
    expect(JSON.parse(json!)).toEqual({ provider: "openai", page: "Mi página" });
    expect(sanitizeDetails({ token: "x" })).toBeNull();
  });
});
