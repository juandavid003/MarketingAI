import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireBusinessAccess } from "@/lib/dal";
import { PLAN_STATUSES, formatInfo, platformLabel, parseDetails, isoDay } from "@/lib/contentPlan";
import { shortUrl } from "@/lib/links";
import { fileUrl } from "@/lib/storage";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { Notice } from "@/components/business/sections";
import { updatePlanItem, deletePlanItem, setPlanItemStatus } from "../../calendar-actions";
import { PlanItemForm } from "../PlanItemForm";

export default async function PlanItemPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; itemId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id, itemId } = await params;
  const { error } = await searchParams;
  await requireBusinessAccess(id);

  const item = await prisma.contentPlanItem.findFirst({
    where: { id: itemId, businessId: id },
    include: { contentPiece: true, campaign: true, trackedLink: true },
  });
  if (!item) notFound();

  const [campaigns, pieces, links, creative] = await Promise.all([
    prisma.campaign.findMany({ where: { businessId: id }, select: { id: true, title: true }, orderBy: { createdAt: "desc" } }),
    prisma.contentPiece.findMany({ where: { businessId: id }, select: { id: true, hook: true }, orderBy: { createdAt: "desc" } }),
    prisma.trackedLink.findMany({ where: { businessId: id, archived: false }, select: { id: true, label: true } }),
    item.contentPieceId && item.variantCode
      ? prisma.videoAsset.findFirst({
          where: { contentPieceId: item.contentPieceId, variantCode: item.variantCode },
          orderBy: { createdAt: "desc" },
          include: { versions: true },
        })
      : null,
  ]);
  const f = formatInfo(item.format);
  const details = parseDetails(item.details);

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <PageHeader
        backHref={`/business/${id}/calendar?month=${isoDay(item.date).slice(0, 7)}`}
        backLabel="Volver al calendario"
        eyebrow={`${item.date.toLocaleDateString("es", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" })}${
          item.time ? ` · ${item.time}` : ""
        } · ${platformLabel(item.platform)}`}
        title={item.title}
      />
      {error && <Notice tone="danger">{error}</Notice>}

      <Card className="space-y-3 p-5 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded px-2 py-0.5 text-xs font-medium ${f.color}`}>{f.label}</span>
          {item.pillar && <Badge>{item.pillar}</Badge>}
          {item.source === "ai" && <Badge tone="brand">Plan con IA</Badge>}
          {item.source === "distribution" && <Badge tone="brand">Del distribuidor</Badge>}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {PLAN_STATUSES.map((s) => (
            <form key={s.value} action={setPlanItemStatus.bind(null, id, item.id, s.value)}>
              <button
                type="submit"
                className={`rounded-full border px-2.5 py-1 text-xs font-medium ${
                  item.status === s.value ? "border-brand bg-brand-soft text-brand" : "border-border text-muted hover:text-foreground"
                }`}
              >
                {s.label}
              </button>
            </form>
          ))}
        </div>
        {item.brief && <p className="whitespace-pre-line">{item.brief}</p>}
        {details.length > 0 && (
          <ol className="list-decimal space-y-1 pl-5 text-muted">
            {details.map((d, i) => (
              <li key={i}>{d}</li>
            ))}
          </ol>
        )}
        {item.copy && (
          <div>
            <p className="font-medium text-muted">Texto de la publicación</p>
            <p className="mt-1 whitespace-pre-line rounded-md bg-black/[0.03] p-3 dark:bg-white/5">{item.copy}</p>
          </div>
        )}
        <ul className="space-y-1 text-muted">
          {item.contentPiece && (
            <li>
              Guion:{" "}
              <Link href={`/business/${id}/pieces/${item.contentPiece.id}`} className="text-brand hover:underline">
                “{item.contentPiece.hook}”
              </Link>
              {item.variantCode && (
                <>
                  {" "}· creativo{" "}
                  <Link href={`/business/${id}/pieces/${item.contentPiece.id}/creatives`} className="font-mono text-brand hover:underline">
                    {item.variantCode}
                  </Link>
                </>
              )}
            </li>
          )}
          {creative?.versions.map((v) => (
            <li key={v.id}>
              <a href={fileUrl(v.outputPath)} download className="text-brand hover:underline">
                Descargar {v.label}
              </a>
            </li>
          ))}
          {item.campaign && (
            <li>
              Campaña:{" "}
              <Link href={`/business/${id}/campaigns/${item.campaign.id}`} className="text-brand hover:underline">
                {item.campaign.title}
              </Link>
            </li>
          )}
          {item.trackedLink && (
            <li>
              Enlace para la bio o el copy: <span className="font-mono text-foreground">{shortUrl(item.trackedLink.slug)}</span>
            </li>
          )}
          {item.publishedUrl && (
            <li>
              <a href={item.publishedUrl} target="_blank" rel="noopener noreferrer" className="text-brand hover:underline">
                Ver publicación
              </a>
            </li>
          )}
        </ul>
      </Card>

      {item.status !== "published" && (
        <div className="mt-4">
          <Link
            href={`/business/${id}/publishing?item=${item.id}`}
            className="inline-flex items-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-medium text-brand-foreground hover:bg-brand-hover"
          >
            Publicar o programar esta publicación
          </Link>
        </div>
      )}

      <h2 className="mt-8 text-lg font-semibold">Editar</h2>
      <Card className="mt-3 p-5">
        <PlanItemForm
          action={updatePlanItem.bind(null, id, item.id)}
          options={{ campaigns, pieces, links }}
          item={item}
          submitLabel="Guardar cambios"
        />
      </Card>

      <form action={deletePlanItem.bind(null, id, item.id)} className="mt-6">
        <Button type="submit" variant="destructive" size="sm">
          Quitar del calendario
        </Button>
      </form>
    </main>
  );
}
