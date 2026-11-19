import { describe, expect, it } from "vitest";
import { decryptSecret, decryptToken, encryptSecret, encryptToken } from "@/lib/crypto";
import { signedMediaUrl, verifyMediaSignature } from "@/lib/signedMedia";

describe("encryption of API keys and tokens (AES-256-GCM)", () => {
  it("round-trips a secret", () => {
    const key = "sk-ant-api03-abcdefghijklmnopqrstuvwxyz0123456789";
    expect(decryptSecret(encryptSecret(key))).toBe(key);
  });

  it("never stores the plaintext and uses a fresh IV each time", () => {
    const key = "sk-test-1234567890";
    const a = encryptSecret(key);
    const b = encryptSecret(key);
    expect(a).not.toContain(key);
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[0-9a-f]{24}:[0-9a-f]{32}:[0-9a-f]+$/);
  });

  it("rejects a tampered ciphertext (auth tag)", () => {
    const [iv, tag, data] = encryptSecret("secret-value").split(":");
    const flipped = (data[0] === "0" ? "1" : "0") + data.slice(1);
    expect(() => decryptSecret([iv, tag, flipped].join(":"))).toThrow();
  });

  it("rejects malformed payloads", () => {
    expect(() => decryptSecret("not-encrypted")).toThrow(/Malformed/);
  });

  it("fails with a different ENCRYPTION_SECRET", () => {
    const payload = encryptSecret("value");
    const original = process.env.ENCRYPTION_SECRET;
    process.env.ENCRYPTION_SECRET = "another-secret";
    try {
      expect(() => decryptSecret(payload)).toThrow();
    } finally {
      process.env.ENCRYPTION_SECRET = original;
    }
  });

  it("decryptToken passes legacy plaintext Meta tokens through", () => {
    expect(decryptToken("EAAGlegacyPlainToken123")).toBe("EAAGlegacyPlainToken123");
    expect(decryptToken(encryptToken("EAAGnew"))).toBe("EAAGnew");
  });
});

describe("signed media URLs (Instagram fetches private files)", () => {
  it("accepts its own signature and rejects another key's", () => {
    const url = new URL(signedMediaUrl("biz1/videos/v1/final.mp4"));
    const [k, e, s] = ["k", "e", "s"].map((p) => url.searchParams.get(p)!);
    expect(verifyMediaSignature(k, e, s)).toBe(true);
    expect(verifyMediaSignature("biz2/videos/v1/final.mp4", e, s)).toBe(false);
  });

  it("rejects expired links", () => {
    const url = new URL(signedMediaUrl("biz1/a/b.mp4", -10));
    const [k, e, s] = ["k", "e", "s"].map((p) => url.searchParams.get(p)!);
    expect(verifyMediaSignature(k, e, s)).toBe(false);
  });
});
