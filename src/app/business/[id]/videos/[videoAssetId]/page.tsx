import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireBusinessAccess } from "@/lib/dal";
import type { Transcript } from "@/lib/whisper";
import { publishVideoVersion } from "../../video-actions";

const STATUS_LABEL: Record<string, string> = {
  uploaded: "Subido, preparando...",
  transcribing: "Transcribiendo audio...",
  analyzing: "Analizando la transcripción...",
  rendering: "Generando el clip editado...",
  ready: "Listo",
  error: "Error",
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

  const inProgress = !["ready", "error"].includes(video.status);

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <Link
        href={`/business/${id}`}
        className="text-sm text-neutral-500 underline hover:text-neutral-800 dark:hover:text-neutral-200"
      >
        ← Volver al negocio
      </Link>

      <h1 className="mt-4 text-2xl font-semibold">🎬 {video.originalFilename}</h1>

      <div className="mt-4 flex items-center gap-2">
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
            video.status === "ready"
              ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300"
              : video.status === "error"
                ? "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300"
                : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
          }`}
        >
          {STATUS_LABEL[video.status] ?? video.status}
        </span>
        {inProgress && (
          <span className="text-sm text-neutral-500 dark:text-neutral-400">
            Actualiza esta página en unos segundos para ver el progreso.
          </span>
        )}
      </div>

      {video.status === "error" && video.errorMessage && (
        <p className="mt-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {video.errorMessage}
        </p>
      )}
      {publishError && (
        <p className="mt-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          No se pudo publicar: {publishError}
        </p>
      )}

      <div className="mt-6">
        <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400">Video original</p>
        <video src={video.originalPath} controls className="mt-2 w-full rounded-lg border border-neutral-200 dark:border-neutral-800" />
      </div>

      {transcript && (
        <div className="mt-6">
          <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400">Transcripción</p>
          <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">{transcript.text}</p>
        </div>
      )}

      {video.versions.map((version) => (
        <div key={version.id} className="mt-8 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
          <p className="text-sm font-medium">{version.label}</p>
          <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
            {version.startSeconds.toFixed(1)}s – {version.endSeconds.toFixed(1)}s
          </p>

          <div className="mt-3 flex gap-4">
            <video
              src={version.outputPath}
              controls
              poster={version.thumbnailPath ?? undefined}
              className="w-40 rounded-md border border-neutral-200 dark:border-neutral-800"
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
                href={version.outputPath}
                download
                className="inline-block text-sm underline text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
              >
                Descargar clip
              </a>
            </div>
          </div>

          <div className="mt-3 border-t border-neutral-200 pt-3 dark:border-neutral-800">
            {version.publishedVideos[0] ? (
              <p className="text-sm">
                ✅ Publicado en {version.publishedVideos[0].pageName}
                {version.publishedVideos[0].permalinkUrl && (
                  <>
                    {" · "}
                    <a
                      href={version.publishedVideos[0].permalinkUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
                    >
                      Ver publicación
                    </a>
                  </>
                )}
              </p>
            ) : pages.length > 0 ? (
              <form
                action={publishVideoVersion.bind(null, id, videoAssetId, version.id)}
                className="flex flex-wrap items-center gap-2"
              >
                <select
                  name="pageId"
                  required
                  className="rounded-md border border-neutral-300 bg-transparent px-2 py-1.5 text-sm dark:border-neutral-700"
                >
                  {pages.map((page) => (
                    <option key={page.id} value={page.facebookPageId}>
                      {page.name}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  className="rounded-md bg-black px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
                >
                  Publicar en Facebook
                </button>
              </form>
            ) : (
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                Conecta una página de Facebook para poder publicar.
              </p>
            )}
          </div>
        </div>
      ))}
    </main>
  );
}
