import { notFound } from "next/navigation";
import { ExternalLink, RefreshCw, Sparkles, Eye, Info, Lightbulb } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireBusinessAccess } from "@/lib/dal";
import { detectCountry, adLibraryWebUrl, adLibraryCoverage } from "@/lib/adLibrary";
import { competitorStats, formatLabel, interactions } from "@/lib/competitorStats";
import { purposeLabel, type GeneratedCompetitorIdeas } from "@/lib/contentAi";
import type { CompetitorPost } from "@/generated/prisma/client";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input, Select, Textarea } from "@/components/ui/Field";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  addCompetitor,
  removeCompetitor,
  syncCompetitor,
  updateCompetitorUsername,
  addManualPost,
  removeManualPost,
  generateIdeasFromCompetitors,
} from "../competitor-actions";
import { createPieceFromIdea } from "../content-actions";
import { Notice } from "@/components/ui/Notice";

const nf = new Intl.NumberFormat("es");

export default async function CompetitorsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; ideas?: string }>;
}) {
  const { id } = await params;
  const { error, ideas: ideasJustGenerated } = await searchParams;
  await requireBusinessAccess(id);

  const business = await prisma.business.findUnique({
    where: { id },
    include: {
      competitors: {
        orderBy: { createdAt: "asc" },
        include: { posts: { orderBy: [{ postedAt: "desc" }, { createdAt: "desc" }] } },
      },
      competitorIdeas: { orderBy: { createdAt: "desc" }, take: 1 },
      socialConnection: { include: { pages: true } },
    },
  });
  if (!business) notFound();

  const hasOwnInstagram = business.socialConnection?.pages.some((p) => p.instagramAccountId) ?? false;
  const country = detectCountry(business.location);
  const countryCode = country.code;
  const adCoverage = adLibraryCoverage(countryCode);
  const postById = new Map(
    business.competitors.flatMap((c) => c.posts.map((p) => [p.id, { post: p, competitor: c }] as const))
  );
  const totalPosts = postById.size;

  const batch = business.competitorIdeas[0] ?? null;
  let ideas: GeneratedCompetitorIdeas | null = null;
  if (batch) {
    try {
      ideas = JSON.parse(batch.content) as GeneratedCompetitorIdeas;
    } catch {
      ideas = null;
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <PageHeader
        backHref={`/business/${id}/ideas`}
        backLabel="Volver a Ideas"
        title="Competencia"
        description="Qué publica tu competencia y qué le funciona, con datos públicos reales. A partir de eso, ideas de video adaptadas a tu negocio."
      />

      {error && (
        <Notice tone="danger" className="mb-4">
          {error}
        </Notice>
      )}
      {ideasJustGenerated && (
        <Notice tone="success" className="mb-4">
          Listo: ideas nuevas generadas a partir de las publicaciones de tu competencia.
        </Notice>
      )}

      <Card className="p-4 text-sm">
        <p className="flex items-center gap-1.5 font-medium">
          <Info className="size-4" /> Qué datos podemos ver
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-muted">
          <li>
            <strong>Instagram (API oficial):</strong> seguidores y publicaciones recientes con me
            gusta y comentarios, solo de cuentas Business o Creator. No hay alcance ni vistas de
            cuentas ajenas.
            {!hasOwnInstagram && " Requiere que conectes tu propia cuenta de Instagram profesional."}
          </li>
          <li>
            <strong>TikTok, YouTube, Facebook y otras:</strong> no tienen una API oficial para ver la
            competencia. Registra a mano las publicaciones que te llamen la atención.
          </li>
          <li>
            <strong>Anuncios ({adCoverage.countryName}):</strong> enlazamos a la Biblioteca de
            anuncios pública de Meta, filtrada por {adCoverage.countryName}, donde ves los anuncios
            activos de cada competidor.{" "}
            {adCoverage.apiCoversCommercialAds
              ? "En la Unión Europea Meta también ofrece estos anuncios por API; lo activaremos cuando aprueben nuestro acceso."
              : `Fuera de la Unión Europea, la API de Meta solo entrega anuncios políticos o de temas sociales, no los comerciales; por eso no podemos traer aquí los anuncios de tu competencia en ${adCoverage.countryName} ni sus resultados (Meta no publica alcance ni gasto de anuncios comerciales).`}
            {!country.matched &&
              " No reconocimos el país en tu ubicación del Perfil; usamos Ecuador."}
            {" "}La búsqueda es por nombre: si no aparece, prueba con el nombre exacto de su página de Facebook.
          </li>
        </ul>
        <p className="mt-2 text-xs text-faint">Nunca usamos scraping ni accedemos a datos privados.</p>
      </Card>

      <form action={addCompetitor.bind(null, id)} className="mt-6 flex flex-wrap gap-2">
        <Input name="name" placeholder="Nombre del competidor" required className="min-w-40 flex-1" />
        <Input name="instagramUsername" placeholder="@usuario de Instagram (opcional)" className="min-w-40 flex-1" />
        <Button type="submit">Agregar</Button>
      </form>

      {business.competitors.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            icon={Eye}
            title="Todavía no agregas competidores"
            description="Agrega 2 o 3 negocios similares al tuyo para ver qué publican y qué les funciona."
          />
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {business.competitors.map((competitor) => {
            const stats = competitorStats(competitor.posts, competitor.followersCount);
            const apiPosts = competitor.posts.filter((p) => p.source === "instagram_api");
            const manualPosts = competitor.posts.filter((p) => p.source === "manual");
            return (
              <Card key={competitor.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{competitor.name}</p>
                    <p className="text-sm text-muted">
                      {competitor.instagramUsername ? (
                        <a
                          href={`https://www.instagram.com/${competitor.instagramUsername}/`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-brand hover:underline"
                        >
                          @{competitor.instagramUsername}
                        </a>
                      ) : (
                        "Sin usuario de Instagram"
                      )}
                      {competitor.followersCount != null &&
                        ` · ${nf.format(competitor.followersCount)} seguidores`}
                      {competitor.lastSyncedAt &&
                        ` · actualizado ${competitor.lastSyncedAt.toLocaleDateString("es")}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {competitor.instagramUsername && (
                      <form action={syncCompetitor.bind(null, id, competitor.id)}>
                        <Button type="submit" size="sm" variant="secondary">
                          <RefreshCw className="size-3.5" /> Actualizar
                        </Button>
                      </form>
                    )}
                    <form action={removeCompetitor.bind(null, id, competitor.id)}>
                      <Button type="submit" size="sm" variant="ghost">
                        Quitar
                      </Button>
                    </form>
                  </div>
                </div>

                {competitor.syncError && (
                  <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
                    {competitor.syncError}
                  </p>
                )}

                {stats.postCount > 0 && (
                  <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <Stat label="Publicaciones analizadas" value={String(stats.postCount)} />
                    <Stat
                      label="Frecuencia"
                      value={stats.postsPerWeek != null ? `${stats.postsPerWeek}/semana` : "—"}
                      hint={stats.windowDays != null ? `últimos ${stats.windowDays} días` : undefined}
                    />
                    <Stat
                      label="Interacciones promedio"
                      value={stats.avgInteractions != null ? nf.format(stats.avgInteractions) : "—"}
                      hint="me gusta + comentarios"
                    />
                    <Stat
                      label="Engagement"
                      value={stats.engagementRate != null ? `${stats.engagementRate}%` : "—"}
                      hint="por seguidor"
                    />
                  </div>
                )}

                {stats.formats.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {stats.formats.map((f) => (
                      <Badge key={f.format}>
                        {f.format}: {f.count}
                        {f.avgInteractions != null && ` · ${nf.format(f.avgInteractions)} int. prom.`}
                      </Badge>
                    ))}
                  </div>
                )}

                {stats.top.length > 0 && (
                  <div className="mt-4">
                    <p className="text-sm font-medium">Lo que mejor le funciona</p>
                    <ul className="mt-2 space-y-2">
                      {stats.top.map((p) => (
                        <PostRow key={p.id} post={competitor.posts.find((x) => x.id === p.id)!} />
                      ))}
                    </ul>
                  </div>
                )}

                {apiPosts.length === 0 && manualPosts.length === 0 && !competitor.syncError && (
                  <p className="mt-3 text-sm text-muted">
                    {competitor.instagramUsername
                      ? "Aún no leemos sus publicaciones. Pulsa Actualizar."
                      : "Agrega su usuario de Instagram o registra publicaciones a mano."}
                  </p>
                )}

                {manualPosts.length > 0 && (
                  <div className="mt-4">
                    <p className="text-sm font-medium">Registradas por ti</p>
                    <ul className="mt-2 space-y-2">
                      {manualPosts.map((p) => (
                        <PostRow
                          key={p.id}
                          post={p}
                          action={
                            <form action={removeManualPost.bind(null, id, p.id)}>
                              <button type="submit" className="text-xs text-muted hover:text-foreground">
                                Quitar
                              </button>
                            </form>
                          }
                        />
                      ))}
                    </ul>
                  </div>
                )}

                <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 border-t border-border pt-3 text-sm">
                  <details className="w-full">
                    <summary className="cursor-pointer text-brand">Registrar una publicación a mano</summary>
                    <form action={addManualPost.bind(null, id, competitor.id)} className="mt-3 space-y-2">
                      <Textarea name="caption" rows={3} placeholder="Texto de la publicación (cópialo y pégalo)" />
                      <Input name="notes" placeholder="Qué te llamó la atención (hook, formato, tema...)" />
                      <Input name="permalink" placeholder="Enlace a la publicación (opcional)" />
                      <div className="flex flex-wrap gap-2">
                        <Select name="mediaType" className="w-auto" defaultValue="">
                          <option value="">Formato</option>
                          <option value="REELS">Reel / video corto</option>
                          <option value="VIDEO">Video</option>
                          <option value="IMAGE">Imagen</option>
                          <option value="CAROUSEL_ALBUM">Carrusel</option>
                        </Select>
                        <Input name="likeCount" inputMode="numeric" placeholder="Me gusta" className="w-28" />
                        <Input name="commentsCount" inputMode="numeric" placeholder="Comentarios" className="w-28" />
                        <Button type="submit" size="sm">
                          Guardar
                        </Button>
                      </div>
                    </form>
                  </details>
                  <details className="w-full">
                    <summary className="cursor-pointer text-brand">
                      {competitor.instagramUsername ? "Cambiar usuario de Instagram" : "Agregar usuario de Instagram"}
                    </summary>
                    <form
                      action={updateCompetitorUsername.bind(null, id, competitor.id)}
                      className="mt-3 flex flex-wrap gap-2"
                    >
                      <Input
                        name="instagramUsername"
                        defaultValue={competitor.instagramUsername ?? ""}
                        placeholder="@usuario"
                        className="min-w-40 flex-1"
                      />
                      <Button type="submit" size="sm" variant="secondary">
                        Guardar
                      </Button>
                    </form>
                  </details>
                  <a
                    href={adLibraryWebUrl(competitor.name, countryCode)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-brand hover:underline"
                  >
                    Ver sus anuncios en la Biblioteca de Meta <ExternalLink className="size-3" />
                  </a>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <section className="mt-12">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Lightbulb className="size-5" /> Ideas de video basadas en tu competencia
          </h2>
          <form action={generateIdeasFromCompetitors.bind(null, id)}>
            <Button type="submit" size="sm" disabled={totalPosts < 2 || !business.aiProvider}>
              <Sparkles className="size-3.5" /> {ideas ? "Generar ideas nuevas" : "Generar ideas"}
            </Button>
          </form>
        </div>
        <p className="mt-1 text-sm text-muted">
          La IA analiza las publicaciones reales de arriba (hooks, temas, formatos, CTAs) y propone
          videos para tu negocio. Cada idea cita las publicaciones en las que se basa.
          {totalPosts < 2 && " Necesitas al menos 2 publicaciones de la competencia."}
          {!business.aiProvider && " Configura tu proveedor de IA primero."}
        </p>

        {ideas && batch && (
          <div className="mt-4 space-y-6">
            {ideas.patrones.length > 0 && (
              <div>
                <p className="text-sm font-medium">Patrones que se repiten</p>
                <ul className="mt-2 space-y-2 text-sm">
                  {ideas.patrones.map((p, i) => (
                    <li key={i}>
                      <Badge tone="brand" className="mr-2">
                        {p.tipo}
                      </Badge>
                      {p.descripcion} <Evidence ids={p.evidencia} postById={postById} />
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {ideas.oportunidades.length > 0 && (
              <div>
                <p className="text-sm font-medium">Oportunidades para diferenciarte</p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">
                  {ideas.oportunidades.map((o, i) => (
                    <li key={i}>{o}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="space-y-3">
              {ideas.ideas.map((idea, i) => (
                <Card key={i} className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-muted">
                        {purposeLabel(idea.proposito)} · {idea.formato}
                      </p>
                      <p className="mt-1 font-medium">{idea.titulo}</p>
                    </div>
                    <form action={createPieceFromIdea.bind(null, id, batch.id, i)}>
                      <Button type="submit" size="sm">
                        Crear guion
                      </Button>
                    </form>
                  </div>
                  <p className="mt-2 text-sm">
                    <span className="font-medium">Hook: </span>“{idea.hook}”
                  </p>
                  <p className="mt-1 text-sm text-muted">{idea.concepto}</p>
                  <p className="mt-1 text-sm text-muted">
                    <span className="font-medium text-foreground">Por qué: </span>
                    {idea.porQue} <Evidence ids={idea.referencias} postById={postById} />
                  </p>
                  {idea.cta && (
                    <p className="mt-1 text-sm text-muted">
                      <span className="font-medium text-foreground">CTA: </span>
                      {idea.cta}
                    </p>
                  )}
                </Card>
              ))}
            </div>
            <p className="text-xs text-faint">
              Generado el {batch.createdAt.toLocaleString("es")} con {batch.provider} ({batch.model}).
            </p>
          </div>
        )}
      </section>
    </main>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-md border border-border p-2.5">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-0.5 font-semibold">{value}</p>
      {hint && <p className="text-xs text-faint">{hint}</p>}
    </div>
  );
}

function PostRow({ post, action }: { post: CompetitorPost; action?: React.ReactNode }) {
  const total = interactions(post);
  const text = post.caption || post.notes || "(sin texto)";
  return (
    <li className="rounded-md border border-border p-2.5 text-sm">
      <div className="flex items-start justify-between gap-2">
        <p className="line-clamp-2 min-w-0 flex-1">{text}</p>
        {action}
      </div>
      <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-muted">
        <span>{formatLabel(post.mediaType)}</span>
        {post.likeCount != null && <span>{nf.format(post.likeCount)} me gusta</span>}
        {post.commentsCount != null && <span>{nf.format(post.commentsCount)} comentarios</span>}
        {total == null && <span>sin métricas</span>}
        {post.postedAt && <span>{post.postedAt.toLocaleDateString("es")}</span>}
        <span>{post.source === "manual" ? "registrado por ti" : "Instagram"}</span>
        {post.permalink && (
          <a
            href={post.permalink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-0.5 text-brand hover:underline"
          >
            ver <ExternalLink className="size-3" />
          </a>
        )}
      </p>
      {post.caption && post.notes && <p className="mt-1 text-xs text-muted">Nota: {post.notes}</p>}
    </li>
  );
}

function Evidence({
  ids,
  postById,
}: {
  ids: string[];
  postById: Map<string, { post: CompetitorPost; competitor: { name: string; instagramUsername: string | null } }>;
}) {
  const found = ids.map((pid) => postById.get(pid)).filter((x) => x !== undefined);
  if (found.length === 0) return null;
  return (
    <span className="text-xs text-faint">
      (fuente:{" "}
      {found.map(({ post, competitor }, i) => (
        <span key={post.id}>
          {i > 0 && ", "}
          {post.permalink ? (
            <a href={post.permalink} target="_blank" rel="noopener noreferrer" className="text-brand hover:underline">
              {competitor.instagramUsername ? `@${competitor.instagramUsername}` : competitor.name}
            </a>
          ) : (
            competitor.instagramUsername ? `@${competitor.instagramUsername}` : competitor.name
          )}
        </span>
      ))}
      )
    </span>
  );
}
