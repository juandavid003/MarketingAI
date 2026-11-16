export const INDUSTRIES = [
  "Odontología / Salud dental",
  "Salud / Clínica médica",
  "Estética / Belleza",
  "Restaurante / Gastronomía",
  "Gimnasio / Fitness",
  "Inmobiliaria",
  "Retail / Tienda física",
  "E-commerce",
  "Servicios profesionales",
  "Otro",
] as const;

export const OBJECTIVES = [
  { value: "more_sales", label: "Vender más" },
  { value: "more_leads", label: "Conseguir más leads / consultas" },
  { value: "brand_awareness", label: "Aumentar reconocimiento de marca" },
  { value: "customer_retention", label: "Fidelizar clientes actuales" },
] as const;

export const PLATFORMS = [
  { value: "instagram", label: "Instagram" },
  { value: "facebook", label: "Facebook" },
  { value: "tiktok", label: "TikTok" },
  { value: "youtube", label: "YouTube Shorts" },
] as const;

export const CONTENT_LANGUAGES = [
  { value: "es", label: "español" },
  { value: "en", label: "inglés" },
  { value: "pt", label: "portugués" },
] as const;
