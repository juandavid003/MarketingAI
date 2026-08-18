import type { Business, Product } from "@/generated/prisma/client";

export type InsightKind = "opportunity" | "problem" | "competitor" | "trend";

export type Insight = {
  kind: InsightKind;
  emoji: string;
  title: string;
  description: string;
  recommendation?: string;
  actionLabel?: string;
  potential?: "Alto" | "Medio" | "Bajo";
};

type BusinessWithProducts = Business & { products: Product[] };

// Deterministic pseudo-random numbers seeded by business id, so the mock
// insights stay stable across page reloads instead of reshuffling every visit.
function createSeededRandom(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  }
  return () => {
    h = (Math.imul(48271, h) + 1) % 2147483647;
    return (h < 0 ? h + 2147483647 : h) / 2147483647;
  };
}

function pick<T>(items: T[], random: () => number): T {
  return items[Math.floor(random() * items.length)];
}

const COMPETITOR_TOPICS: Record<string, string[]> = {
  "Odontología / Salud dental": [
    "implantes sin dolor",
    "blanqueamiento en una sesión",
    "ortodoncia invisible",
  ],
  "Salud / Clínica médica": [
    "consultas online",
    "chequeos preventivos",
    "promociones de temporada",
  ],
  "Estética / Belleza": [
    "tratamientos faciales",
    "antes y después",
    "promos de fin de mes",
  ],
  "Restaurante / Gastronomía": [
    "menú del día",
    "delivery gratis",
    "eventos en vivo",
  ],
  "Gimnasio / Fitness": [
    "retos de 30 días",
    "clases grupales",
    "planes familiares",
  ],
  "Inmobiliaria": [
    "recorridos virtuales",
    "financiamiento directo",
    "propiedades en preventa",
  ],
  "Retail / Tienda física": [
    "liquidaciones",
    "lanzamientos exclusivos",
    "programas de fidelidad",
  ],
  "E-commerce": [
    "envío gratis",
    "descuentos flash",
    "reseñas de clientes",
  ],
  "Servicios profesionales": [
    "consultas gratuitas",
    "casos de éxito",
    "contenido educativo",
  ],
};

const DEFAULT_TOPICS = ["promociones", "testimonios de clientes", "contenido educativo"];

export function generateInsights(business: BusinessWithProducts): Insight[] {
  const random = createSeededRandom(business.id);
  const products = business.products.length > 0 ? business.products : [{ name: "tu producto principal" } as Product];

  const heroProduct = pick(products, random);
  const secondaryProduct =
    products.length > 1 ? pick(products.filter((p) => p.name !== heroProduct.name), random) : heroProduct;

  const topics = COMPETITOR_TOPICS[business.industry] ?? DEFAULT_TOPICS;
  const topic = pick(topics, random);

  const multiplier = (2 + random() * 2.5).toFixed(1);
  const spendIncreasePct = Math.round(20 + random() * 25);
  const leadDropPct = Math.round(20 + random() * 30);
  const competitorCount = Math.round(2 + random() * 3);
  const competitorViews = Math.round(8 + random() * 20);

  const insights: Insight[] = [
    {
      kind: "opportunity",
      emoji: "🔥",
      title: "Oportunidad",
      description: `Tu contenido sobre "${heroProduct.name}" tiene el potencial de rendir ${multiplier}× mejor que tu promedio, según patrones típicos de ${business.industry.toLowerCase()}.`,
      recommendation: `Crear una campaña de 7 días enfocada en ${heroProduct.name}.`,
      actionLabel: "Crear campaña",
      potential: "Alto",
    },
    {
      kind: "problem",
      emoji: "⚠️",
      title: "Problema",
      description: `Las campañas de "${secondaryProduct.name}" suelen empezar a gastar ${spendIncreasePct}% más y generar ${leadDropPct}% menos leads después de 2 semanas activas (fatiga del anuncio).`,
      recommendation: "Preparar 3 variantes nuevas antes de que esto ocurra.",
      actionLabel: "Regenerar anuncios",
      potential: "Medio",
    },
    {
      kind: "competitor",
      emoji: "👀",
      title: "Competencia",
      description: `${competitorCount} negocios de "${business.industry}" en ${business.location} están publicando contenido sobre "${topic}", con piezas llegando a ${competitorViews}K reproducciones.`,
      actionLabel: "Analizar",
    },
    {
      kind: "trend",
      emoji: "💡",
      title: "Oportunidad detectada",
      description: `Las audiencias de ${business.industry.toLowerCase()} suelen interactuar más con contenido que responde "¿Cuánto cuesta realmente ${heroProduct.name.toLowerCase()}?".`,
      recommendation: `Crear campaña: "¿Cuánto cuesta realmente ${heroProduct.name.toLowerCase()}?"`,
      actionLabel: "Crear campaña",
    },
  ];

  return insights;
}
