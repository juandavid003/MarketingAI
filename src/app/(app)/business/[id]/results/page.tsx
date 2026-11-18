import Link from "next/link";
import { BarChart3, Briefcase, Smartphone, CalendarCheck } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireBusinessAccess } from "@/lib/dal";
import { getPageActivity } from "@/lib/pageActivity";
import { ATTRIBUTION_LABEL, leadSourceLabel, type Attribution } from "@/lib/leads";
import { leadTotals, groupResults, type Totals } from "@/lib/results";
import { daysAgo } from "@/lib/contentPlan";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/ui/PageHeader";
import { Section, PageActivitySection } from "@/components/business/sections";

const PERIODS = [7, 30, 90] as const;

export default async function ResultsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ days?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const { business } = await requireBusinessAccess(id);
  const days = PERIODS.find((p) => String(p) === sp.days) ?? 30;
  const since = daysAgo(days);

  const [leads, links, clickGroups, campaigns, pieces, variantResults, planItems, connection] = await Promise.all([
    prisma.lead.findMany({
      where: { businessId: id, occurredAt: { gte: since } },
      select: { status: true, value: true, attribution: true, source: true, trackedLinkId: true, campaignId: true, contentPieceId: true },
    }),
    prisma.trackedLink.findMany({
      where: { businessId: id },
      select: { id: true, label: true, campaignId: true, contentPieceId: true },
    }),
    prisma.linkClick.groupBy({
      by: ["linkId"],
      where: { link: { businessId: id }, createdAt: { gte: since } },
      _count: { _all: true },
    }),
    prisma.campaign.findMany({ where: { businessId: id }, select: { id: true, title: true } }),
    prisma.contentPiece.findMany({ where: { businessId: id }, select: { id: true, hook: true } }),
    prisma.variantResult.findMany({
      where: { variant: { contentPiece: { businessId: id } }, createdAt: { gte: since } },
      include: { variant: { select: { code: true, contentPiece: { select: { id: true, hook: true } } } } },
    }),
    prisma.contentPlanItem.findMany({
      where: { businessId: id, date: { gte: since, lte: new Date() } },
      select: { status: true, format: true },
    }),
    prisma.socialConnection.findUnique({ where: { businessId: id }, include: { pages: true } }),
  ]);

  const clicksBy = new Map(clickGroups.map((g) => [g.linkId, g._count._all]));
  const linksWithClicks = links.map((l) => ({ ...l, clicks: clicksBy.get(l.id) ?? 0 }));
  const totalClicks = linksWithClicks.reduce((s, l) => s + l.clicks, 0);
  const totals = leadTotals(leads, totalClicks);
  const byCampaign = groupResults(leads, linksWithClicks, "campaignId");
  const byPiece = groupResults(leads, linksWithClicks, "contentPieceId");
  const campaignName = new Map(campaigns.map((c) => [c.id, c.title]));
  const pieceName = new Map(pieces.map((p) => [p.id, `“${p.hook}”`]));

  const bySource = new Map<string, { leads: number; won: number }>();
  for (const l of leads) {
    const r = bySource.get(l.source) ?? { leads: 0, won: 0 };
    r.leads++;
    if (l.status === "won") r.won++;
    bySource.set(l.source, r);
  }

  const platformViews = variantResults.reduce((s, r) => s + (r.views ?? 0), 0);
  const platformInteractions = variantResults.reduce(
    (s, r) => s + (r.likes ?? 0) + (r.comments ?? 0) + (r.shares ?? 0) + (r.saves ?? 0),
    0
  );
  const published = planItems.filter((p) => p.status === "published").length;
  const activity = connection ? await getPageActivity(connection.pages) : [];
  const fmtMoney = (n: number) => n.toLocaleString("es", { maximumFractionDigits: 2 });

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <PageHeader
        eyebrow={business.name}
        title="Resultados"
        description="Arriba, lo que le importa al negocio: visitas a tus enlaces, leads y ventas. Abajo, por separado, lo que reportan las redes. Un like no es un cliente."
        actions={
          <div className="flex gap-1 text-xs">
            {PERIODS.map((p) => (
              <a
                key={p}
                href={`?days=${p}`}
                className={`rounded-full px-2.5 py-1 font-medium ${p === days ? "bg-foreground text-background" : "bg-black/5 dark:bg-white/10"}`}
              >
                {p} días
              </a>
            ))}
          </div>
        }
      />

      <Section icon={Briefcase} title="Resultados de negocio">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Clics en tus enlaces" value={totals.clicks} />
          <Stat label="Leads" value={totals.leads} />
          <Stat label="Clientes (ganados)" value={totals.won} hint={totals.winRate != null ? `${totals.winRate}% de los leads` : undefined} />
          <Stat label="Ventas registradas" value={fmtMoney(totals.value)} />
        </div>

        {totals.leads > 0 && (
          <Card className="p-4 text-sm">
            <p className="font-medium">¿Qué tan seguros estamos del origen?</p>
            <div className="mt-2 flex h-3 overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
              {(["high", "medium", "low"] as Attribution[]).map((a) =>
                totals.byAttribution[a] > 0 ? (
                  <div
                    key={a}
                    className={a === "high" ? "bg-green-500" : a === "medium" ? "bg-amber-400" : "bg-zinc-400"}
                    style={{ width: `${(totals.byAttribution[a] / totals.leads) * 100}%` }}
                  />
                ) : null
              )}
            </div>
            <ul className="mt-2 grid gap-1 text-muted sm:grid-cols-3">
              {(["high", "medium", "low"] as Attribution[]).map((a) => (
                <li key={a}>
                  <span className="font-medium text-foreground">
                    {ATTRIBUTION_LABEL[a].label}: {totals.byAttribution[a]}
                  </span>{" "}
                  — {ATTRIBUTION_LABEL[a].help}
                </li>
              ))}
            </ul>
          </Card>
        )}

        {totals.leads === 0 && totals.clicks === 0 ? (
          <Card className="p-4 text-sm text-muted">
            Todavía no hay resultados de negocio en este periodo. Crea{" "}
            <Link href={`/business/${id}/links`} className="text-brand hover:underline">
              enlaces y códigos
            </Link>{" "}
            para tus publicaciones y registra cada{" "}
            <Link href={`/business/${id}/leads`} className="text-brand hover:underline">
              lead
            </Link>{" "}
            que te contacte.
          </Card>
        ) : (
          <>
            <BreakdownTable title="Por campaña" rows={byCampaign} name={(k) => (k ? campaignName.get(k) ?? "Campaña eliminada" : "Sin campaña")} money={fmtMoney} />
            <BreakdownTable title="Por contenido" rows={byPiece} name={(k) => (k ? pieceName.get(k) ?? "Guion eliminado" : "Sin contenido identificado")} money={fmtMoney} />
            {bySource.size > 0 && (
              <Card className="p-4 text-sm">
                <p className="font-medium">Leads por canal</p>
                <ul className="mt-2 divide-y divide-border">
                  {[...bySource.entries()]
                    .sort((a, b) => b[1].leads - a[1].leads)
                    .map(([source, r]) => (
                      <li key={source} className="flex justify-between py-1.5">
                        <span>{leadSourceLabel(source)}</span>
                        <span className="text-muted">
                          {r.leads} leads · {r.won} clientes
                        </span>
                      </li>
                    ))}
                </ul>
              </Card>
            )}
            {linksWithClicks.some((l) => l.clicks > 0) && (
              <Card className="p-4 text-sm">
                <p className="font-medium">Clics por enlace</p>
                <ul className="mt-2 divide-y divide-border">
                  {linksWithClicks
                    .filter((l) => l.clicks > 0)
                    .sort((a, b) => b.clicks - a.clicks)
                    .map((l) => {
                      const leadsFromLink = leads.filter((x) => x.trackedLinkId === l.id).length;
                      return (
                        <li key={l.id} className="flex justify-between gap-3 py-1.5">
                          <span className="truncate">{l.label}</span>
                          <span className="shrink-0 text-muted">
                            {l.clicks} clics · {leadsFromLink} leads
                          </span>
                        </li>
                      );
                    })}
                </ul>
              </Card>
            )}
          </>
        )}
      </Section>

      <Section icon={CalendarCheck} title="Ejecución del plan" className="mt-12">
        <p className="text-sm text-muted">
          {planItems.length === 0
            ? "No había publicaciones planificadas en este periodo."
            : `Publicaste ${published} de ${planItems.length} publicaciones planificadas en los últimos ${days} días.`}{" "}
          <Link href={`/business/${id}/calendar`} className="text-brand hover:underline">
            Abrir el Manager de contenido →
          </Link>
        </p>
      </Section>

      <Section
        icon={Smartphone}
        title="Métricas de las redes"
        className="mt-12"
        badge={<Badge>No son clientes</Badge>}
      >
        <p className="text-sm text-muted">
          Lo que reportan las plataformas: sirve para saber qué contenido se ve y engancha, no cuánto vende.
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Stat label="Vistas registradas de creativos" value={platformViews} />
          <Stat label="Interacciones registradas" value={platformInteractions} />
          <Stat label="Resultados cargados" value={variantResults.length} />
        </div>
        {variantResults.length > 0 && (
          <p className="text-xs text-faint">
            Vienen de los resultados que registraste en el Distribuidor para cada creativo.
          </p>
        )}
        {activity.length > 0 ? (
          <>
            <p className="flex items-center gap-2 pt-2 text-sm font-medium">
              <BarChart3 className="size-4 text-brand" /> Actividad reciente de tus páginas <Badge tone="success">En vivo</Badge>
            </p>
            <PageActivitySection activity={activity} />
          </>
        ) : (
          <p className="text-sm text-muted">
            {connection ? "Tus páginas conectadas no tienen actividad reciente." : "Conecta Facebook e Instagram en "}
            {!connection && (
              <Link href={`/business/${id}/connections`} className="text-brand hover:underline">
                Conexiones
              </Link>
            )}
            {!connection && " para ver la actividad de tus páginas."}
          </p>
        )}
      </Section>
    </main>
  );
}

function Stat({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
  return (
    <Card className="p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="text-xs text-faint">{hint}</p>}
    </Card>
  );
}

function BreakdownTable({
  title,
  rows,
  name,
  money,
}: {
  title: string;
  rows: Map<string | null, Totals>;
  name: (key: string | null) => string;
  money: (n: number) => string;
}) {
  const sorted = [...rows.entries()].sort((a, b) => b[1].won - a[1].won || b[1].leads - a[1].leads || b[1].clicks - a[1].clicks);
  if (sorted.length === 0) return null;
  return (
    <Card className="overflow-x-auto p-4 text-sm">
      <p className="font-medium">{title}</p>
      <table className="mt-2 w-full">
        <thead>
          <tr className="text-left text-xs text-muted">
            <th className="py-1 pr-2 font-medium"></th>
            <th className="px-2 py-1 text-right font-medium">Clics</th>
            <th className="px-2 py-1 text-right font-medium">Leads</th>
            <th className="px-2 py-1 text-right font-medium">Clientes</th>
            <th className="py-1 pl-2 text-right font-medium">Ventas</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(([key, r]) => (
            <tr key={key ?? "none"} className="border-t border-border">
              <td className={`max-w-56 truncate py-1.5 pr-2 ${key ? "" : "text-muted"}`}>{name(key)}</td>
              <td className="px-2 text-right tabular-nums">{r.clicks}</td>
              <td className="px-2 text-right tabular-nums">{r.leads}</td>
              <td className="px-2 text-right tabular-nums">{r.won}</td>
              <td className="pl-2 text-right tabular-nums">{money(r.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
