import { notFound } from "next/navigation";
import { CheckCircle2, ExternalLink, Download } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireBusinessAccess } from "@/lib/dal";
import type { Transcript } from "@/lib/whisper";
import { publishVideoVersion, retryVideoProcessing } from "../../video-actions";
import { fileUrl } from "@/lib/storage";
import { isStalled } from "@/lib/jobs/processVideo";
import { AutoRefresh } from "@/components/AutoRefresh";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Field";

const STATUS_LABEL: Record<string, string> = {
  uploaded: "Subido, preparando...",
  transcribing: "Transcribiendo audio...",
  analyzing: "Analizando la transcripción...",
  rendering: "Generando el clip editado...",
  ready: "Listo",
  error: "Error",
};

const STATUS_TONE: Record<string, "success" | "danger" | "warning"> = {
  ready: "success",
  error: "danger",
};

export default async function VideoAssetPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; videoAssetId: string }>;
  searchParams: Promise<{ publish_error?: string }>;
}) {
  const { id, videoAssetId } = await params;
  const { publish_error: publishError } = await searchParams;

  await requireBusinessAccess(id);

  const [video, business] = await Promise.all([
    prisma.videoAsset.findUnique({
      where: { id: videoAssetId },
      include: {
        versions: {
          orderBy: { createdAt: "asc" },
          include: { publishedVideos: { orderBy: { createdAt: "desc" } } },
        },
      },
    }),
    prisma.business.findUnique({
      where: { id },
      include: { socialConnection: { include: { pages: true } } },
    }),
  ]);

  if (!video || video.businessId !== id || !business) {
    notFound();
  }

  const pages = business.socialConnection?.pages ?? [];

  let transcript: Transcript | null = null;
  if (video.transcript) {
    try {
      transcript = JSON.parse(video.transcript) as Transcript;
    } catch {
      transcript = null;
    }
  }

  const stalled = isStalled(video);
  const inProgress = !["ready", "error"].includes(video.status) && !stalled;
  const canRetry = video.status === "error" || stalled;

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <PageHeader
        backHref={`/business/${id}`}
        backLabel="Volver al negocio"
        title={video.originalFilename}
        actions={
          <div className="flex items-center gap-2">
            <Badge tone={STATUS_TONE[video.status] ?? "warning"}>
              {STATUS_LABEL[video.status] ?? video.status}
            </Badge>
          </div>
        }
      />

      {inProgress && (
        <>
          <AutoRefresh />
          <p className="-mt-4 mb-4 text-sm text-muted">
            Estamos procesando tu video en segundo plano. Puedes salir de esta página: el
            progreso se guarda y esta vista se actualiza sola.
          </p>
        </>
      )}

      <div className="space-y-2">
        {video.status === "error" && video.errorMessage && <Notice>{video.errorMessage}</Notice>}
        {stalled && (
          <Notice>
            El procesamiento se interrumpió (probablemente por un reinicio del servidor). Puedes
            reintentarlo.
          </Notice>
        )}
        {publishError && <Notice>No se pudo publicar: {publishError}</Notice>}
        {canRetry && (
          <form action={retryVideoProcessing.bind(null, id, videoAssetId)}>
            <Button type="submit" size="sm" variant="secondary">
              Reintentar procesamiento
            </Button>
          </form>
        )}
      </div>

      <div className="mt-6">
        <p className="text-sm font-medium text-muted">Video original</p>
        <video src={fileUrl(video.originalPath)} controls className="mt-2 w-full rounded-lg border border-border" />
      </div>

      {transcript && (
        <div className="mt-6">
          <p className="text-sm font-medium text-muted">Transcripción</p>
          <p className="mt-2 text-sm text-muted">{transcript.text}</p>
        </div>
      )}

      {video.versions.map((version) => (
        <Card key={version.id} className="mt-6">
          <p className="text-sm font-medium">{version.label}</p>
          <p className="mt-1 text-xs text-faint">
            {version.startSeconds.toFixed(1)}s – {version.endSeconds.toFixed(1)}s
          </p>

          <div className="mt-3 flex gap-4">
            <video
              src={fileUrl(version.outputPath)}
              controls
              poster={version.thumbnailPath ? fileUrl(version.thumbnailPath) : undefined}
              className="w-40 rounded-md border border-border"
            />
            <div className="flex-1 space-y-2">
              {version.hook && (
                <p className="text-sm">
                  <span className="font-medium">Hook: </span>
                  {version.hook}
                </p>
              )}
              {version.cta && (
                <p className="text-sm">
                  <span className="font-medium">CTA: </span>
                  {version.cta}
                </p>
              )}
              <a
                href={`${fileUrl(version.outputPath)}${version.outputPath.startsWith("/") ? "" : "?download=1"}`}
                download
                className="inline-flex items-center gap-1 text-sm text-brand hover:underline"
              >
                <Download className="size-3.5" /> Descargar clip
              </a>
            </div>
          </div>

          <div className="mt-3 border-t border-border pt-3">
            {version.publishedVideos[0] ? (
              <p className="flex items-center gap-1.5 text-sm">
                <CheckCircle2 className="size-4 text-green-600 dark:text-green-400" />
                Publicado en {version.publishedVideos[0].pageName}
                {version.publishedVideos[0].permalinkUrl && (
                  <a
                    href={version.publishedVideos[0].permalinkUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-0.5 text-brand hover:underline"
                  >
                    Ver publicación <ExternalLink className="size-3" />
                  </a>
                )}
              </p>
            ) : pages.length > 0 ? (
              <form
                action={publishVideoVersion.bind(null, id, videoAssetId, version.id)}
                className="flex flex-wrap items-center gap-2"
              >
                <Select name="pageId" required className="w-auto">
                  {pages.map((page) => (
                    <option key={page.id} value={page.facebookPageId}>
                      {page.name}
                    </option>
                  ))}
                </Select>
                <Button type="submit" size="sm">
                  Publicar en Facebook
                </Button>
              </form>
            ) : (
              <p className="text-sm text-muted">Conecta una página de Facebook para poder publicar.</p>
            )}
          </div>
        </Card>
      ))}
    </main>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
      {children}
    </p>
  );
}
