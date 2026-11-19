import "server-only";
import { prisma } from "@/lib/prisma";
import { newSlug } from "@/lib/links";

// "Negocio de demostración": a fictional bakery with competitors, a tracked
// link, a promo code and some leads, so a new pilot user can walk through
// every module before loading their own data. Everything is invented and the
// business is flagged isDemo (labeled "(demo)" in the sidebar); it never has
// a social connection, so nothing can be published from it. The user can
// delete it like any other business's data, or simply ignore it.

const DAY = 86_400_000;

export async function createDemoBusiness(userId: string): Promise<string> {
  const existing = await prisma.business.findFirst({ where: { userId, isDemo: true }, select: { id: true } });
  if (existing) return existing.id;

  const now = Date.now();
  const ago = (days: number) => new Date(now - days * DAY);

  const business = await prisma.business.create({
    data: {
      userId,
      isDemo: true,
      name: "Panadería Dulce Hogar (demo)",
      industry: "Panadería y cafetería",
      description:
        "Panadería de barrio con pan de masa madre, pasteles por encargo y café de especialidad. Negocio ficticio para explorar la app.",
      targetAudience: "Familias y oficinistas del sector, 25–45 años, que compran pan a diario y pasteles para ocasiones especiales.",
      location: "Quito, Ecuador",
      avgTicket: 8,
      objective: "Vender más pasteles por encargo",
      valueProposition: "Pan horneado cada mañana con masa madre y pasteles personalizados con 48 h de anticipación.",
      brandTone: "Cercano, cálido y casero",
      brandColors: "#B45309, #1F2937",
      mainPlatforms: ["instagram", "facebook", "tiktok"],
      preferredCtas: "Escríbenos por WhatsApp para tu pedido",
      whatsapp: "+593 99 000 0000",
      conversionGoal: "Pedido de pastel confirmado por WhatsApp",
      products: {
        create: [{ name: "Pan de masa madre" }, { name: "Pasteles por encargo" }, { name: "Café de especialidad" }],
      },
      competitors: {
        create: [
          {
            name: "Pastelería del Parque (ficticia)",
            posts: {
              create: [
                {
                  source: "manual",
                  caption: "¿Sabías que nuestro pastel de chocolate lleva 3 días de preparación? Te mostramos el proceso 👇",
                  mediaType: "REELS",
                  likeCount: 412,
                  commentsCount: 38,
                  postedAt: ago(6),
                  notes: "Hook de curiosidad + proceso detrás de cámaras",
                },
                {
                  source: "manual",
                  caption: "Promo de fin de mes: 2x1 en cupcakes los jueves. Solo en local.",
                  mediaType: "IMAGE",
                  likeCount: 96,
                  commentsCount: 7,
                  postedAt: ago(12),
                  notes: "Oferta directa, poco engagement",
                },
              ],
            },
          },
          {
            name: "Café Norte (ficticio)",
            posts: {
              create: [
                {
                  source: "manual",
                  caption: "3 errores que cometes al preparar café en casa (el #2 lo hace todo el mundo)",
                  mediaType: "REELS",
                  likeCount: 655,
                  commentsCount: 74,
                  postedAt: ago(4),
                  notes: "Formato lista educativa, muchos comentarios",
                },
              ],
            },
          },
        ],
      },
      promoCodes: { create: [{ code: "DULCE10", description: "10% en pasteles por encargo (demo)" }] },
    },
  });

  const link = await prisma.trackedLink.create({
    data: {
      businessId: business.id,
      slug: newSlug(),
      label: "Bio de Instagram → WhatsApp (demo)",
      destinationUrl: "https://example.com/",
      utmSource: "instagram",
      utmMedium: "social",
      utmCampaign: "pasteles-encargo",
      clicks: {
        create: Array.from({ length: 23 }, (_, i) => ({
          device: i % 4 === 0 ? "desktop" : "mobile",
          referrerHost: i % 3 === 0 ? null : "instagram.com",
          createdAt: ago(i % 14),
        })),
      },
    },
  });
  const promo = await prisma.promoCode.findFirstOrThrow({ where: { businessId: business.id } });

  await prisma.lead.createMany({
    data: [
      { name: "Cliente A (demo)", source: "tracked_link", trackedLinkId: link.id, status: "won", value: 35, attribution: "high", occurredAt: ago(2) },
      { name: "Cliente B (demo)", source: "promo_code", promoCodeId: promo.id, status: "won", value: 28, attribution: "high", occurredAt: ago(5) },
      { name: "Cliente C (demo)", source: "whatsapp", status: "contacted", attribution: "low", occurredAt: ago(1) },
      { name: "Cliente D (demo)", source: "instagram", status: "qualified", value: 40, attribution: "low", occurredAt: ago(8) },
      { name: "Cliente E (demo)", source: "walk_in", status: "lost", attribution: "low", occurredAt: ago(10) },
    ].map((lead) => ({ ...lead, businessId: business.id })),
  });

  return business.id;
}
