import { UserRoundCheck } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireBusinessAccess } from "@/lib/dal";
import { LEAD_SOURCES, LEAD_STATUSES, ATTRIBUTION_LABEL, leadSourceLabel, leadStatus, type Attribution } from "@/lib/leads";
import { isoDay } from "@/lib/contentPlan";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input, Select, Textarea } from "@/components/ui/Field";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Notice } from "@/components/business/sections";
import { createLead, updateLeadStatus, deleteLead } from "../leads-actions";

const ATTRIBUTION_TONE: Record<Attribution, "success" | "warning" | "neutral"> = {
  high: "success",
  medium: "warning",
  low: "neutral",
};

export default async function LeadsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ status?: string; saved?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const { business } = await requireBusinessAccess(id);
  const statusFilter = LEAD_STATUSES.some((s) => s.value === sp.status) ? sp.status : undefined;

  const [leads, counts, links, codes, campaigns, pieces] = await Promise.all([
    prisma.lead.findMany({
      where: { businessId: id, ...(statusFilter ? { status: statusFilter } : {}) },
      orderBy: { occurredAt: "desc" },
      take: 200,
      include: {
        trackedLink: { select: { label: true } },
        promoCode: { select: { code: true } },
        campaign: { select: { title: true } },
        contentPiece: { select: { hook: true } },
      },
    }),
    prisma.lead.groupBy({ by: ["status"], where: { businessId: id }, _count: { _all: true } }),
    prisma.trackedLink.findMany({ where: { businessId: id, archived: false }, select: { id: true, label: true, slug: true } }),
    prisma.promoCode.findMany({ where: { businessId: id, active: true }, select: { id: true, code: true } }),
    prisma.campaign.findMany({ where: { businessId: id }, select: { id: true, title: true }, orderBy: { createdAt: "desc" } }),
    prisma.contentPiece.findMany({ where: { businessId: id }, select: { id: true, hook: true }, orderBy: { createdAt: "desc" } }),
  ]);
  const countBy = new Map(counts.map((c) => [c.status, c._count._all]));
  const total = counts.reduce((s, c) => s + c._count._all, 0);

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <PageHeader
        eyebrow={business.name}
        title="Leads"
        description="Cada persona interesada que te escribe, llama o visita. Anota de dónde vino y en qué quedó: así ves qué contenido trae clientes de verdad."
      />
      {sp.saved === "1" && <Notice tone="success">Lead guardado.</Notice>}

      <details className="mt-4 rounded-lg border border-border bg-surface p-4" open={total === 0}>
        <summary className="cursor-pointer font-medium">Registrar lead</summary>
        <form action={createLead.bind(null, id)} className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
          <Input name="name" placeholder="Nombre (opcional)" />
          <Input name="contact" placeholder="Teléfono o usuario (opcional)" />
          <label className="block space-y-1">
            <span className="font-medium">¿Por dónde llegó?</span>
            <Select name="source" defaultValue="whatsapp">
              {LEAD_SOURCES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </Select>
          </label>
          <label className="block space-y-1">
            <span className="font-medium">Fecha</span>
            <Input name="occurredAt" type="date" defaultValue={isoDay(new Date())} />
          </label>
          <label className="block space-y-1">
            <span className="font-medium">Enlace rastreable (si vino por uno)</span>
            <Select name="trackedLinkId" defaultValue="">
              <option value="">Ninguno</option>
              {links.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.label} (ref: {l.slug})
                </option>
              ))}
            </Select>
          </label>
          <label className="block space-y-1">
            <span className="font-medium">Código promocional usado</span>
            <Select name="promoCodeId" defaultValue="">
              <option value="">Ninguno</option>
              {codes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code}
                </option>
              ))}
            </Select>
          </label>
          <label className="block space-y-1">
            <span className="font-medium">Campaña que mencionó</span>
            <Select name="campaignId" defaultValue="">
              <option value="">No sabe / ninguna</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </Select>
          </label>
          <label className="block space-y-1">
            <span className="font-medium">Contenido que vio</span>
            <Select name="contentPieceId" defaultValue="">
              <option value="">No sabe / ninguno</option>
              {pieces.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.hook.slice(0, 60)}
                </option>
              ))}
            </Select>
          </label>
          <label className="block space-y-1">
            <span className="font-medium">Estado</span>
            <Select name="status" defaultValue="new">
              {LEAD_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </Select>
          </label>
          <label className="block space-y-1">
            <span className="font-medium">Valor de la venta (si compró)</span>
            <Input name="value" inputMode="decimal" placeholder="0" />
          </label>
          <Textarea name="notes" rows={2} placeholder="Notas" className="sm:col-span-2" />
          <div className="sm:col-span-2">
            <Button type="submit">Guardar lead</Button>
          </div>
        </form>
      </details>

      <div className="mt-8 flex flex-wrap gap-1.5 text-xs">
        <a
          href="?"
          className={`rounded-full px-2.5 py-1 font-medium ${!statusFilter ? "bg-foreground text-background" : "bg-black/5 dark:bg-white/10"}`}
        >
          Todos ({total})
        </a>
        {LEAD_STATUSES.map((s) => (
          <a
            key={s.value}
            href={`?status=${s.value}`}
            className={`rounded-full px-2.5 py-1 font-medium ${statusFilter === s.value ? "bg-foreground text-background" : "bg-black/5 dark:bg-white/10"}`}
          >
            {s.label} ({countBy.get(s.value) ?? 0})
          </a>
        ))}
      </div>

      {leads.length === 0 ? (
        <div className="mt-4">
          <EmptyState icon={UserRoundCheck} title="No hay leads aquí todavía" />
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          {leads.map((lead) => {
            const st = leadStatus(lead.status);
            const attr = (lead.attribution as Attribution) in ATTRIBUTION_LABEL ? (lead.attribution as Attribution) : "low";
            return (
              <Card key={lead.id} className="p-4 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium">
                      {lead.name || "Sin nombre"}
                      {lead.contact && <span className="font-normal text-muted"> · {lead.contact}</span>}
                    </p>
                    <p className="text-xs text-muted">
                      {lead.occurredAt.toLocaleDateString("es", { timeZone: "UTC" })} · {leadSourceLabel(lead.source)}
                      {lead.trackedLink && ` · enlace “${lead.trackedLink.label}”`}
                      {lead.promoCode && ` · código ${lead.promoCode.code}`}
                      {lead.campaign && ` · ${lead.campaign.title}`}
                      {lead.contentPiece && ` · “${lead.contentPiece.hook.slice(0, 40)}”`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone={ATTRIBUTION_TONE[attr]} title={ATTRIBUTION_LABEL[attr].help}>
                      Atribución {ATTRIBUTION_LABEL[attr].label.toLowerCase()}
                    </Badge>
                    <Badge tone={st.tone}>{st.label}</Badge>
                  </div>
                </div>
                {lead.notes && <p className="mt-2 text-muted">{lead.notes}</p>}
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <form action={updateLeadStatus.bind(null, id, lead.id)} className="flex flex-wrap items-center gap-2">
                    <Select name="status" defaultValue={lead.status} className="w-auto py-1">
                      {LEAD_STATUSES.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </Select>
                    <Input
                      name="value"
                      inputMode="decimal"
                      placeholder="Valor"
                      defaultValue={lead.value != null ? String(lead.value) : ""}
                      className="w-28 py-1"
                    />
                    <Button type="submit" size="sm" variant="secondary">
                      Actualizar
                    </Button>
                  </form>
                  <form action={deleteLead.bind(null, id, lead.id)} className="ml-auto">
                    <button type="submit" className="text-xs text-faint hover:text-red-600">
                      Eliminar
                    </button>
                  </form>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </main>
  );
}
