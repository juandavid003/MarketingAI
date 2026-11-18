import { notFound } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, AlertTriangle, ExternalLink, Clapperboard, Loader2, Film } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireBusinessAccess } from "@/lib/dal";
import { fileUrl } from "@/lib/storage";
import { purposeLabel, type GeneratedContentPiece } from "@/lib/contentAi";
import { parseReview } from "@/lib/takeReview";
import { isTakeStalled } from "@/lib/jobs/processTake";
import { isAssemblyStalled } from "@/lib/jobs/assemblePiece";
import { AutoRefresh } from "@/components/AutoRefresh";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { assemblePiece, retryTake, deletePiece } from "../../content-actions";
import { TakeUploadForm } from "./TakeUploadForm";

type SourceRef = { permalink: string | null; competitor: string; why: string };

export default async function ContentPiecePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; pieceId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id, pieceId } = await params;
  const { error } = await searchParams;
  await requireBusinessAccess(id);

  const piece = await prisma.contentPiece.findFirst({
    where: { id: pieceId, businessId: id },
    include: {
      takes: true,
      videoAssets: { orderBy: { createdAt: "desc" }, include: { versions: true } },
    },
  });
  if (!piece) notFound();

  let content: GeneratedContentPiece;
  try {
    content = JSON.parse(piece.content) as GeneratedContentPiece;
  } catch {
    notFound();
  }
  const refs: SourceRef[] = piece.sourceRefs ? (JSON.parse(piece.sourceRefs) as SourceRef[]) : [];
  const takeByScene = new Map(piece.takes.map((t) => [t.sceneNumber, t]));

  const readyCount = content.escenas.filter((s) => takeByScene.get(s.numero)?.status === "ready").length;
  const allReady = readyCount === content.escenas.length;
  const rerecordCount = piece.takes.filter((t) => parseReview(t.review)?.verdict === "rerecord").length;
  const assemblyStalled = isAssemblyStalled(piece);
  const assembling = piece.assemblyStatus === "assembling" && !assemblyStalled;
  const takesProcessing = piece.takes.some((t) => ["uploaded", "processing"].includes(t.status) && !isTakeStalled(t));

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      {(assembling || takesProcessing) && <AutoRefresh />}
      <PageHeader
        backHref={`/business/${id}`}
        backLabel="Volver al negocio"
        eyebrow={`${purposeLabel(content.proposito)} · ${content.formato} · ~${Math.round(content.duracionTotalSegundos)} s`}
        title={`“${content.hook}”`}
        description={piece.sourceSummary}
      />

      {error && (
        <p className="mb-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      {refs.length > 0 && (
        <Card className="mb-6 p-4">
          <p className="text-sm font-medium">Inspirada en publicaciones reales de la competencia</p>
          <ul className="mt-2 space-y-1 text-sm text-muted">
            {refs.map((r, i) => (
              <li key={i}>
                {r.permalink ? (
                  <a
                    href={r.permalink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-brand hover:underline"
                  >
                    {r.competitor} <ExternalLink className="size-3" />
                  </a>
                ) : (
                  r.competitor
                )}
              </li>
            ))}
          </ul>
          {refs[0]?.why && <p className="mt-2 text-sm text-muted">{refs[0].why}</p>}
        </Card>
      )}

      <section>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold">Guion escena por escena</h2>
          <p className="text-sm text-muted">
            {readyCount}/{content.escenas.length} tomas listas
          </p>
        </div>
        <p className="mt-1 text-sm text-muted">
          Graba cada escena como un video separado con el celular en vertical y súbela aquí.
          Revisamos cada toma y te avisamos si conviene volver a grabarla.
        </p>

        <div className="mt-4 space-y-4">
          {content.escenas.map((scene) => {
            const take = takeByScene.get(scene.numero);
            const review = parseReview(take?.review ?? null);
            const takeStalled = take ? isTakeStalled(take) : false;
            const takeBusy = take && ["uploaded", "processing"].includes(take.status) && !takeStalled;
            return (
              <Card key={scene.numero} className="p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium">Escena {scene.numero}</p>
                  <span className="text-xs text-faint">~{scene.duracionSegundos} s</span>
                </div>
                <dl className="mt-2 space-y-1.5 text-sm">
                  <Row label="Qué mostrar" value={scene.queMostrar} />
                  <Row label="Qué decir" value={scene.queDecir ? `“${scene.queDecir}”` : "Sin diálogo"} />
                  {scene.textoPantalla && <Row label="Texto en pantalla" value={scene.textoPantalla} />}
                  <Row label="Cómo grabarlo" value={scene.comoGrabar} />
                </dl>

                <div className="mt-4 space-y-3 border-t border-border pt-3">
                  {take && (
                    <div className="flex flex-wrap items-start gap-3">
                      <video
                        src={fileUrl(take.originalPath)}
                        controls
                        preload="metadata"
                        className="w-28 rounded-md border border-border"
                      />
                      <div className="min-w-0 flex-1 space-y-1.5 text-sm">
                        {takeBusy && (
                          <Badge tone="warning">
                            <Loader2 className="size-3 animate-spin" /> Revisando la toma...
                          </Badge>
                        )}
                        {take.status === "error" && (
                          <p className="text-red-700 dark:text-red-400">No se pudo procesar: {take.errorMessage}</p>
                        )}
                        {takeStalled && <p className="text-muted">La revisión se interrumpió.</p>}
                        {(take.status === "error" || takeStalled) && (
                          <form action={retryTake.bind(null, id, pieceId, take.id)}>
                            <Button type="submit" size="sm" variant="secondary">
                              Reintentar
                            </Button>
                          </form>
                        )}
                        {take.status === "ready" && review?.verdict === "ok" && (
                          <p className="flex items-center gap-1.5 font-medium text-green-700 dark:text-green-400">
                            <CheckCircle2 className="size-4" /> Toma lista
                          </p>
                        )}
                        {take.status === "ready" && review?.verdict === "rerecord" && (
                          <div className="rounded-md bg-amber-50 p-3 dark:bg-amber-950/50">
                            <p className="flex items-center gap-1.5 font-medium text-amber-800 dark:text-amber-300">
                              <AlertTriangle className="size-4" /> Conviene volver a grabar esta escena
                            </p>
                            <ul className="mt-1 list-disc pl-5 text-amber-900 dark:text-amber-200">
                              {review.reasons.map((r, i) => (
                                <li key={i}>{r}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {review?.tip && <p className="text-muted">Consejo: {review.tip}</p>}
                        {review?.notes.map((n, i) => (
                          <p key={i} className="text-muted">
                            {n}
                          </p>
                        ))}
                        {review && (
                          <p className="text-xs text-faint">
                            {review.checkedBy === "rules+audio_ai"
                              ? "Revisamos el audio y lo dicho frente al guion. La imagen aún no se analiza."
                              : "Revisión básica de duración y voz (sin transcripción: agrega tu key de OpenAI para revisar lo dicho y poner subtítulos)."}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                  <TakeUploadForm businessId={id} pieceId={pieceId} sceneNumber={scene.numero} hasTake={!!take} />
                </div>
              </Card>
            );
          })}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">Video final</h2>
        <Card className="mt-3 space-y-3 p-4">
          {assembling ? (
            <p className="flex items-center gap-2 text-sm">
              <Loader2 className="size-4 animate-spin" /> Armando el video: uniendo escenas, quitando
              silencios y poniendo subtítulos. Puede tardar unos minutos; puedes salir de esta página.
            </p>
          ) : (
            <>
              <p className="text-sm text-muted">
                Unimos las escenas en orden, quitamos los silencios, agregamos subtítulos y el texto
                en pantalla con el color de tu marca, y generamos versiones 9:16 y 4:5.
              </p>
              {piece.assemblyStatus === "error" && piece.assemblyError && (
                <p className="text-sm text-red-700 dark:text-red-400">No se pudo armar: {piece.assemblyError}</p>
              )}
              {assemblyStalled && <p className="text-sm text-muted">El armado anterior se interrumpió.</p>}
              {rerecordCount > 0 && allReady && (
                <p className="text-sm text-amber-800 dark:text-amber-300">
                  {rerecordCount === 1 ? "Una escena tiene" : `${rerecordCount} escenas tienen`} aviso para
                  volver a grabar. Puedes armar igual o reemplazar esas tomas primero.
                </p>
              )}
              <form action={assemblePiece.bind(null, id, pieceId)}>
                <Button type="submit" disabled={!allReady}>
                  <Film className="size-4" />
                  {piece.videoAssets.length > 0 ? "Volver a armar el video" : "Armar video final"}
                </Button>
              </form>
              {!allReady && (
                <p className="text-xs text-muted">Disponible cuando todas las escenas tengan su toma lista.</p>
              )}
            </>
          )}

          {piece.videoAssets.length > 0 && (
            <ul className="divide-y divide-border border-t border-border">
              {piece.videoAssets.map((video) => (
                <li key={video.id}>
                  <Link
                    href={`/business/${id}/videos/${video.id}`}
                    className="flex items-center justify-between gap-2 py-3 text-sm hover:text-brand"
                  >
                    <span className="flex items-center gap-2 font-medium">
                      <Clapperboard className="size-4" />
                      Video armado · {video.versions.length} versiones
                    </span>
                    <span className="text-muted">{video.createdAt.toLocaleString("es")}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">Texto para publicar</h2>
        <Card className="mt-3 space-y-4 p-4 text-sm">
          <div>
            <p className="font-medium text-muted">Descripción</p>
            <p className="mt-1 whitespace-pre-line">{content.descripcion}</p>
          </div>
          {content.ctas.length > 0 && (
            <div>
              <p className="font-medium text-muted">Llamadas a la acción</p>
              <ul className="mt-1 list-disc pl-5">
                {content.ctas.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </div>
          )}
          {content.hashtags.length > 0 && (
            <div>
              <p className="font-medium text-muted">Hashtags</p>
              <p className="mt-1 text-brand">{content.hashtags.join(" ")}</p>
            </div>
          )}
        </Card>
      </section>

      <div className="mt-10 border-t border-border pt-6">
        <form action={deletePiece.bind(null, id, pieceId)}>
          <Button type="submit" variant="destructive" size="sm">
            Eliminar este guion y sus tomas
          </Button>
        </form>
        <p className="mt-2 text-xs text-faint">
          Generado con {piece.provider} ({piece.model}). Los videos ya armados no se borran.
        </p>
      </div>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="inline font-medium">{label}: </dt>
      <dd className="inline text-muted">{value}</dd>
    </div>
  );
}
