import type { Business } from "@/generated/prisma/client";

// Optional profile fields that measurably improve AI output. Used to nudge
// the owner to fill them in — never required.
const OPTIONAL_FIELDS: { key: keyof Business; label: string }[] = [
  { key: "valueProposition", label: "Propuesta de valor" },
  { key: "customerPersonas", label: "Perfiles de cliente ideal" },
  { key: "brandTone", label: "Tono de la marca" },
  { key: "preferredCtas", label: "Llamadas a la acción" },
  { key: "conversionGoal", label: "Qué cuenta como conversión" },
  { key: "serviceArea", label: "Zonas de cobertura" },
  { key: "brandColors", label: "Colores de la marca" },
  { key: "mainPlatforms", label: "Redes principales" },
];

export function profileCompleteness(business: Business & { websiteUrl: string | null; whatsapp: string | null }) {
  const missing = OPTIONAL_FIELDS.filter(({ key }) => {
    const value = business[key];
    if (Array.isArray(value)) return value.length === 0;
    return value == null || (typeof value === "string" && value.trim() === "");
  }).map((f) => f.label);

  const hasContact = Boolean(business.websiteUrl || business.whatsapp);
  if (!hasContact) missing.push("Contacto (WhatsApp o sitio web)");

  const total = OPTIONAL_FIELDS.length + 1;
  return { missing, percent: Math.round(((total - missing.length) / total) * 100) };
}
