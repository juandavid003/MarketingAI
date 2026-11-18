import { createHmac, timingSafeEqual } from "crypto";
import { publicBaseUrl } from "@/lib/links";

// Short-lived public URLs for private files. Instagram's Content Publishing
// API downloads the video from a URL we give it (it doesn't accept uploads),
// but our files are private — so we hand it a link signed with our secret
// that works for one file and expires in ~1 hour. /api/media verifies it.

function secret(): string {
  const s = process.env.ENCRYPTION_SECRET;
  if (!s) throw new Error("Missing required environment variable: ENCRYPTION_SECRET");
  return s;
}

function sign(key: string, expires: number): string {
  return createHmac("sha256", secret()).update(`media:${key}:${expires}`).digest("base64url");
}

export function signedMediaUrl(key: string, ttlSeconds = 3600): string {
  const expires = Math.floor(Date.now() / 1000) + ttlSeconds;
  const url = new URL("/api/media", publicBaseUrl());
  url.searchParams.set("k", key);
  url.searchParams.set("e", String(expires));
  url.searchParams.set("s", sign(key, expires));
  return url.toString();
}

export function verifyMediaSignature(key: string, expires: string, signature: string): boolean {
  const exp = Number(expires);
  if (!Number.isInteger(exp) || exp < Math.floor(Date.now() / 1000)) return false;
  const expected = Buffer.from(sign(key, exp));
  const given = Buffer.from(signature);
  return expected.length === given.length && timingSafeEqual(expected, given);
}
