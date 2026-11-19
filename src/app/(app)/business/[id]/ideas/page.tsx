import Link from "next/link";
import { Brain, Target, Eye, Megaphone, CalendarDays } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireBusinessAccess } from "@/lib/dal";
import { getPageActivity } from "@/lib/pageActivity";
import { generateRealInsights } from "@/lib/realInsights";
import { detectCountry, COUNTRY_NAME } from "@/lib/adLibrary";
import { upcomingSeasonal, seasonalCampaignGoal } from "@/lib/seasonal";
import { createCampaignFromObjective } from "../actions";
import { Badge } from "@/components/ui/Badge";
import { Button, LinkButton } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Notice, Section, GoalCampaignForm, InsightCard, CompetitorSummary } from "@/components/business/sections";

// Generador de ideas: where content starts — opportunities in the
// business's own data, what works for competitors, and campaigns from a goal.
export default async function IdeasPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ campaign_error?: string }>;
}) {
  const { id } = await params;
  const { campaign_error: campaignError } = await searchParams;
  const { business } = await requireBusinessAccess(id);

  const [connection, products, competitors, campaigns, ideaBatches] = await Promise.all([
    prisma.socialConnection.findUnique({ where: { businessId: id }, include: { pages: true } }),
    prisma.product.findMany({ where: { businessId: id } }),
    prisma.competitor.findMany({
      where: { businessId: id },
      orderBy: { createdAt: "asc" },
      include: { _count: { select: { posts: true } } },
    }),
    prisma.campaign.findMany({ where: { businessId: id }, orderBy: { createdAt: "desc" } }),
    prisma.competitorIdeaBatch.count({ where: { businessId: id } }),
  ]);

  const activity = connection ? await getPageActivity(connection.pages) : [];
  const insights = generateRealInsights(activity, products);
  const aiConfigured = business.aiProvider != null;
  const country = detectCountry(business.location);
  const seasonal = upcomingSeasonal(country.code, business.location);

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <PageHeader
        eyebrow={business.name}
        title="Generador de ideas"
        description="De dónde salen tus próximos contenidos: lo que muestran tus datos, lo que le funciona a tu competencia y lo que quieres lograr."
      />

      {campaignError && <Notice tone="danger">No se pudo crear la campaña: {campaignError}</Notice>}

      <Section icon={Target} title="¿Qué quieres lograr?" className="mt-6">
        <p className="text-sm text-muted">
          Dile a la IA tu objetivo y te propone una campaña completa: concepto, oferta, piezas y CTA.
        </p>
        <GoalCampaignForm businessId={id} aiConfigured={aiConfigured} />
      </Section>

      <Section icon={CalendarDays} title="Fechas que vienen" className="mt-10">
        <p className="text-sm text-muted">
          Fechas comerciales y feriados de {COUNTRY_NAME[country.code] ?? country.code} en los próximos
          meses, con cuándo empezar a preparar el contenido.
          {!country.matched &&
            " No reconocimos el país en tu ubicación; usamos Ecuador. Corrígelo en Perfil si no es así."}
        </p>
        {seasonal.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No hay fechas importantes en las próximas semanas.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {seasonal.map((e) => (
              <li key={e.key + e.date.toISOString()} className="flex flex-wrap items-start justify-between gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {e.name}{" "}
                    <span className="text-sm font-normal text-muted">
                      · {e.date.toLocaleDateString("es", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" })}
                      {" · "}
                      {e.daysUntil === 0 ? "hoy" : `en ${e.daysUntil} días`}
                    </span>
                  </p>
                  <p className="mt-0.5 text-sm text-muted">{e.angle}</p>
                  <p className="mt-0.5 text-xs">
                    {e.status === "prepare_now" ? (
                      <Badge tone="warning">Prepáralo ya</Badge>
                    ) : (
                      <span className="text-faint">
                        Empieza a preparar desde el{" "}
                        {e.prepareFrom.toLocaleDateString("es", { day: "numeric", month: "long", timeZone: "UTC" })}
                      </span>
                    )}
                  </p>
                </div>
                {aiConfigured && (
                  <form action={createCampaignFromObjective.bind(null, id)}>
                    <input type="hidden" name="goal" value={seasonalCampaignGoal(e)} />
                    <Button type="submit" size="sm" variant="secondary">
                      Crear campaña
                    </Button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section
        icon={Eye}
        title="Lo que le funciona a tu competencia"
        className="mt-10"
        actions={
          <LinkButton href={`/business/${id}/competitors`} variant="secondary" size="sm">
            Abrir competencia
          </LinkButton>
        }
      >
        <CompetitorSummary businessId={id} competitors={competitors} />
        {competitors.length > 0 && (
          <p className="text-sm text-muted">
            {ideaBatches > 0
              ? `${ideaBatches} análisis de ideas generados. `
              : "Aún no generas ideas a partir de sus publicaciones. "}
            <Link href={`/business/${id}/competitors`} className="text-brand hover:underline">
              Generar ideas de video con evidencia →
            </Link>
          </p>
        )}
      </Section>

      <Section
        icon={Brain}
        title="Oportunidades en tus datos"
        className="mt-10"
        badge={insights.length > 0 ? <Badge tone="success">Datos en vivo</Badge> : undefined}
      >
        {insights.length > 0 ? (
          <div className="space-y-4">
            {insights.map((insight) => (
              <InsightCard
                key={insight.title + insight.description}
                insight={insight}
                businessId={id}
                aiConfigured={aiConfigured}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={Brain}
            title={
              connection
                ? "Todavía no hay suficientes datos para detectar oportunidades"
                : "Conecta Facebook/Instagram para detectar oportunidades reales"
            }
            description="Solo mostramos oportunidades basadas en tus datos reales, nunca cifras de ejemplo."
            action={
              !connection ? (
                <LinkButton href={`/business/${id}/connections`} size="sm">
                  Ir a Conexiones
                </LinkButton>
              ) : undefined
            }
          />
        )}
      </Section>

      <Section icon={Megaphone} title="Campañas" className="mt-10">
        {campaigns.length === 0 ? (
          <EmptyState icon={Megaphone} title="Todavía no tienes campañas" description="Crea una desde tu objetivo o desde una oportunidad." />
        ) : (
          <ul className="divide-y divide-border">
            {campaigns.map((campaign) => (
              <li key={campaign.id}>
                <Link
                  href={`/business/${id}/campaigns/${campaign.id}`}
                  className="flex items-center justify-between gap-3 py-3 hover:text-brand"
                >
                  <span className="font-medium">{campaign.title}</span>
                  <span className="shrink-0 text-sm text-muted">{campaign.createdAt.toLocaleDateString("es")}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </main>
  );
}
