import { randomBytes } from "crypto";

// Tracked links: /r/<slug> counts the click and redirects to the real
// destination with UTM parameters, so the business's own analytics (and our
// results panel) can tell which campaign/content brought the visit.
//
// Privacy: a click stores only its time, a coarse device type and the
// referring site's host. No IP, no user agent, no cookies.

const SLUG_ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789"; // no look-alikes (l/1, o/0)

export function newSlug(length = 7): string {
  const bytes = randomBytes(length);
  return Array.from(bytes, (b) => SLUG_ALPHABET[b % SLUG_ALPHABET.length]).join("");
}

export function publicBaseUrl(): string {
  return (process.env.PUBLIC_APP_URL ?? process.env.BETTER_AUTH_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

export function shortUrl(slug: string): string {
  return `${publicBaseUrl()}/r/${slug}`;
}

export function isWhatsAppUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === "wa.me" || host.endsWith("whatsapp.com");
  } catch {
    return false;
  }
}

// wa.me link with a prefilled message. The message carries the link's ref so
// the owner can tell, when the chat arrives, which link it came from.
export function whatsAppUrl(phone: string, message: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 8) return null;
  return `https://wa.me/${digits}${message ? `?text=${encodeURIComponent(message)}` : ""}`;
}

export function normalizeDestination(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(withScheme);
    if (!["http:", "https:"].includes(url.protocol) || !url.hostname.includes(".")) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export type Utm = { source?: string | null; medium?: string | null; campaign?: string | null; content?: string | null };

// Adds UTM parameters without overwriting ones the destination already has.
// WhatsApp links are left alone: UTM means nothing there and could end up in
// the prefilled message.
export function destinationWithUtm(destination: string, utm: Utm): string {
  if (isWhatsAppUrl(destination)) return destination;
  const url = new URL(destination);
  const set = (key: string, value: string | null | undefined) => {
    if (value && !url.searchParams.has(key)) url.searchParams.set(key, value);
  };
  set("utm_source", utm.source);
  set("utm_medium", utm.medium);
  set("utm_campaign", utm.campaign);
  set("utm_content", utm.content);
  return url.toString();
}

export function slugifyUtm(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

// Link previews (WhatsApp, Facebook, Slack...) and crawlers fetch the URL
// too; they are not people and must not count as clicks.
const BOT_RE =
  /bot|crawl|spider|slurp|preview|facebookexternalhit|facebookcatalog|whatsapp|telegram|discord|skype|embedly|quora link|pinterest|vkshare|headless|lighthouse|curl|wget|python-requests|httpclient/i;

export function isBot(userAgent: string | null): boolean {
  return !userAgent || BOT_RE.test(userAgent);
}

export function deviceType(userAgent: string | null): "mobile" | "tablet" | "desktop" {
  const ua = userAgent ?? "";
  if (/ipad|tablet|kindle|silk|playbook|(android(?!.*mobile))/i.test(ua)) return "tablet";
  if (/mobi|iphone|ipod|android|blackberry|opera mini|iemobile/i.test(ua)) return "mobile";
  return "desktop";
}

export function referrerHost(referer: string | null): string | null {
  if (!referer) return null;
  try {
    return new URL(referer).hostname.replace(/^www\./, "").slice(0, 120);
  } catch {
    return null;
  }
}
