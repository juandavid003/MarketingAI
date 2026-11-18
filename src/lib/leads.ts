// Leads: potential customers the owner registers, with where they came from.
// Business results (leads, sales, value) are kept apart from platform metrics
// (views, likes): a like is not a customer.

export const LEAD_SOURCES = [
  { value: "tracked_link", label: "Enlace rastreable" },
  { value: "promo_code", label: "Código promocional" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "instagram", label: "Instagram (mensaje o comentario)" },
  { value: "facebook", label: "Facebook (mensaje o comentario)" },
  { value: "tiktok", label: "TikTok" },
  { value: "website", label: "Sitio web / formulario" },
  { value: "phone", label: "Llamada" },
  { value: "walk_in", label: "Visita al local" },
  { value: "referral", label: "Recomendación" },
  { value: "other", label: "Otro / no sabe" },
] as const;

export const LEAD_STATUSES = [
  { value: "new", label: "Nuevo", tone: "brand" },
  { value: "contacted", label: "Contactado", tone: "neutral" },
  { value: "qualified", label: "Interesado", tone: "warning" },
  { value: "won", label: "Cliente (ganado)", tone: "success" },
  { value: "lost", label: "Perdido", tone: "danger" },
] as const;

export type Attribution = "high" | "medium" | "low";

export const ATTRIBUTION_LABEL: Record<Attribution, { label: string; help: string }> = {
  high: { label: "Alta", help: "Llegó por un enlace rastreable o usó un código promocional." },
  medium: { label: "Media", help: "El cliente dijo qué campaña o contenido vio." },
  low: { label: "Baja", help: "Solo sabemos el canal, no qué contenido lo trajo." },
};

export const leadSourceLabel = (v: string) => LEAD_SOURCES.find((s) => s.value === v)?.label ?? v;
export const leadStatus = (v: string) => LEAD_STATUSES.find((s) => s.value === v) ?? LEAD_STATUSES[0];

export function attributionFor(input: {
  trackedLinkId: string | null;
  promoCodeId: string | null;
  campaignId: string | null;
  contentPieceId: string | null;
}): Attribution {
  if (input.trackedLinkId || input.promoCodeId) return "high";
  if (input.campaignId || input.contentPieceId) return "medium";
  return "low";
}

export function normalizePromoCode(raw: string): string | null {
  const code = raw.trim().toUpperCase().replace(/\s+/g, "");
  return /^[A-Z0-9_-]{3,30}$/.test(code) ? code : null;
}

// Accepts "1500", "1.500", "1,500.50", "1.500,50", "$ 80": a separator
// followed by exactly 3 digits is a thousands separator, otherwise decimal.
export function parseMoney(raw: string): number | null {
  let s = raw.replace(/[^\d.,]/g, "");
  if (!s) return null;
  const last = Math.max(s.lastIndexOf(","), s.lastIndexOf("."));
  if (last >= 0 && s.length - last - 1 !== 3) {
    s = `${s.slice(0, last).replace(/[.,]/g, "")}.${s.slice(last + 1)}`;
  } else {
    s = s.replace(/[.,]/g, "");
  }
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 && n < 1e12 ? n : null;
}
