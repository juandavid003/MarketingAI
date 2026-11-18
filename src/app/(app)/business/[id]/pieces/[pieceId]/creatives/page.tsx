import { notFound } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, AlertTriangle, Loader2, Sparkles, Film, Trophy, ExternalLink, CalendarDays } from "lucide-react";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireBusinessAccess } from "@/lib/dal";
import { fileUrl } from "@/lib/storage";
import type { GeneratedContentPiece } from "@/lib/contentAi";
import {
  parseStrategy,
  planPlatforms,
  defaultTestCodes,
  variantCode,
  type DistributionStrategy,
  type HookOption,
} from "@/lib/distribution";
import { summarizeResults, compareCreatives, MIN_VIEWS_PER_CREATIVE, type ResultSummary } from "@/lib/variantResults";
import { parseReview } from "@/lib/takeReview";
import { isTakeStalled } from "@/lib/jobs/processTake";
import { areVariantsStalled } from "@/lib/jobs/renderVariants";
import { AutoRefresh } from "@/components/AutoRefresh";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input, Select, Textarea } from "@/components/ui/Field";
import {
  generateStrategy,
  updateStrategyOption,
  renderCreatives,
  addVariantResult,
  removeVariantResult,
} from "../../../distribution-actions";
import { addStrategyToCalendar } from "../../../calendar-actions";
import { TakeUploadForm } from "../TakeUploadForm";

export default async function CreativesPage({
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
      variants: { include: { results: { orderBy: { createdAt: "asc" } } }, orderBy: { code: "asc" } },
      videoAssets: {
        where: { variantCode: { not: null } },
        orderBy: { createdAt: "desc" },
        include: { versions: { orderBy: { label: "desc" } } },
      },
    },
  });
  if (!piece) notFound();

  let content: GeneratedContentPiece;
  try {
    content = JSON.parse(piece.content) as GeneratedContentPiece;
  } catch {
    notFound();
  }
  const strategy = parseStrategy(piece.strategy);
  const piecePath = `/business/${id}/pieces/${pieceId}`;

  const mainReady = new Set(
    piece.takes.filter((t) => t.slot === "main" && t.status === "ready").map((t) => t.sceneNumber)
  );
  const scenesReady = content.escenas.every((s) => mainReady.has(s.numero));
  const variantsStalled = areVariantsStalled(piece.variants);
  const rendering = piece.variants.some((v) => ["queued", "rendering"].includes(v.renderStatus)) && !variantsStalled;
  const hookTakesBusy = piece.takes.some(
    (t) => t.slot !== "main" && ["uploaded", "processing"].includes(t.status) && !isTakeStalled(t)
  );

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      {(rendering || hookTakesBusy) && <AutoRefresh />}
      <PageHeader
        backHref={piecePath}
        backLabel="Volver al guion"
        eyebrow="Distribución"
        title="Un video, varios creativos"
        description={`Mismo cuerpo de “${content.titulo}”, con distintos hooks y llamadas a la acción, y un plan para publicarlos y quedarte con el que mejor funcione.`}
      />

      {error && (
        <p className="mb-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      {!strategy ? (
        <Card className="space-y-3 p-5">
          <p className="text-sm">
            El distribuidor escribe 3 hooks y 2 CTAs alternativos para este mismo video, arma los creativos
            combinándolos con lo que ya grabaste y te da un calendario por red, con el texto de cada
            publicación, para descubrir qué apertura y qué cierre funcionan mejor.
          </p>
          <p className="text-sm text-muted">
            Puedes generarlo antes de grabar: así grabas las aperturas alternativas en la misma sesión.
          </p>
          <form action={generateStrategy.bind(null, id, pieceId)}>
            <Button type="submit">
              <Sparkles className="size-4" /> Generar plan de distribución
            </Button>
          </form>
        </Card>
      ) : (
        <StrategyView
          businessId={id}
          pieceId={pieceId}
          piecePath={piecePath}
          strategy={strategy}
          piece={piece}
          scenesReady={scenesReady}
          rendering={rendering}
          platformOptions={[
            ...new Set([...planPlatforms(business.mainPlatforms), ...strategy.calendario.map((p) => p.plataforma)]),
          ]}
        />
      )}
    </main>
  );
}

type PieceWithAll = Prisma.ContentPieceGetPayload<{
  include: {
    takes: true;
    variants: { include: { results: true } };
    videoAssets: { include: { versions: true } };
  };
}>;

function StrategyView({
  businessId,
  pieceId,
  piecePath,
  strategy,
  piece,
  scenesReady,
  rendering,
  platformOptions,
}: {
  businessId: string;
  pieceId: string;
  piecePath: string;
  strategy: DistributionStrategy;
  piece: PieceWithAll;
  scenesReady: boolean;
  rendering: boolean;
  platformOptions: string[];
}) {
  const variantByCode = new Map(piece.variants.map((v) => [v.code, v]));
  const hookByCode = new Map(strategy.hooks.map((h) => [h.codigo, h]));
  const ctaByCode = new Map(strategy.ctas.map((c) => [c.codigo, c]));

  // Latest render of each creative, and whether it still matches the texts.
  const latestVideo = new Map<string, PieceWithAll["videoAssets"][number]>();
  for (const v of piece.videoAssets) if (v.variantCode && !latestVideo.has(v.variantCode)) latestVideo.set(v.variantCode, v);
  const renderFor = (code: string) => {
    const video = latestVideo.get(code);
    const variant = variantByCode.get(code);
    if (!video || !variant) return null;
    const version = video.versions[0];
    const current =
      version?.hook === hookByCode.get(variant.hookCode)?.texto && version?.cta === ctaByCode.get(variant.ctaCode)?.texto;
    return { video, current };
  };

  const defaults = new Set(defaultTestCodes(strategy));
  const summaries = new Map<string, ResultSummary>(
    piece.variants.map((v) => [v.code, summarizeResults(v.results)])
  );

  // Phase 1: hooks with C1. Phase 2: the winning hook with every CTA.
  const hookCandidates = strategy.hooks
    .map((h) => variantCode(h.codigo, "C1"))
    .filter((code) => variantByCode.has(code))
    .map((code) => ({ code, summary: summaries.get(code)! }));
  const hookComparison = compareCreatives(hookCandidates, "hook");
  const winnerHook = hookComparison.conclusive ? variantByCode.get(hookComparison.leader!)?.hookCode ?? null : null;
  const ctaCandidates = winnerHook
    ? strategy.ctas
        .map((c) => variantCode(winnerHook, c.codigo))
        .filter((code) => variantByCode.has(code))
        .map((code) => ({ code, summary: summaries.get(code)! }))
    : [];
  const ctaComparison = winnerHook ? compareCreatives(ctaCandidates, "cta") : null;
  const phase2Codes = winnerHook ? strategy.ctas.map((c) => variantCode(winnerHook, c.codigo)) : [];
  const phase2Missing = phase2Codes.filter((code) => !renderFor(code));

  const hookLabel = (code: string) => (code === "ganador" ? (winnerHook ? `${winnerHook} (ganador)` : "Hook ganador") : code);

  return (
    <div className="space-y-10">
      <Card className="space-y-3 p-5">
        {strategy.resumen && <p className="text-sm">{strategy.resumen}</p>}
        <div className="grid gap-3 text-sm sm:grid-cols-2">
          <div className="rounded-md bg-black/[0.03] p-3 dark:bg-white/5">
            <p className="font-medium">Fase 1 · ¿Qué hook detiene el scroll?</p>
            <p className="mt-1 text-muted">
              Publica cada hook con el CTA C1, en la misma red y a la misma hora, en días distintos. Gana el
              que consiga más vistas por publicación.
            </p>
          </div>
          <div className="rounded-md bg-black/[0.03] p-3 dark:bg-white/5">
            <p className="font-medium">Fase 2 · ¿Qué CTA genera acción?</p>
            <p className="mt-1 text-muted">
              Con el hook ganador, prueba cada CTA. Gana el que consiga más clics o mensajes por cada 1.000
              vistas.
            </p>
          </div>
        </div>
        <p className="text-xs text-faint">
          En publicaciones orgánicas el día y el momento influyen mucho: la comparación es orientativa. Por
          eso pedimos al menos {MIN_VIEWS_PER_CREATIVE} vistas por creativo y una ventaja clara antes de declarar un ganador.
        </p>
      </Card>

      {/* ---------------------------------------------------------- Hooks */}
      <section>
        <h2 className="text-lg font-semibold">Hooks (apertura)</h2>
        <p className="mt-1 text-sm text-muted">
          El texto va en pantalla sobre la escena 1. Si además grabas la frase alternativa, también cambia lo
          que dices; si no, se usa tu escena 1 original con el nuevo texto.
        </p>
        <div className="mt-3 space-y-3">
          {strategy.hooks.map((hook) => (
            <HookCard key={hook.codigo} businessId={businessId} pieceId={pieceId} hook={hook} piece={piece} />
          ))}
        </div>
      </section>

      {/* ----------------------------------------------------------- CTAs */}
      <section>
        <h2 className="text-lg font-semibold">Llamadas a la acción (cierre)</h2>
        <p className="mt-1 text-sm text-muted">Van en pantalla sobre la última escena y en el texto de la publicación.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {strategy.ctas.map((cta) => (
            <Card key={cta.codigo} className="p-4 text-sm">
              <div className="flex items-center gap-2">
                <Badge tone="brand">{cta.codigo}</Badge>
                {cta.original && <span className="text-xs text-faint">original</span>}
              </div>
              <p className="mt-2 font-medium">“{cta.texto}”</p>
              {!cta.original && cta.angulo && <p className="mt-1 text-muted">{cta.angulo}</p>}
              <EditOption businessId={businessId} pieceId={pieceId} code={cta.codigo} texto={cta.texto} />
            </Card>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------ Creatives */}
      <section>
        <h2 className="text-lg font-semibold">Creativos</h2>
        <p className="mt-1 text-sm text-muted">
          Cada casilla es un video: el hook de la fila con el CTA de la columna. Ya marcamos los que necesita
          la fase 1 (todos los hooks con C1) y H1 con los otros CTAs.
        </p>
        <Card className="mt-3 p-4">
          {rendering && (
            <p className="mb-3 flex items-center gap-2 text-sm">
              <Loader2 className="size-4 animate-spin" /> Generando creativos. Solo se vuelven a procesar la
              primera y la última escena de cada uno; puedes salir de esta página.
            </p>
          )}
          <form action={renderCreatives.bind(null, businessId, pieceId)}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-muted">
                    <th className="py-2 pr-3 font-medium">Hook \ CTA</th>
                    {strategy.ctas.map((c) => (
                      <th key={c.codigo} className="px-2 py-2 font-medium">
                        {c.codigo}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {strategy.hooks.map((h) => (
                    <tr key={h.codigo} className="border-t border-border">
                      <td className="py-2 pr-3 font-medium">{h.codigo}</td>
                      {strategy.ctas.map((c) => {
                        const code = variantCode(h.codigo, c.codigo);
                        const variant = variantByCode.get(code);
                        const render = renderFor(code);
                        return (
                          <td key={c.codigo} className="px-2 py-2 align-top">
                            <label className="flex items-center gap-1.5">
                              <input
                                type="checkbox"
                                name="code"
                                value={code}
                                defaultChecked={!variant && defaults.has(code)}
                                className="size-4"
                              />
                              <span className="font-mono text-xs">{code}</span>
                            </label>
                            <div className="mt-1">
                              <CreativeStatus
                                businessId={businessId}
                                status={variant?.renderStatus ?? null}
                                error={variant?.renderError ?? null}
                                render={render}
                              />
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button type="submit" disabled={!scenesReady}>
                <Film className="size-4" /> Generar creativos marcados
              </Button>
              {!scenesReady && (
                <p className="text-sm text-muted">
                  Primero sube todas las escenas en el{" "}
                  <Link href={piecePath} className="text-brand hover:underline">
                    guion
                  </Link>
                  .
                </p>
              )}
            </div>
            <p className="mt-2 text-xs text-faint">
              Cada creativo sale en 9:16 y 4:5 con el texto de publicación de su CTA. Volver a marcar uno ya
              generado lo rehace con los textos actuales.
            </p>
          </form>
        </Card>
      </section>

      {/* ------------------------------------------------------- Calendar */}
      <section>
        <h2 className="text-lg font-semibold">Calendario de publicación</h2>
        <p className="mt-1 text-sm text-muted">
          Los horarios son un punto de partida: ajústalos con lo que muestren tus propias estadísticas.
        </p>
        <form
          action={addStrategyToCalendar.bind(null, businessId, pieceId)}
          className="mt-3 flex flex-wrap items-end gap-2 rounded-md border border-border p-3 text-sm"
        >
          <label className="space-y-1">
            <span className="block font-medium">Enviar al Manager de contenido desde el</span>
            <Input name="start" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} className="w-auto" />
          </label>
          <Button type="submit" size="sm" variant="secondary">
            <CalendarDays className="size-4" /> Agregar al calendario
          </Button>
          <span className="text-xs text-faint">El día 1 del plan cae en esa fecha. Volver a enviarlo reemplaza lo anterior.</span>
        </form>
        <div className="mt-3 space-y-3">
          {strategy.calendario.map((post, i) => {
            const code = post.hook === "ganador" ? (winnerHook ? variantCode(winnerHook, post.cta) : null) : variantCode(post.hook, post.cta);
            const render = code ? renderFor(code) : null;
            const version = render?.video.versions.find((v) => v.label.includes(post.formato === "4:5" ? "4:5" : "9:16"));
            return (
              <Card key={i} className="p-4 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">Día {post.dia}</span>
                  <Badge tone={post.fase === 1 ? "neutral" : "brand"}>Fase {post.fase}</Badge>
                  <span>{post.plataforma}</span>
                  <span className="text-muted">· {post.formato}</span>
                  {post.momento && <span className="text-muted">· {post.momento}</span>}
                  <span className="ml-auto font-mono text-xs">
                    {hookLabel(post.hook)} + {post.cta}
                  </span>
                </div>
                {post.copy && <p className="mt-2 whitespace-pre-line rounded-md bg-black/[0.03] p-3 dark:bg-white/5">{post.copy}</p>}
                {post.nota && <p className="mt-2 text-muted">{post.nota}</p>}
                <div className="mt-2 text-xs">
                  {version ? (
                    <a href={fileUrl(version.outputPath)} download className="text-brand hover:underline">
                      Descargar el video de esta publicación ({post.formato})
                    </a>
                  ) : (
                    <span className="text-faint">
                      {post.hook === "ganador" && !winnerHook
                        ? "Se define cuando la fase 1 tenga un ganador."
                        : "Genera este creativo para descargarlo."}
                    </span>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      </section>

      {strategy.plataformas.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold">Consejos por red</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {strategy.plataformas.map((p) => (
              <Card key={p.plataforma} className="p-4 text-sm">
                <p className="font-medium">
                  {p.plataforma} <span className="text-muted">· {p.formato}</span>
                </p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-muted">
                  {p.consejos.map((c, i) => (
                    <li key={i}>{c}</li>
                  ))}
                </ul>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* -------------------------------------------------------- Results */}
      <section>
        <h2 className="text-lg font-semibold">Resultados</h2>
        <p className="mt-1 text-sm text-muted">
          Unas 48 horas después de cada publicación, copia las cifras de las estadísticas de la red. Solo
          comparamos lo que tú registras.
        </p>

        <Card className="mt-3 space-y-3 p-4 text-sm">
          <ComparisonLine title="Fase 1 · hooks" comparison={hookComparison} empty={hookCandidates.length === 0} />
          {winnerHook && ctaComparison && (
            <ComparisonLine title={`Fase 2 · CTAs con ${winnerHook}`} comparison={ctaComparison} empty={false} />
          )}
          {winnerHook && phase2Missing.length > 0 && (
            <form action={renderCreatives.bind(null, businessId, pieceId)} className="flex flex-wrap items-center gap-3">
              {phase2Missing.map((code) => (
                <input key={code} type="hidden" name="code" value={code} />
              ))}
              <Button type="submit" size="sm" disabled={!scenesReady || rendering}>
                <Trophy className="size-4" /> Preparar fase 2 con {winnerHook}
              </Button>
              <span className="text-muted">Genera {phase2Missing.join(", ")}.</span>
            </form>
          )}
        </Card>

        <div className="mt-3 space-y-3">
          {piece.variants
            .filter((v) => renderFor(v.code) || v.results.length > 0)
            .map((variant) => {
              const s = summaries.get(variant.code)!;
              return (
                <Card key={variant.id} className="p-4 text-sm">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="font-medium">
                      <span className="font-mono">{variant.code}</span>{" "}
                      <span className="text-muted">
                        “{hookByCode.get(variant.hookCode)?.texto}” → “{ctaByCode.get(variant.ctaCode)?.texto}”
                      </span>
                    </p>
                    <p className="text-muted">
                      {s.posts} publ. · {s.views ?? "—"} vistas · {s.interactionRate ?? "—"}% interacción ·{" "}
                      {s.clicksPer1000 ?? "—"} clics/1.000
                    </p>
                  </div>
                  {variant.results.length > 0 && (
                    <ul className="mt-2 divide-y divide-border border-y border-border">
                      {variant.results.map((r) => (
                        <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                          <span className="font-medium">{r.platform}</span>
                          {r.postedAt && <span className="text-muted">{r.postedAt.toISOString().slice(0, 10)}</span>}
                          <span>{r.views} vistas</span>
                          {r.likes != null && <span>{r.likes} me gusta</span>}
                          {r.comments != null && <span>{r.comments} coment.</span>}
                          {r.shares != null && <span>{r.shares} compartidos</span>}
                          {r.saves != null && <span>{r.saves} guardados</span>}
                          {r.clicks != null && <span>{r.clicks} clics/mensajes</span>}
                          {r.postUrl && (
                            <a href={r.postUrl} target="_blank" rel="noopener noreferrer" className="text-brand">
                              <ExternalLink className="size-3.5" />
                            </a>
                          )}
                          <form action={removeVariantResult.bind(null, businessId, pieceId, r.id)} className="ml-auto">
                            <button type="submit" className="text-xs text-faint hover:text-red-600">
                              Quitar
                            </button>
                          </form>
                        </li>
                      ))}
                    </ul>
                  )}
                  <details className="mt-2">
                    <summary className="cursor-pointer text-brand">Registrar resultado</summary>
                    <form
                      action={addVariantResult.bind(null, businessId, pieceId, variant.id)}
                      className="mt-2 grid gap-2 sm:grid-cols-4"
                    >
                      <Select name="platform" required defaultValue={platformOptions[0]} className="sm:col-span-2">
                        {platformOptions.map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                        <option value="Otra">Otra</option>
                      </Select>
                      <Input name="postedAt" type="date" aria-label="Fecha de publicación" />
                      <Input name="views" inputMode="numeric" placeholder="Vistas *" required />
                      <Input name="likes" inputMode="numeric" placeholder="Me gusta" />
                      <Input name="comments" inputMode="numeric" placeholder="Comentarios" />
                      <Input name="shares" inputMode="numeric" placeholder="Compartidos" />
                      <Input name="saves" inputMode="numeric" placeholder="Guardados" />
                      <Input name="clicks" inputMode="numeric" placeholder="Clics / mensajes" />
                      <Input name="postUrl" placeholder="Enlace a la publicación" className="sm:col-span-3" />
                      <Input name="notes" placeholder="Nota (opcional)" className="sm:col-span-3" />
                      <Button type="submit" size="sm">
                        Guardar
                      </Button>
                    </form>
                  </details>
                </Card>
              );
            })}
          {piece.variants.length === 0 && <p className="text-sm text-muted">Genera creativos para empezar a registrar.</p>}
        </div>
      </section>

      {strategy.reutilizar.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold">Cuando tengas un ganador</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">
            {strategy.reutilizar.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </section>
      )}

      <div className="border-t border-border pt-6">
        <form action={generateStrategy.bind(null, businessId, pieceId)}>
          <Button type="submit" variant="secondary" size="sm" disabled={rendering}>
            <Sparkles className="size-4" /> Generar un plan nuevo
          </Button>
        </form>
        <p className="mt-2 text-xs text-faint">
          Reemplaza hooks, CTAs y calendario, y borra los creativos y resultados registrados de este plan (los
          videos ya generados siguen en tu biblioteca). Plan generado con {strategy.provider} ({strategy.model}).
        </p>
      </div>
    </div>
  );
}

function HookCard({
  businessId,
  pieceId,
  hook,
  piece,
}: {
  businessId: string;
  pieceId: string;
  hook: HookOption;
  piece: PieceWithAll;
}) {
  const take = hook.original ? null : piece.takes.find((t) => t.slot === `hook:${hook.codigo}`) ?? null;
  const review = parseReview(take?.review ?? null);
  const busy = take && ["uploaded", "processing"].includes(take.status) && !isTakeStalled(take);
  return (
    <Card className="p-4 text-sm">
      <div className="flex items-center gap-2">
        <Badge tone="brand">{hook.codigo}</Badge>
        <span className="text-xs text-faint">{hook.original ? "original del guion" : hook.angulo}</span>
      </div>
      <p className="mt-2 font-medium">En pantalla: “{hook.texto}”</p>
      {hook.queDecir && <p className="mt-1 text-muted">Frase a cámara: “{hook.queDecir}”</p>}
      <EditOption
        businessId={businessId}
        pieceId={pieceId}
        code={hook.codigo}
        texto={hook.texto}
        queDecir={hook.original ? undefined : hook.queDecir}
      />
      {!hook.original && (
        <div className="mt-3 space-y-2 border-t border-border pt-3">
          <p className="text-muted">
            Opcional (si grabaste por escenas): graba otra vez la escena 1 diciendo esta frase en lugar de la original, con el mismo encuadre.
          </p>
          {take && (
            <div className="flex flex-wrap items-start gap-3">
              <video src={fileUrl(take.originalPath)} controls preload="metadata" className="w-24 rounded-md border border-border" />
              <div className="space-y-1">
                {busy && (
                  <Badge tone="warning">
                    <Loader2 className="size-3 animate-spin" /> Revisando la toma...
                  </Badge>
                )}
                {take.status === "error" && <p className="text-red-700 dark:text-red-400">{take.errorMessage}</p>}
                {take.status === "ready" && review?.verdict === "ok" && (
                  <p className="flex items-center gap-1.5 font-medium text-green-700 dark:text-green-400">
                    <CheckCircle2 className="size-4" /> Apertura lista
                  </p>
                )}
                {take.status === "ready" && review?.verdict === "rerecord" && (
                  <div className="text-amber-800 dark:text-amber-300">
                    <p className="flex items-center gap-1.5 font-medium">
                      <AlertTriangle className="size-4" /> Conviene volver a grabarla
                    </p>
                    <ul className="list-disc pl-5">
                      {review.reasons.map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}
          <TakeUploadForm businessId={businessId} pieceId={pieceId} sceneNumber={1} slot={`hook:${hook.codigo}`} hasTake={!!take} />
        </div>
      )}
    </Card>
  );
}

function EditOption({
  businessId,
  pieceId,
  code,
  texto,
  queDecir,
}: {
  businessId: string;
  pieceId: string;
  code: string;
  texto: string;
  queDecir?: string;
}) {
  return (
    <details className="mt-2">
      <summary className="cursor-pointer text-xs text-brand">Editar</summary>
      <form action={updateStrategyOption.bind(null, businessId, pieceId, code)} className="mt-2 space-y-2">
        <Input name="texto" defaultValue={texto} required maxLength={200} aria-label="Texto en pantalla" />
        {queDecir !== undefined && (
          <Textarea name="queDecir" defaultValue={queDecir} rows={2} maxLength={300} aria-label="Frase a cámara" />
        )}
        <Button type="submit" size="sm" variant="secondary">
          Guardar
        </Button>
      </form>
    </details>
  );
}

function CreativeStatus({
  businessId,
  status,
  error,
  render,
}: {
  businessId: string;
  status: string | null;
  error: string | null;
  render: { video: { id: string }; current: boolean } | null;
}) {
  if (status === "queued") return <Badge tone="neutral">En cola</Badge>;
  if (status === "rendering")
    return (
      <Badge tone="warning">
        <Loader2 className="size-3 animate-spin" /> Generando
      </Badge>
    );
  if (status === "error") return <span className="text-xs text-red-700 dark:text-red-400" title={error ?? ""}>Error</span>;
  if (render) {
    return (
      <Link href={`/business/${businessId}/videos/${render.video.id}`} className="text-xs text-brand hover:underline">
        {render.current ? "Ver video" : "Ver (desactualizado)"}
      </Link>
    );
  }
  return null;
}

function ComparisonLine({
  title,
  comparison,
  empty,
}: {
  title: string;
  comparison: { leader: string | null; conclusive: boolean; message: string };
  empty: boolean;
}) {
  return (
    <div className="flex items-start gap-2">
      {comparison.conclusive ? (
        <Trophy className="mt-0.5 size-4 shrink-0 text-green-600" />
      ) : (
        <span className="mt-0.5 size-4 shrink-0" />
      )}
      <p>
        <span className="font-medium">{title}: </span>
        <span className={comparison.conclusive ? "text-green-700 dark:text-green-400" : "text-muted"}>
          {empty ? "genera los creativos de la fase 1 y registra sus resultados." : comparison.message}
        </span>
      </p>
    </div>
  );
}
