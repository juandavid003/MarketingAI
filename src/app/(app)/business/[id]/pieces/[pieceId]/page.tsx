import { notFound } from "next/navigation";
import Link from "next/link";
import { ExternalLink, Clapperboard, Loader2, Film, Sparkles } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireBusinessAccess } from "@/lib/dal";
import {
  purposeLabel,
  recordingStatus,
  FULL_TAKE_SCENE,
  FULL_TAKE_SLOT,
  type GeneratedContentPiece,
} from "@/lib/contentAi";
import { parsePlatformCopy, COPY_PLATFORMS } from "@/lib/platformCopy";
import { parseReview } from "@/lib/takeReview";
import { isTakeStalled } from "@/lib/jobs/processTake";
import { isAssemblyStalled } from "@/lib/jobs/assemblePiece";
import { AutoRefresh } from "@/components/AutoRefresh";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { assemblePiece, deletePiece, generatePieceCopy } from "../../content-actions";
import { TakeUploadForm } from "./TakeUploadForm";
import { TakeDetails } from "./TakeDetails";
import { AiTakeForm } from "./AiTakeForm";
import { getVideoProvider, sceneVideoPrompt } from "@/lib/videoGen";
import { languageLabel } from "@/lib/businessContext";
import { Notice } from "@/components/ui/Notice";
import { AiRequired } from "@/components/business/sections";

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
  const { business } = await requireBusinessAccess(id);

  const piece = await prisma.contentPiece.findFirst({
    where: { id: pieceId, businessId: id },
    include: {
      takes: true,
      videoAssets: { where: { variantCode: null }, orderBy: { createdAt: "desc" }, include: { versions: true } },
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
  const mainTakes = piece.takes.filter((t) => t.slot === "main");
  const takeByScene = new Map(mainTakes.map((t) => [t.sceneNumber, t]));

  const readyCount = content.escenas.filter((s) => takeByScene.get(s.numero)?.status === "ready").length;
  const allReady = readyCount === content.escenas.length;
  const fullTake = piece.takes.find((t) => t.slot === FULL_TAKE_SLOT) ?? null;
  const recorded = recordingStatus(content, piece.takes);
  const platformCopy = parsePlatformCopy(piece.platformCopy);
  const rerecordCount = mainTakes.filter((t) => parseReview(t.review)?.verdict === "rerecord").length;
  const assemblyStalled = isAssemblyStalled(piece);
  const assembling = piece.assemblyStatus === "assembling" && !assemblyStalled;
  const takesProcessing = piece.takes.some(
    (t) => ["generating", "uploaded", "processing"].includes(t.status) && !isTakeStalled(t)
  );
  // AI video: configured when there's a provider and a key for it (Gemini
  // can reuse the visual-review key) — see lib/videoGen/credentials.ts.
  const videoProvider = getVideoProvider(business.videoAiProvider);
  const videoAiReady =
    videoProvider != null &&
    (business.videoAiKeyEncrypted != null || (videoProvider.id === "gemini" && business.geminiApiKeyEncrypted != null));
  const language = languageLabel(business.contentLanguage);

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      {(assembling || takesProcessing) && <AutoRefresh />}
      <PageHeader
        backHref={`/business/${id}/copywriter`}
        backLabel="Volver a Guiones"
        eyebrow={`${purposeLabel(content.proposito)} · ${content.formato} · ~${Math.round(content.duracionTotalSegundos)} s`}
        title={`“${content.hook}”`}
        description={piece.sourceSummary}
      />

      {error && (
        <Notice tone="danger" className="mb-4">
          {error}
        </Notice>
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
          Graba cada escena como un video separado con el celular en vertical y súbela aquí, o genera con IA
          las que no puedas grabar. Revisamos cada toma y te avisamos si conviene volver a grabarla.
        </p>

        <div className="mt-4 space-y-4">
          {content.escenas.map((scene) => {
            const take = takeByScene.get(scene.numero);
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
                  {take && <TakeDetails businessId={id} pieceId={pieceId} take={take} label="esta escena" />}
                  <TakeUploadForm businessId={id} pieceId={pieceId} sceneNumber={scene.numero} hasTake={!!take} />
                  {videoAiReady ? (
                    <AiTakeForm
                      businessId={id}
                      pieceId={pieceId}
                      sceneNumber={scene.numero}
                      providerLabel={videoProvider!.label}
                      hasTake={!!take}
                      defaultPrompt={
                        take?.source === "ai" && take.aiPrompt ? take.aiPrompt : sceneVideoPrompt(scene, business, language)
                      }
                    />
                  ) : (
                    <AiRequired businessId={id} what="generar escenas con video IA" className="text-xs" />
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      </section>

      <section className="mt-6">
        <Card className="p-4">
          <p className="font-medium">¿Lo grabaste todo de una vez?</p>
          <p className="mt-1 text-sm text-muted">
            Sube el video completo en lugar de las escenas: quitamos los silencios, ponemos subtítulos, el hook al
            inicio y la llamada a la acción al final, en 9:16 y 4:5. También sirve para los creativos del distribuidor.
          </p>
          <div className="mt-3 space-y-3">
            {fullTake && <TakeDetails businessId={id} pieceId={pieceId} take={fullTake} label="este video" />}
            <TakeUploadForm
              businessId={id}
              pieceId={pieceId}
              sceneNumber={FULL_TAKE_SCENE}
              slot={FULL_TAKE_SLOT}
              hasTake={!!fullTake}
            />
          </div>
        </Card>
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
              <div className="flex flex-wrap gap-2">
                <form action={assemblePiece.bind(null, id, pieceId, "scenes")}>
                  <Button type="submit" disabled={!allReady}>
                    <Film className="size-4" />
                    {piece.videoAssets.length > 0 ? "Volver a armar desde las escenas" : "Armar desde las escenas"}
                  </Button>
                </form>
                {recorded.fullReady && (
                  <form action={assemblePiece.bind(null, id, pieceId, "full")}>
                    <Button type="submit" variant={allReady ? "secondary" : "primary"}>
                      <Film className="size-4" /> Editar el video completo
                    </Button>
                  </form>
                )}
              </div>
              {!allReady && !recorded.fullReady && (
                <p className="text-xs text-muted">
                  Disponible cuando todas las escenas tengan su toma lista, o cuando subas el video completo.
                </p>
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
                      {video.originalFilename.split(" — ")[0]} · {video.versions.length} versiones
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
        <Link
          href={`/business/${id}/pieces/${pieceId}/creatives`}
          className="block rounded-lg border border-brand/40 bg-brand-soft p-4 hover:border-brand"
        >
          <p className="flex items-center gap-2 font-semibold text-brand">
            <Sparkles className="size-4" /> Distribución: un video, varios creativos →
          </p>
          <p className="mt-1 text-sm text-muted">
            {piece.strategy
              ? "Ver el plan de publicación, los hooks y CTAs alternativos y los resultados de cada creativo."
              : "Prueba distintos hooks y llamadas a la acción con este mismo video y recibe un calendario por red para saber cuál funciona mejor."}
          </p>
        </Link>
      </section>

      <section className="mt-10" id="textos">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Texto para publicar</h2>
          <form action={generatePieceCopy.bind(null, id, pieceId)}>
            <Button type="submit" size="sm" variant="secondary">
              <Sparkles className="size-4" /> {platformCopy.length > 0 ? "Reescribir textos por red" : "Escribir textos por red"}
            </Button>
          </form>
        </div>
        {platformCopy.length > 0 && (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {platformCopy.map((c) => (
              <Card key={c.plataforma} className="space-y-2 p-4 text-sm">
                <p className="font-medium">{COPY_PLATFORMS[c.plataforma]?.label ?? c.plataforma}</p>
                {c.titulo && (
                  <p>
                    <span className="text-muted">Título: </span>
                    <span className="select-all font-medium">{c.titulo}</span>
                  </p>
                )}
                <p className="select-all whitespace-pre-line rounded-md bg-black/[0.03] p-3 dark:bg-white/5">
                  {c.caption}
                  {c.hashtags.length > 0 && `\n\n${c.hashtags.join(" ")}`}
                </p>
                {c.nota && <p className="text-xs text-muted">{c.nota}</p>}
              </Card>
            ))}
          </div>
        )}
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
