import QRCode from "qrcode";
import { Link2, Ticket, MessageCircle, Globe, Download } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireBusinessAccess } from "@/lib/dal";
import { shortUrl, isWhatsAppUrl } from "@/lib/links";
import { daysAgo } from "@/lib/contentPlan";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Field";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Notice, Section } from "@/components/business/sections";
import { createTrackedLink, setLinkArchived, createPromoCode, setPromoCodeActive } from "../links-actions";


export default async function LinksPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; created?: string; archived?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const { business } = await requireBusinessAccess(id);
  const since30 = daysAgo(30);
  const showArchived = sp.archived === "1";

  const [links, codes, campaigns, pieces] = await Promise.all([
    prisma.trackedLink.findMany({
      where: { businessId: id, archived: showArchived },
      orderBy: { createdAt: "desc" },
      include: {
        campaign: { select: { title: true } },
        contentPiece: { select: { hook: true } },
        _count: { select: { clicks: true, leads: true } },
      },
    }),
    prisma.promoCode.findMany({
      where: { businessId: id },
      orderBy: { createdAt: "desc" },
      include: {
        campaign: { select: { title: true } },
        leads: { select: { status: true, value: true } },
      },
    }),
    prisma.campaign.findMany({ where: { businessId: id }, select: { id: true, title: true }, orderBy: { createdAt: "desc" } }),
    prisma.contentPiece.findMany({ where: { businessId: id }, select: { id: true, hook: true }, orderBy: { createdAt: "desc" } }),
  ]);
  const recent = await prisma.linkClick.groupBy({
    by: ["linkId"],
    where: { linkId: { in: links.map((l) => l.id) }, createdAt: { gte: since30 } },
    _count: { _all: true },
  });
  const recentBy = new Map(recent.map((r) => [r.linkId, r._count._all]));
  const qrs = new Map(
    await Promise.all(
      links.map(async (l) => [l.id, await QRCode.toDataURL(shortUrl(l.slug), { margin: 1, width: 160 })] as const)
    )
  );

  const refSelects = (
    <>
      <Select name="campaignId" defaultValue="">
        <option value="">Campaña (opcional)</option>
        {campaigns.map((c) => (
          <option key={c.id} value={c.id}>
            {c.title}
          </option>
        ))}
      </Select>
      <Select name="contentPieceId" defaultValue="">
        <option value="">Guion / video (opcional)</option>
        {pieces.map((p) => (
          <option key={p.id} value={p.id}>
            {p.hook.slice(0, 60)}
          </option>
        ))}
      </Select>
    </>
  );

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <PageHeader
        eyebrow={business.name}
        title="Enlaces y códigos"
        description="Usa un enlace o código distinto por campaña o contenido. Así sabes qué trae visitas, mensajes y clientes, no solo likes."
      />
      <div className="space-y-2">
        {sp.error && <Notice tone="danger">{sp.error}</Notice>}
        {sp.created && (
          <Notice tone="success">
            Enlace creado: <span className="font-mono">{shortUrl(sp.created)}</span>. Úsalo en la bio, el copy o un QR.
          </Notice>
        )}
      </div>

      <Section icon={Link2} title="Enlaces rastreables" className="mt-6">
        <p className="text-sm text-muted">
          Cada clic se cuenta sin guardar datos personales (ni IP ni identificadores): solo la hora, el tipo de
          dispositivo y el sitio de origen. Las vistas previas de WhatsApp o Facebook no cuentan como clic.
        </p>
        <div className="grid gap-3 md:grid-cols-2">
          <details className="rounded-lg border border-border bg-surface p-4">
            <summary className="flex cursor-pointer items-center gap-2 font-medium">
              <Globe className="size-4 text-brand" /> A una página web
            </summary>
            <form action={createTrackedLink.bind(null, id)} className="mt-3 space-y-2 text-sm">
              <input type="hidden" name="kind" value="web" />
              <Input name="label" required placeholder="Nombre: Bio de Instagram, Reel promo..." />
              <Input name="destination" required placeholder="https://tusitio.com/oferta" defaultValue={business.websiteUrl ?? ""} />
              <div className="grid grid-cols-2 gap-2">
                <Input name="utmSource" placeholder="Origen (instagram)" />
                <Input name="utmMedium" placeholder="Medio (organic, bio)" />
              </div>
              {refSelects}
              <Button type="submit" size="sm">
                Crear enlace
              </Button>
            </form>
          </details>
          <details className="rounded-lg border border-border bg-surface p-4">
            <summary className="flex cursor-pointer items-center gap-2 font-medium">
              <MessageCircle className="size-4 text-brand" /> A WhatsApp con mensaje
            </summary>
            <form action={createTrackedLink.bind(null, id)} className="mt-3 space-y-2 text-sm">
              <input type="hidden" name="kind" value="whatsapp" />
              <Input name="label" required placeholder="Nombre: WhatsApp desde el reel..." />
              <Input name="phone" placeholder="Número con código de país" defaultValue={business.whatsapp ?? ""} />
              <Input name="message" placeholder="Mensaje: Hola, vi su video y quiero..." />
              <p className="text-xs text-muted">
                Agregamos al mensaje una referencia (ej. “ref: k3m9x2a”) para que sepas de qué enlace vino el chat.
              </p>
              {refSelects}
              <Button type="submit" size="sm">
                Crear enlace
              </Button>
            </form>
          </details>
        </div>

        <div className="flex justify-end text-sm">
          <a href={`?archived=${showArchived ? "0" : "1"}`} className="text-brand hover:underline">
            {showArchived ? "Ver enlaces activos" : "Ver archivados"}
          </a>
        </div>

        {links.length === 0 ? (
          <EmptyState icon={Link2} title={showArchived ? "No hay enlaces archivados" : "Todavía no tienes enlaces"} />
        ) : (
          <div className="space-y-3">
            {links.map((link) => (
              <Card key={link.id} className="flex flex-wrap gap-4 p-4 text-sm">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrs.get(link.id)} alt={`QR de ${link.label}`} className="size-24 shrink-0 rounded border border-border bg-white" />
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{link.label}</p>
                    {isWhatsAppUrl(link.destinationUrl) && <Badge>WhatsApp</Badge>}
                  </div>
                  <p className="select-all font-mono text-brand">{shortUrl(link.slug)}</p>
                  <p className="truncate text-xs text-faint">→ {link.destinationUrl}</p>
                  <p className="text-muted">
                    {link._count.clicks} clics en total · {recentBy.get(link.id) ?? 0} en 30 días · {link._count.leads} leads
                  </p>
                  {(link.campaign || link.contentPiece) && (
                    <p className="text-xs text-muted">
                      {link.campaign && `Campaña: ${link.campaign.title}`}
                      {link.campaign && link.contentPiece && " · "}
                      {link.contentPiece && `Guion: “${link.contentPiece.hook.slice(0, 50)}”`}
                    </p>
                  )}
                  <div className="flex flex-wrap items-center gap-3 pt-1 text-xs">
                    <a href={`/api/links/${link.id}/qr`} className="inline-flex items-center gap-1 text-brand hover:underline">
                      <Download className="size-3.5" /> QR PNG
                    </a>
                    <a href={`/api/links/${link.id}/qr?format=svg`} className="inline-flex items-center gap-1 text-brand hover:underline">
                      <Download className="size-3.5" /> QR SVG (imprenta)
                    </a>
                    <form action={setLinkArchived.bind(null, id, link.id, !link.archived)}>
                      <button type="submit" className="text-faint hover:text-foreground">
                        {link.archived ? "Reactivar" : "Archivar"}
                      </button>
                    </form>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </Section>

      <Section icon={Ticket} title="Códigos promocionales" className="mt-12">
        <p className="text-sm text-muted">
          Un código por campaña o contenido (ej. REEL10). Cuando un cliente lo menciona, regístralo como lead con ese
          código: queda atribuido con confianza alta.
        </p>
        <form action={createPromoCode.bind(null, id)} className="grid gap-2 rounded-lg border border-border bg-surface p-4 text-sm sm:grid-cols-2">
          <Input name="code" required placeholder="CÓDIGO (ej. VERANO15)" className="uppercase" />
          <Input name="description" placeholder="Qué da: 15% de descuento, envío gratis..." />
          {refSelects}
          <div>
            <Button type="submit" size="sm">
              Crear código
            </Button>
          </div>
        </form>
        {codes.length > 0 && (
          <ul className="divide-y divide-border">
            {codes.map((c) => {
              const won = c.leads.filter((l) => l.status === "won");
              const value = won.reduce((s, l) => s + (l.value ?? 0), 0);
              return (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                  <span className="min-w-0">
                    <span className={`font-mono font-semibold ${c.active ? "" : "text-faint line-through"}`}>{c.code}</span>
                    {c.description && <span className="text-muted"> · {c.description}</span>}
                    {c.campaign && <span className="block text-xs text-faint">Campaña: {c.campaign.title}</span>}
                  </span>
                  <span className="flex items-center gap-3 text-muted">
                    {c.leads.length} leads · {won.length} clientes{value > 0 ? ` · ${value.toLocaleString("es")}` : ""}
                    <form action={setPromoCodeActive.bind(null, id, c.id, !c.active)}>
                      <button type="submit" className="text-xs text-faint hover:text-foreground">
                        {c.active ? "Desactivar" : "Activar"}
                      </button>
                    </form>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Section>
    </main>
  );
}
