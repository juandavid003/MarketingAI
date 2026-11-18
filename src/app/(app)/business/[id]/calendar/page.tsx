import Link from "next/link";
import { ChevronLeft, ChevronRight, Sparkles, Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireBusinessAccess } from "@/lib/dal";
import {
  FORMATS,
  PLAN_PLATFORMS,
  formatInfo,
  platformLabel,
  statusLabel,
  monthGrid,
  parseMonth,
  monthKey,
  isoDay,
  addDays,
  dayFromIso,
} from "@/lib/contentPlan";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Select, Textarea } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { Notice } from "@/components/business/sections";
import { addPlanItem, generatePlan } from "../calendar-actions";
import { PlanItemForm } from "./PlanItemForm";

const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

// Manager de contenido: one calendar for every format and platform of this
// business — manual items, the AI planner, and distribution plans.
export default async function CalendarPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ month?: string; format?: string; error?: string; planned?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const { business } = await requireBusinessAccess(id);

  const today = new Date();
  const todayIso = isoDay(today);
  const { year, month0 } = parseMonth(sp.month, today);
  const weeks = monthGrid(year, month0);
  const gridStart = dayFromIso(weeks[0][0])!;
  const gridEnd = addDays(dayFromIso(weeks[weeks.length - 1][6])!, 1);
  const formatFilter = FORMATS.some((f) => f.value === sp.format) ? sp.format : undefined;

  const [items, upcoming, campaigns, pieces, links] = await Promise.all([
    prisma.contentPlanItem.findMany({
      where: { businessId: id, date: { gte: gridStart, lt: gridEnd }, ...(formatFilter ? { format: formatFilter } : {}) },
      orderBy: [{ date: "asc" }, { time: "asc" }],
    }),
    prisma.contentPlanItem.findMany({
      where: { businessId: id, date: { gte: dayFromIso(todayIso)!, lt: addDays(dayFromIso(todayIso)!, 14) } },
      orderBy: [{ date: "asc" }, { time: "asc" }],
    }),
    prisma.campaign.findMany({ where: { businessId: id }, select: { id: true, title: true }, orderBy: { createdAt: "desc" } }),
    prisma.contentPiece.findMany({ where: { businessId: id }, select: { id: true, hook: true }, orderBy: { createdAt: "desc" } }),
    prisma.trackedLink.findMany({
      where: { businessId: id, archived: false },
      select: { id: true, label: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const byDay = new Map<string, typeof items>();
  for (const item of items) {
    const key = isoDay(item.date);
    byDay.set(key, [...(byDay.get(key) ?? []), item]);
  }
  const countByFormat = new Map<string, number>();
  for (const item of items) countByFormat.set(item.format, (countByFormat.get(item.format) ?? 0) + 1);

  const monthLabel = new Date(Date.UTC(year, month0, 1, 12)).toLocaleDateString("es", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  const base = `/business/${id}/calendar`;
  const qs = (params: Record<string, string | undefined>) => {
    const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][]).toString();
    return q ? `${base}?${q}` : base;
  };
  const current = monthKey(year, month0);
  const defaultPlatforms = business.mainPlatforms.length > 0 ? business.mainPlatforms : ["instagram", "facebook"];

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <PageHeader
        eyebrow={business.name}
        title="Manager de contenido"
        description="Todas tus publicaciones en un solo calendario: reels, carruseles, historias y posts de todas tus campañas y redes."
      />

      <div className="space-y-2">
        {sp.error && <Notice tone="danger">{sp.error}</Notice>}
        {sp.planned === "1" && <Notice tone="success">Agregamos el plan al calendario. Revisa y ajusta lo que quieras.</Notice>}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <details className="group rounded-lg border border-border bg-surface p-4" open={items.length === 0}>
          <summary className="flex cursor-pointer items-center gap-2 font-medium">
            <Sparkles className="size-4 text-brand" /> Planificar con IA
          </summary>
          {business.aiProvider ? (
            <form action={generatePlan.bind(null, id)} className="mt-3 space-y-3 text-sm">
              <p className="text-muted">
                Combina formatos y usa tus campañas y guiones. Se agrega al calendario sin borrar lo que ya tienes.
              </p>
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="block space-y-1">
                  <span className="font-medium">Desde</span>
                  <Input name="start" type="date" required defaultValue={todayIso} />
                </label>
                <label className="block space-y-1">
                  <span className="font-medium">Semanas</span>
                  <Select name="weeks" defaultValue="2">
                    {[1, 2, 3, 4].map((w) => (
                      <option key={w} value={w}>
                        {w}
                      </option>
                    ))}
                  </Select>
                </label>
                <label className="block space-y-1">
                  <span className="font-medium">Publicaciones/semana</span>
                  <Input name="postsPerWeek" type="number" min={1} max={14} defaultValue={4} />
                </label>
              </div>
              <fieldset className="flex flex-wrap gap-3">
                <legend className="mb-1 font-medium">Redes</legend>
                {PLAN_PLATFORMS.filter((p) => p.value !== "other").map((p) => (
                  <label key={p.value} className="flex items-center gap-1.5">
                    <input type="checkbox" name="platforms" value={p.value} defaultChecked={defaultPlatforms.includes(p.value)} />
                    {p.label}
                  </label>
                ))}
              </fieldset>
              <Textarea name="focus" rows={2} placeholder="Enfoque opcional: lanzamiento, temporada, promoción del mes..." />
              <Button type="submit">Generar plan</Button>
            </form>
          ) : (
            <p className="mt-3 text-sm">
              <Link href={`/business/${id}/settings`} className="text-brand hover:underline">
                Configura tu IA
              </Link>{" "}
              para planificar automáticamente.
            </p>
          )}
        </details>

        <details className="rounded-lg border border-border bg-surface p-4">
          <summary className="flex cursor-pointer items-center gap-2 font-medium">
            <Plus className="size-4 text-brand" /> Agregar publicación
          </summary>
          <div className="mt-3">
            <PlanItemForm
              action={addPlanItem.bind(null, id)}
              options={{ campaigns, pieces, links }}
              defaultDate={sp.month && sp.month !== todayIso.slice(0, 7) ? `${current}-01` : todayIso}
              submitLabel="Agregar al calendario"
            />
          </div>
        </details>
      </div>

      {/* Month navigation + format filter */}
      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link href={qs({ month: monthKey(year, month0 - 1), format: formatFilter })} className="rounded-md border border-border p-1.5 hover:bg-black/5 dark:hover:bg-white/5" aria-label="Mes anterior">
            <ChevronLeft className="size-4" />
          </Link>
          <h2 className="min-w-40 text-center text-lg font-semibold capitalize">{monthLabel}</h2>
          <Link href={qs({ month: monthKey(year, month0 + 1), format: formatFilter })} className="rounded-md border border-border p-1.5 hover:bg-black/5 dark:hover:bg-white/5" aria-label="Mes siguiente">
            <ChevronRight className="size-4" />
          </Link>
          <Link href={qs({ format: formatFilter })} className="text-sm text-brand hover:underline">
            Hoy
          </Link>
        </div>
        <div className="flex flex-wrap gap-1.5 text-xs">
          <Link
            href={qs({ month: current })}
            className={`rounded-full px-2.5 py-1 font-medium ${!formatFilter ? "bg-foreground text-background" : "bg-black/5 dark:bg-white/10"}`}
          >
            Todos ({items.length})
          </Link>
          {FORMATS.map((f) => (
            <Link
              key={f.value}
              href={qs({ month: current, format: f.value })}
              className={`rounded-full px-2.5 py-1 font-medium ${f.color} ${formatFilter === f.value ? "ring-2 ring-foreground/40" : ""}`}
            >
              {f.label}
              {!formatFilter && countByFormat.get(f.value) ? ` (${countByFormat.get(f.value)})` : ""}
            </Link>
          ))}
        </div>
      </div>

      {/* Month grid (desktop) */}
      <div className="mt-3 hidden overflow-hidden rounded-lg border border-border md:block">
        <div className="grid grid-cols-7 border-b border-border bg-surface text-xs font-medium text-muted">
          {WEEKDAYS.map((d) => (
            <div key={d} className="px-2 py-1.5">
              {d}
            </div>
          ))}
        </div>
        {weeks.map((week) => (
          <div key={week[0]} className="grid grid-cols-7 border-b border-border last:border-b-0">
            {week.map((day) => {
              const inMonth = Number(day.slice(5, 7)) - 1 === month0;
              const dayItems = byDay.get(day) ?? [];
              return (
                <div
                  key={day}
                  className={`min-h-28 border-r border-border p-1.5 last:border-r-0 ${inMonth ? "" : "bg-black/[0.02] text-faint dark:bg-white/[0.02]"}`}
                >
                  <p className={`text-xs ${day === todayIso ? "inline-block rounded-full bg-brand px-1.5 font-semibold text-brand-foreground" : ""}`}>
                    {Number(day.slice(8))}
                  </p>
                  <div className="mt-1 space-y-1">
                    {dayItems.map((item) => (
                      <Link
                        key={item.id}
                        href={`${base}/${item.id}`}
                        title={`${formatInfo(item.format).label} · ${platformLabel(item.platform)} · ${statusLabel(item.status)}`}
                        className={`block truncate rounded px-1.5 py-0.5 text-[11px] font-medium ${formatInfo(item.format).color} ${
                          item.status === "published" ? "opacity-60 line-through" : ""
                        }`}
                      >
                        {item.time && <span className="mr-1 opacity-70">{item.time}</span>}
                        {item.title}
                      </Link>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Month list (mobile) */}
      <div className="mt-3 space-y-2 md:hidden">
        {items.length === 0 && <p className="text-sm text-muted">No hay publicaciones este mes.</p>}
        {items.map((item) => (
          <ItemRow key={item.id} href={`${base}/${item.id}`} item={item} />
        ))}
      </div>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">Próximos 14 días</h2>
        {upcoming.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Nada programado. Planifica con IA o agrega una publicación.</p>
        ) : (
          <Card className="mt-3 divide-y divide-border p-0">
            {upcoming.map((item) => (
              <ItemRow key={item.id} href={`${base}/${item.id}`} item={item} />
            ))}
          </Card>
        )}
      </section>
    </main>
  );
}

function ItemRow({
  href,
  item,
}: {
  href: string;
  item: { date: Date; time: string | null; format: string; platform: string; title: string; status: string };
}) {
  const f = formatInfo(item.format);
  return (
    <Link href={href} className="flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-black/[0.03] dark:hover:bg-white/5">
      <span className="w-20 shrink-0 text-xs text-muted">
        {item.date.toLocaleDateString("es", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" })}
        {item.time ? ` ${item.time}` : ""}
      </span>
      <span className={`shrink-0 rounded px-1.5 py-0.5 text-[11px] font-medium ${f.color}`}>{f.label}</span>
      <span className="min-w-0 flex-1 truncate font-medium">{item.title}</span>
      <span className="hidden shrink-0 text-xs text-muted sm:inline">
        {platformLabel(item.platform)} · {statusLabel(item.status)}
      </span>
    </Link>
  );
}
