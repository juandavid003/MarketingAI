import Link from "next/link";
import { Send, ExternalLink, Package, AlertTriangle, Hand } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireBusinessAccess } from "@/lib/dal";
import { isoDay, daysAgo } from "@/lib/contentPlan";
import { parsePlatformCopy } from "@/lib/platformCopy";
import { JOB_STATUS, MANUAL_PLATFORMS, platformName, IG_PUBLISH_ENABLED } from "@/lib/publishing";
import { MAX_ATTEMPTS } from "@/lib/jobs/publishJobs";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input, Select, Textarea } from "@/components/ui/Field";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { AutoRefresh } from "@/components/AutoRefresh";
import { LocalTime } from "@/components/LocalTime";
import { Notice } from "@/components/business/sections";
import { schedulePublication, cancelPublication, retryPublication, markPublished } from "../publishing-actions";
import { WhenField } from "./WhenField";

export default async function PublishingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ version?: string; item?: string; error?: string; saved?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const { business } = await requireBusinessAccess(id);

  const [assets, pages, jobs, item] = await Promise.all([
    prisma.videoAsset.findMany({
      where: { businessId: id, status: "ready" },
      orderBy: { createdAt: "desc" },
      take: 40,
      include: { versions: { orderBy: { createdAt: "asc" } }, contentPiece: { select: { platformCopy: true } } },
    }),
    prisma.socialPage.findMany({ where: { connection: { businessId: id } }, orderBy: { name: "asc" } }),
    prisma.publishJob.findMany({
      where: { businessId: id },
      orderBy: { scheduledAt: "desc" },
      take: 100,
      include: { videoVersion: { include: { videoAsset: { select: { id: true, originalFilename: true } } } } },
    }),
    sp.item ? prisma.contentPlanItem.findFirst({ where: { id: sp.item, businessId: id } }) : null,
  ]);

  // Preselection: an explicit version, else the calendar item's creative/video.
  let preVersionId = sp.version && assets.some((a) => a.versions.some((v) => v.id === sp.version)) ? sp.version : "";
  if (!preVersionId && item?.contentPieceId) {
    const asset = assets.find(
      (a) => a.contentPieceId === item.contentPieceId && (item.variantCode ? a.variantCode === item.variantCode : true)
    );
    preVersionId = asset?.versions[0]?.id ?? "";
  }
  const preVersion = assets.flatMap((a) => a.versions.map((v) => ({ ...v, asset: a }))).find((v) => v.id === preVersionId);
  const itemPlatformCopy = preVersion?.asset.contentPiece
    ? parsePlatformCopy(preVersion.asset.contentPiece.platformCopy).find((c) => c.plataforma === item?.platform)
    : undefined;
  const defaultCaption =
    item?.copy ||
    (itemPlatformCopy ? [itemPlatformCopy.caption, itemPlatformCopy.hashtags.join(" ")].filter(Boolean).join("\n\n") : "") ||
    preVersion?.caption ||
    [preVersion?.hook, preVersion?.cta].filter(Boolean).join("\n\n");
  const defaultAt = item ? `${isoDay(item.date)}T${item.time ?? "18:00"}` : "";

  const now = daysAgo(0).getTime();
  const manualDue = jobs.filter((j) => j.target === "manual" && j.status === "scheduled" && j.scheduledAt.getTime() <= now + 86_400_000);
  const upcoming = jobs
    .filter((j) => ["scheduled", "publishing"].includes(j.status) && !manualDue.includes(j))
    .sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());
  const failed = jobs.filter((j) => j.status === "failed");
  const published = jobs.filter((j) => j.status === "published").slice(0, 20);
  const busy = jobs.some((j) => j.status === "publishing" || (j.status === "scheduled" && j.target !== "manual" && j.scheduledAt.getTime() <= now));

  const pageName = new Map(pages.map((p) => [p.id, p]));
  const destinationLabel = (j: (typeof jobs)[number]) => {
    const page = j.socialPageId ? pageName.get(j.socialPageId) : null;
    if (j.target === "facebook_page") return `Facebook · ${page?.name ?? "página"}`;
    if (j.target === "instagram_reels") return `Instagram Reels · @${page?.instagramUsername ?? "cuenta"}`;
    return `${platformName(j.platform)} (lo publicas tú)`;
  };

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      {busy && <AutoRefresh intervalMs={8000} />}
      <PageHeader
        eyebrow={business.name}
        title="Publicaciones"
        description="Publica ahora o programa tus videos en Facebook e Instagram. Para TikTok, YouTube y otras redes te dejamos un recordatorio y el paquete listo para subir."
      />
      <div className="space-y-2">
        {sp.error && <Notice tone="danger">{sp.error}</Notice>}
        {sp.saved && <Notice tone="success">Listo. Lo verás en la lista de abajo.</Notice>}
      </div>

      <Card className="mt-4 p-5">
        <p className="flex items-center gap-2 font-medium">
          <Send className="size-4 text-brand" /> Nueva publicación
          {item && <span className="text-sm font-normal text-muted">· del calendario: {item.title}</span>}
        </p>
        {assets.length === 0 ? (
          <p className="mt-2 text-sm text-muted">
            Todavía no tienes videos listos. Ármalos desde el{" "}
            <Link href={`/business/${id}/copywriter`} className="text-brand hover:underline">
              Copywriter
            </Link>
            .
          </p>
        ) : (
          <form action={schedulePublication.bind(null, id)} className="mt-3 space-y-3 text-sm">
            {item && <input type="hidden" name="planItemId" value={item.id} />}
            <label className="block space-y-1">
              <span className="font-medium">Video</span>
              <Select name="versionId" required defaultValue={preVersionId}>
                <option value="" disabled>
                  Elige un video y formato
                </option>
                {assets.map((a) => (
                  <optgroup key={a.id} label={a.originalFilename}>
                    {a.versions.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.label}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </Select>
            </label>
            <label className="block space-y-1">
              <span className="font-medium">Dónde</span>
              <Select name="destination" required defaultValue="">
                <option value="" disabled>
                  Elige el destino
                </option>
                {pages.length > 0 && (
                  <optgroup label="Publicación automática">
                    {pages.map((p) => (
                      <option key={`fb-${p.id}`} value={`fb:${p.id}`}>
                        Facebook · {p.name}
                      </option>
                    ))}
                    {pages
                      .filter((p) => p.instagramAccountId)
                      .map((p) => (
                        <option key={`ig-${p.id}`} value={`ig:${p.id}`} disabled={!IG_PUBLISH_ENABLED}>
                          Instagram Reels · @{p.instagramUsername}
                          {IG_PUBLISH_ENABLED ? "" : " (pendiente de aprobación de Meta)"}
                        </option>
                      ))}
                  </optgroup>
                )}
                <optgroup label="Recordatorio (lo publicas tú)">
                  {MANUAL_PLATFORMS.map((p) => (
                    <option key={p.value} value={`manual:${p.value}`}>
                      {p.label}
                    </option>
                  ))}
                </optgroup>
              </Select>
              {pages.length === 0 && (
                <span className="block text-xs text-muted">
                  Para publicar automáticamente, conecta Facebook e Instagram en{" "}
                  <Link href={`/business/${id}/connections`} className="text-brand hover:underline">
                    Conexiones
                  </Link>
                  .
                </span>
              )}
            </label>
            <label className="block space-y-1">
              <span className="font-medium">Texto de la publicación</span>
              <Textarea name="caption" rows={5} required defaultValue={defaultCaption} />
              <span className="block text-xs text-muted">
                Si no eliges texto, usa el del guion. Los textos por red están en cada guion (“Escribir textos por red”).
              </span>
            </label>
            <WhenField defaultAt={defaultAt} />
            <Button type="submit">Guardar</Button>
          </form>
        )}
      </Card>

      {manualDue.length > 0 && (
        <Section title="Te toca publicar" icon={Hand}>
          {manualDue.map((j) => (
            <JobRow key={j.id} businessId={id} job={j} destination={destinationLabel(j)}>
              <a href={`/api/video-assets/${j.videoVersion.videoAsset.id}/package`} className="inline-flex items-center gap-1 text-brand hover:underline">
                <Package className="size-3.5" /> Descargar paquete
              </a>
              <form action={markPublished.bind(null, id, j.id)} className="flex flex-wrap items-center gap-2">
                <Input name="url" placeholder="Enlace de la publicación (opcional)" className="w-64 py-1" />
                <Button type="submit" size="sm" variant="secondary">
                  Ya lo publiqué
                </Button>
              </form>
            </JobRow>
          ))}
        </Section>
      )}

      {failed.length > 0 && (
        <Section title="Con error" icon={AlertTriangle}>
          {failed.map((j) => (
            <JobRow key={j.id} businessId={id} job={j} destination={destinationLabel(j)}>
              <form action={retryPublication.bind(null, id, j.id)}>
                <Button type="submit" size="sm" variant="secondary">
                  Reintentar ahora
                </Button>
              </form>
              <form action={cancelPublication.bind(null, id, j.id)}>
                <button type="submit" className="text-xs text-faint hover:text-foreground">
                  Descartar
                </button>
              </form>
            </JobRow>
          ))}
        </Section>
      )}

      <Section title="Programadas" icon={Send}>
        {upcoming.length === 0 ? (
          <EmptyState icon={Send} title="No hay publicaciones programadas" />
        ) : (
          upcoming.map((j) => (
            <JobRow key={j.id} businessId={id} job={j} destination={destinationLabel(j)}>
              {j.target === "manual" && (
                <a href={`/api/video-assets/${j.videoVersion.videoAsset.id}/package`} className="inline-flex items-center gap-1 text-brand hover:underline">
                  <Package className="size-3.5" /> Paquete
                </a>
              )}
              {j.status === "scheduled" && (
                <form action={cancelPublication.bind(null, id, j.id)}>
                  <button type="submit" className="text-xs text-faint hover:text-foreground">
                    Cancelar
                  </button>
                </form>
              )}
            </JobRow>
          ))
        )}
      </Section>

      {published.length > 0 && (
        <Section title="Publicadas" icon={ExternalLink}>
          {published.map((j) => (
            <JobRow key={j.id} businessId={id} job={j} destination={destinationLabel(j)} />
          ))}
        </Section>
      )}
    </main>
  );
}

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-10">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <Icon className="size-4 text-brand" /> {title}
      </h2>
      <div className="mt-3 space-y-2">{children}</div>
    </section>
  );
}

function JobRow({
  job,
  destination,
  children,
}: {
  businessId: string;
  job: {
    id: string;
    status: string;
    scheduledAt: Date;
    publishedAt: Date | null;
    attempts: number;
    lastError: string | null;
    nextAttemptAt: Date | null;
    permalink: string | null;
    caption: string;
    videoVersion: { label: string; videoAsset: { originalFilename: string } };
  };
  destination: string;
  children?: React.ReactNode;
}) {
  const st = JOB_STATUS[job.status] ?? JOB_STATUS.scheduled;
  return (
    <Card className="p-4 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium">{destination}</p>
          <p className="truncate text-xs text-muted">
            {job.videoVersion.videoAsset.originalFilename} · {job.videoVersion.label}
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted">
          <LocalTime iso={(job.publishedAt ?? job.scheduledAt).toISOString()} withWeekday />
          <Badge tone={st.tone}>{st.label}</Badge>
        </div>
      </div>
      <p className="mt-2 line-clamp-2 whitespace-pre-line text-muted">{job.caption}</p>
      {job.lastError && (
        <p className="mt-2 text-red-700 dark:text-red-400">
          {job.lastError}
          {job.status === "scheduled" && job.nextAttemptAt && (
            <span className="text-muted">
              {" "}
              · Intento {job.attempts} de {MAX_ATTEMPTS}; reintentamos <LocalTime iso={job.nextAttemptAt.toISOString()} />.
            </span>
          )}
        </p>
      )}
      {(children || job.permalink) && (
        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
          {job.permalink && (
            <a href={job.permalink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-brand hover:underline">
              Ver publicación <ExternalLink className="size-3" />
            </a>
          )}
          {children}
        </div>
      )}
    </Card>
  );
}
