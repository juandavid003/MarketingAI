import Link from "next/link";
import { CheckCircle2, Circle, ArrowRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireBusinessAccess } from "@/lib/dal";
import { OBJECTIVES } from "@/lib/constants";
import { profileCompleteness } from "@/lib/profileCompleteness";
import { formatInfo, platformLabel, isoDay, dayFromIso, addDays, daysAgo } from "@/lib/contentPlan";
import { Card } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/Button";
import { Notice, Detail } from "@/components/business/sections";
import { MODULE_GROUPS, moduleHref } from "@/components/business/modules";
import { Button } from "@/components/ui/Button";
import { deleteDemoBusiness } from "@/app/(app)/onboarding/actions";


// Resumen: the selected business at a glance — setup checklist, what's
// coming up, and a door to every module. Each module has its own page.
export default async function BusinessOverviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ campaign_error?: string; error?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const { business, role } = await requireBusinessAccess(id);
  const isOwner = role === "owner";

  const today = dayFromIso(isoDay(new Date()))!;
  const since30 = daysAgo(30);
  const [products, connection, counts, upcoming, leads30, clicks30] = await Promise.all([
    prisma.product.findMany({ where: { businessId: id } }),
    prisma.socialConnection.findUnique({ where: { businessId: id }, select: { id: true } }),
    Promise.all([
      prisma.campaign.count({ where: { businessId: id } }),
      prisma.contentPiece.count({ where: { businessId: id } }),
      prisma.contentPiece.count({ where: { businessId: id, strategy: { not: null } } }),
      prisma.contentPlanItem.count({ where: { businessId: id, date: { gte: today } } }),
      prisma.videoAsset.count({ where: { businessId: id } }),
      prisma.trackedLink.count({ where: { businessId: id, archived: false } }),
      prisma.competitor.count({ where: { businessId: id } }),
      prisma.publishJob.count({ where: { businessId: id, status: "scheduled" } }),
    ]),
    prisma.contentPlanItem.findMany({
      where: { businessId: id, date: { gte: today, lt: addDays(today, 7) } },
      orderBy: [{ date: "asc" }, { time: "asc" }],
      take: 6,
    }),
    prisma.lead.findMany({ where: { businessId: id, occurredAt: { gte: since30 } }, select: { status: true } }),
    prisma.linkClick.count({ where: { link: { businessId: id }, createdAt: { gte: since30 } } }),
  ]);
  const [campaigns, pieces, plans, scheduled, videos, links, competitors, queued] = counts;
  const won30 = leads30.filter((l) => l.status === "won").length;
  const profile = profileCompleteness(business);
  const objectiveLabel = OBJECTIVES.find((o) => o.value === business.objective)?.label ?? business.objective;

  const steps = [
    { done: profile.percent >= 80, label: `Completa el perfil del negocio (${profile.percent}%)`, href: `/business/${id}/profile` },
    // Keys and connections are the owner's (lib/access.ts): a manager sees
    // the step but not a link to a page they can't open.
    {
      done: business.aiProvider != null,
      label: isOwner ? "Configura tu IA (tu propia API key)" : "El dueño debe configurar la IA",
      href: isOwner ? `/business/${id}/settings` : null,
    },
    {
      done: connection != null,
      label: isOwner ? "Conecta Facebook e Instagram" : "El dueño debe conectar Facebook e Instagram",
      href: isOwner ? `/business/${id}/connections` : null,
    },
    { done: pieces > 0, label: "Escribe tu primer guion", href: `/business/${id}/copywriter` },
    { done: scheduled > 0, label: "Planifica tus próximas publicaciones", href: `/business/${id}/calendar` },
    { done: links > 0, label: "Crea un enlace rastreable para tu bio", href: `/business/${id}/links` },
  ];
  const pending = steps.filter((s) => !s.done);

  const moduleStat: Record<string, string> = {
    ideas: `${campaigns} campañas · ${competitors} competidores`,
    copywriter: `${pieces} guiones`,
    distribution: `${plans} planes de distribución`,
    calendar: `${scheduled} publicaciones próximas`,
    videos: `${videos} videos`,
    publishing: `${queued} programadas`,
    links: `${links} enlaces · ${clicks30} clics en 30 días`,
    leads: `${leads30.length} leads en 30 días`,
    results: `${won30} clientes en 30 días`,
  };

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <p className="text-sm font-medium text-muted">
        {business.industry} · {business.location}
      </p>
      <h1 className="mt-1 text-2xl font-semibold">{business.name}</h1>

      {business.isDemo && (
        <Card className="mt-4 flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
          <p className="min-w-0 flex-1 text-muted">
            <strong className="text-foreground">Negocio de demostración.</strong> Los datos son inventados para que
            recorras los módulos. Nada se publica desde aquí.
          </p>
          {isOwner && (
            <form action={deleteDemoBusiness.bind(null, id)}>
              <Button type="submit" size="sm" variant="secondary">
                Eliminar demo
              </Button>
            </form>
          )}
        </Card>
      )}

      <div className="mt-4 space-y-2">
        {sp.campaign_error && <Notice tone="danger">{sp.campaign_error}</Notice>}
        {sp.error && <Notice tone="danger">{sp.error}</Notice>}
      </div>

      {pending.length > 0 && (
        <Card className="mt-6 p-5">
          <p className="font-medium">Primeros pasos con {business.name}</p>
          <ul className="mt-3 space-y-2 text-sm">
            {steps.map((s) => (
              <li key={s.label}>
                {s.href ? (
                  <Link href={s.href} className={`flex items-center gap-2 ${s.done ? "text-muted line-through" : "hover:text-brand"}`}>
                    {s.done ? <CheckCircle2 className="size-4 text-green-600" /> : <Circle className="size-4 text-faint" />}
                    {s.label}
                  </Link>
                ) : (
                  <span className={`flex items-center gap-2 ${s.done ? "text-muted line-through" : "text-muted"}`}>
                    {s.done ? <CheckCircle2 className="size-4 text-green-600" /> : <Circle className="size-4 text-faint" />}
                    {s.label}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <p className="font-medium">Próximos 7 días</p>
            <Link href={`/business/${id}/calendar`} className="text-sm text-brand hover:underline">
              Calendario
            </Link>
          </div>
          {upcoming.length === 0 ? (
            <p className="mt-2 text-sm text-muted">No hay publicaciones programadas.</p>
          ) : (
            <ul className="mt-2 space-y-1.5 text-sm">
              {upcoming.map((item) => (
                <li key={item.id}>
                  <Link href={`/business/${id}/calendar/${item.id}`} className="flex items-center gap-2 hover:text-brand">
                    <span className="w-14 shrink-0 text-xs text-muted">
                      {item.date.toLocaleDateString("es", { weekday: "short", day: "numeric", timeZone: "UTC" })}
                    </span>
                    <span className={`shrink-0 rounded px-1.5 py-0.5 text-[11px] font-medium ${formatInfo(item.format).color}`}>
                      {formatInfo(item.format).label}
                    </span>
                    <span className="truncate">{item.title}</span>
                    <span className="ml-auto hidden shrink-0 text-xs text-faint sm:inline">{platformLabel(item.platform)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <p className="font-medium">Últimos 30 días</p>
            <Link href={`/business/${id}/results`} className="text-sm text-brand hover:underline">
              Resultados
            </Link>
          </div>
          <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div>
              <dt className="text-xs text-muted">Clics</dt>
              <dd className="text-2xl font-semibold tabular-nums">{clicks30}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Leads</dt>
              <dd className="text-2xl font-semibold tabular-nums">{leads30.length}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Clientes</dt>
              <dd className="text-2xl font-semibold tabular-nums">{won30}</dd>
            </div>
          </dl>
        </Card>
      </div>

      {MODULE_GROUPS.slice(0, 2).map((group) => (
        <section key={group.label} className="mt-10">
          <h2 className="text-sm font-medium uppercase tracking-wide text-faint">{group.label}</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {group.modules.map((mod) => (
              <Link key={mod.key} href={moduleHref(id, mod.key)} className="group">
                <Card className="h-full p-4 transition-colors group-hover:border-brand">
                  <p className="flex items-center gap-2 font-medium">
                    <mod.icon className="size-4 text-brand" /> {mod.label}
                    <ArrowRight className="ml-auto size-4 text-faint group-hover:text-brand" />
                  </p>
                  <p className="mt-1.5 text-sm text-muted">{mod.description}</p>
                  {moduleStat[mod.key] && <p className="mt-2 text-xs text-faint">{moduleStat[mod.key]}</p>}
                </Card>
              </Link>
            ))}
          </div>
        </section>
      ))}

      <section className="mt-12 space-y-5 border-t border-border pt-8">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-medium text-muted">Perfil del negocio · completo al {profile.percent}%</h2>
          <LinkButton href={`/business/${id}/profile`} variant="secondary" size="sm">
            Editar perfil
          </LinkButton>
        </div>
        <Detail label="¿Qué vende?" value={business.description} />
        <Detail label="Audiencia objetivo" value={business.targetAudience} />
        <Detail label="Objetivo principal" value={objectiveLabel} />
        {products.length > 0 && (
          <div>
            <p className="text-sm font-medium text-muted">Productos / servicios</p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {products.map((product) => (
                <li key={product.id} className="rounded-full border border-border px-3 py-1 text-sm">
                  {product.name}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </main>
  );
}
