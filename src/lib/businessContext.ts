import type { Business, Product } from "@/generated/prisma/client";
import { OBJECTIVES, CONTENT_LANGUAGES, PLATFORMS } from "@/lib/constants";

// The single place that turns a Business row into the context every AI
// prompt receives. Previously each server action hand-copied the same seven
// fields; adding a profile field meant editing every call site.
//
// Industry-agnostic on purpose: there is no per-industry branching here or in
// the prompts. Personalization comes entirely from what the business filled
// in about itself.
export type AiBusinessContext = {
  name: string;
  industry: string;
  subIndustry?: string | null;
  description: string;
  products: { name: string }[];
  avgTicket?: number | null;
  targetAudience: string;
  customerPersonas?: string | null;
  location: string;
  serviceArea?: string | null;
  valueProposition?: string | null;
  objective: string;
  businessGoals?: string | null;
  conversionGoal?: string | null;
  brandTone?: string | null;
  brandColors?: string | null;
  contentLanguage: string;
  mainPlatforms: string[];
  preferredCtas?: string | null;
  websiteUrl?: string | null;
  whatsapp?: string | null;
  contactEmail?: string | null;
};

export function toAiBusiness(business: Business & { products: Product[] }): AiBusinessContext {
  return {
    name: business.name,
    industry: business.industry,
    subIndustry: business.subIndustry,
    description: business.description,
    products: business.products.map((p) => ({ name: p.name })),
    avgTicket: business.avgTicket,
    targetAudience: business.targetAudience,
    customerPersonas: business.customerPersonas,
    location: business.location,
    serviceArea: business.serviceArea,
    valueProposition: business.valueProposition,
    objective: business.objective,
    businessGoals: business.businessGoals,
    conversionGoal: business.conversionGoal,
    brandTone: business.brandTone,
    brandColors: business.brandColors,
    contentLanguage: business.contentLanguage,
    mainPlatforms: business.mainPlatforms,
    preferredCtas: business.preferredCtas,
    websiteUrl: business.websiteUrl,
    whatsapp: business.whatsapp,
    contactEmail: business.contactEmail,
  };
}

export function languageLabel(code: string): string {
  return CONTENT_LANGUAGES.find((l) => l.value === code)?.label ?? code;
}

// Renders the context as prompt lines, skipping anything not filled in so
// the model never sees "undefined" or empty headings.
export function formatBusinessContext(ctx: AiBusinessContext): string {
  const objectiveLabel = OBJECTIVES.find((o) => o.value === ctx.objective)?.label ?? ctx.objective;
  const platformLabels = ctx.mainPlatforms
    .map((p) => PLATFORMS.find((x) => x.value === p)?.label ?? p)
    .join(", ");
  const contact = [
    ctx.whatsapp && `WhatsApp ${ctx.whatsapp}`,
    ctx.websiteUrl && `web ${ctx.websiteUrl}`,
    ctx.contactEmail && `email ${ctx.contactEmail}`,
  ]
    .filter(Boolean)
    .join(" · ");

  const lines: [string, string | null | undefined][] = [
    ["Negocio", ctx.name],
    ["Industria", ctx.subIndustry ? `${ctx.industry} — ${ctx.subIndustry}` : ctx.industry],
    ["Qué vende", ctx.description],
    ["Productos/servicios", ctx.products.map((p) => p.name).join(", ")],
    ["Ticket promedio", ctx.avgTicket != null ? String(ctx.avgTicket) : null],
    ["Propuesta de valor", ctx.valueProposition],
    ["Público objetivo", ctx.targetAudience],
    ["Perfiles de cliente ideal", ctx.customerPersonas],
    ["Ubicación", ctx.location],
    ["Zonas de cobertura", ctx.serviceArea],
    ["Objetivo de marketing", objectiveLabel],
    ["Objetivos comerciales", ctx.businessGoals],
    ["Qué cuenta como conversión", ctx.conversionGoal],
    ["Tono de la marca", ctx.brandTone],
    ["Colores de la marca", ctx.brandColors],
    ["Redes principales", platformLabels || null],
    ["Llamadas a la acción preferidas", ctx.preferredCtas],
    ["Contacto", contact || null],
    ["Idioma del contenido", languageLabel(ctx.contentLanguage)],
  ];

  return lines
    .filter(([, value]) => typeof value === "string" && value.trim().length > 0)
    .map(([label, value]) => `${label}: ${value}`)
    .join("\n");
}

// Appended to prompts so audience-facing text follows the configured
// language even though our instructions to the model are in Spanish.
export function languageInstruction(ctx: AiBusinessContext): string {
  return `Escribe todo el texto dirigido al público (hooks, guiones, textos en pantalla, CTAs, ofertas) en ${languageLabel(
    ctx.contentLanguage
  )}. Usa el tono de la marca si está indicado. No inventes datos, precios, cifras ni testimonios que no estén en el contexto.`;
}
