import { notFound } from "next/navigation";
import Link from "next/link";
import {
  Brain,
  Target,
  Megaphone,
  Clapperboard,
  Eye,
  BarChart3,
  CheckCircle2,
  Camera,
  Repeat2,
  Heart,
  MessageCircle,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireBusinessAccess } from "@/lib/dal";
import { ADS_ENABLED } from "@/lib/features";
import { decryptToken } from "@/lib/crypto";
import { OBJECTIVES } from "@/lib/constants";
import type { Insight } from "@/lib/insights";
import { getPageActivity, type PageActivity } from "@/lib/pageActivity";
import { generateRealInsights } from "@/lib/realInsights";
import { profileCompleteness } from "@/lib/profileCompleteness";
import { fetchAdAccounts, type AdAccount } from "@/lib/meta";
import { purposeLabel, PURPOSES } from "@/lib/contentAi";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button, LinkButton } from "@/components/ui/Button";
import { Select, Textarea } from "@/components/ui/Field";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  disconnectMeta,
  refreshPages,
  createCampaign,
  createCampaignFromObjective,
} from "./actions";
import { createPieceFromBrief } from "./content-actions";
import { connectAdAccount } from "./ads-actions";

export default async function BusinessProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    connected?: string;
    meta_error?: string;
    campaign_error?: string;
    ad_error?: string;
    error?: string;
  }>;
}) {
  const { id } = await params;
  const {
    connected,
    meta_error: metaError,
    campaign_error: campaignError,
    ad_error: adError,
    error: pieceError,
  } = await searchParams;

  await requireBusinessAccess(id);

  const business = await prisma.business.findUnique({
    where: { id },
    include: {
      products: true,
      socialConnection: { include: { pages: true, adAccount: true } },
      campaigns: { orderBy: { createdAt: "desc" } },
      videoAssets: { orderBy: { createdAt: "desc" } },
      competitors: { orderBy: { createdAt: "asc" }, include: { _count: { select: { posts: true } } } },
      contentPieces: {
        orderBy: { createdAt: "desc" },
        take: 20,
        include: { takes: { select: { status: true } }, _count: { select: { videoAssets: true } } },
      },
    },
  });

  if (!business) {
    notFound();
  }

  let availableAdAccounts: AdAccount[] = [];
  let adAccountsError: string | null = null;
  if (ADS_ENABLED && business.socialConnection && !business.socialConnection.adAccount) {
    try {
      availableAdAccounts = await fetchAdAccounts(decryptToken(business.socialConnection.accessToken));
    } catch (err) {
      adAccountsError =
        err instanceof Error ? err.message : "No se pudieron leer las cuentas publicitarias.";
    }
  }

  const objectiveLabel =
    OBJECTIVES.find((o) => o.value === business.objective)?.label ?? business.objective;

  const pageActivity = business.socialConnection
    ? await getPageActivity(business.socialConnection.pages)
    : [];
  const insights = generateRealInsights(pageActivity, business.products);
  const profile = profileCompleteness(business);

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <p className="text-sm font-medium text-muted">
        {business.industry} · {business.location}
      </p>
      <h1 className="mt-1 text-2xl font-semibold">{business.name}</h1>

      <div className="mt-4 space-y-2">
        {connected === "1" && <Notice tone="success">Conectaste tu cuenta de Meta correctamente.</Notice>}
        {metaError && <Notice tone="danger">No se pudo conectar con Meta: {metaError}</Notice>}
        {campaignError && <Notice tone="danger">No se pudo crear la campaña: {campaignError}</Notice>}
        {adError && <Notice tone="danger">{adError}</Notice>}
        {pieceError && <Notice tone="danger">{pieceError}</Notice>}
      </div>

      <div className="mt-8 space-y-4">
        <ConnectionCard business={business} />

        {ADS_ENABLED && business.socialConnection && (
          <AdAccountCard
            businessId={business.id}
            adAccount={business.socialConnection.adAccount}
            availableAccounts={availableAdAccounts}
            error={adAccountsError}
          />
        )}

        <AiSettingsCard businessId={business.id} provider={business.aiProvider} />
      </div>

      {pageActivity.length > 0 && (
        <Section icon={BarChart3} title="Actividad real de tus páginas" className="mt-10">
          <Badge tone="success" className="mb-1">
            Datos en vivo
          </Badge>
          <p className="text-sm text-muted">
            Los likes y comentarios de Facebook requieren que tu app complete la revisión de Meta
            (App Review); por ahora mostramos el contenido publicado y las veces compartido.
            Instagram sí incluye likes y comentarios reales.
          </p>
          <PageActivitySection activity={pageActivity} />
        </Section>
      )}

      <Section icon={Target} title="¿Qué quieres lograr?" className="mt-10">
        <p className="text-sm text-muted">
          Dile a la IA tu objetivo y te propone una campaña completa, sin esperar a que detecte
          una oportunidad.
        </p>
        <GoalCampaignForm businessId={business.id} aiConfigured={business.aiProvider != null} />
      </Section>

      <Section
        icon={Brain}
        title="Tu negocio esta semana"
        className="mt-10"
        badge={insights.length > 0 ? <Badge tone="success">Datos en vivo</Badge> : undefined}
      >
        {insights.length > 0 ? (
          <>
            <p className="text-sm text-muted">
              Generado a partir de la actividad real de tus páginas conectadas.
            </p>
            <div className="mt-4 space-y-4">
              {insights.map((insight) => (
                <InsightCard
                  key={insight.title + insight.description}
                  insight={insight}
                  businessId={business.id}
                  aiConfigured={business.aiProvider != null}
                />
              ))}
            </div>
          </>
        ) : (
          <EmptyState
            icon={Brain}
            title={
              business.socialConnection
                ? "Todavía no hay suficientes datos para detectar oportunidades"
                : "Conecta Facebook/Instagram para detectar oportunidades reales"
            }
            description={
              business.socialConnection
                ? "Analizamos tus publicaciones reales: cuando tengas actividad reciente en tus páginas conectadas, aquí verás qué repetir y qué mejorar. Mientras tanto, puedes pedir una campaña desde tu objetivo."
                : "Solo mostramos oportunidades basadas en tus datos reales — nunca cifras de ejemplo. Mientras tanto, puedes pedir una campaña desde tu objetivo."
            }
          />
        )}
      </Section>

      <Section
        icon={Eye}
        title="Competencia"
        className="mt-10"
        actions={
          <LinkButton href={`/business/${business.id}/competitors`} variant="secondary" size="sm">
            Ver competencia
          </LinkButton>
        }
      >
        <CompetitorSummary businessId={business.id} competitors={business.competitors} />
      </Section>

      <Section icon={Clapperboard} title="Guiones y videos" className="mt-10">
        <p className="text-sm text-muted">
          Cada guion trae hook, escenas (qué mostrar, qué decir y cómo grabarlo), descripción,
          hashtags y CTAs. Graba cada escena, súbela y armamos el video final.
        </p>
        <PieceBriefForm businessId={business.id} aiConfigured={business.aiProvider != null} />
        {business.contentPieces.length > 0 && (
          <ul className="mt-4 divide-y divide-border">
            {business.contentPieces.map((piece) => {
              const ready = piece.takes.filter((t) => t.status === "ready").length;
              return (
                <li key={piece.id}>
                  <Link
                    href={`/business/${business.id}/pieces/${piece.id}`}
                    className="flex items-center justify-between gap-3 py-3 hover:text-brand"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium">“{piece.hook}”</span>
                      <span className="text-xs text-muted">
                        {purposeLabel(piece.purpose)} · {piece.format}
                      </span>
                    </span>
                    <span className="shrink-0 text-sm text-muted">
                      {piece._count.videoAssets > 0
                        ? "Video armado"
                        : ready > 0
                          ? `${ready} tomas subidas`
                          : "Por grabar"}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      <Section icon={Megaphone} title="Campañas" className="mt-10">
        {business.campaigns.length === 0 ? (
          <EmptyState icon={Megaphone} title="Todavía no tienes campañas" />
        ) : (
          <ul className="divide-y divide-border">
            {business.campaigns.map((campaign) => (
              <li key={campaign.id}>
                <Link
                  href={`/business/${business.id}/campaigns/${campaign.id}`}
                  className="flex items-center justify-between py-3 hover:text-brand"
                >
                  <span className="font-medium">{campaign.title}</span>
                  <span className="text-sm text-muted">
                    {new Date(campaign.createdAt).toLocaleDateString()}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section
        icon={Clapperboard}
        title="Videos"
        className="mt-10"
        actions={
          <LinkButton href={`/business/${business.id}/videos/upload`} variant="secondary" size="sm">
            Subir video
          </LinkButton>
        }
      >
        {business.videoAssets.length === 0 ? (
          <EmptyState icon={Clapperboard} title="Todavía no subes videos" />
        ) : (
          <ul className="divide-y divide-border">
            {business.videoAssets.map((video) => (
              <li key={video.id}>
                <Link
                  href={`/business/${business.id}/videos/${video.id}`}
                  className="flex items-center justify-between py-3 hover:text-brand"
                >
                  <span className="font-medium">{video.originalFilename}</span>
                  <span className="text-sm text-muted">{video.status}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <section className="mt-14 space-y-6 border-t border-border pt-10">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-medium text-muted">
            Perfil de negocio · completo al {profile.percent}%
          </h2>
          <LinkButton href={`/business/${business.id}/profile`} variant="secondary" size="sm">
            Editar perfil
          </LinkButton>
        </div>
        {profile.missing.length > 0 && (
          <p className="text-sm text-muted">
            Completa {profile.missing.slice(0, 3).join(", ").toLowerCase()}
            {profile.missing.length > 3 ? " y más" : ""} para que la IA personalice mejor tu
            contenido.
          </p>
        )}
        <Detail label="¿Qué vende?" value={business.description} />
        <Detail label="Audiencia objetivo" value={business.targetAudience} />
        <Detail label="Objetivo principal" value={objectiveLabel} />
        {business.avgTicket != null && (
          <Detail
            label="Ticket promedio"
            value={business.avgTicket.toLocaleString(undefined, {
              style: "currency",
              currency: "USD",
            })}
          />
        )}
        <div>
          <p className="text-sm font-medium text-muted">Productos / servicios</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {business.products.map((product) => (
              <li key={product.id} className="rounded-full border border-border px-3 py-1 text-sm">
                {product.name}
              </li>
            ))}
          </ul>
        </div>
      </section>
    </main>
  );
}

function Notice({ tone, children }: { tone: "success" | "danger"; children: React.ReactNode }) {
  const toneClasses =
    tone === "success"
      ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
      : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300";
  return <p className={`rounded-md px-4 py-3 text-sm ${toneClasses}`}>{children}</p>;
}

function Section({
  icon: Icon,
  title,
  badge,
  actions,
  className,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={className}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Icon className="size-5 text-brand" />
          <h2 className="text-lg font-semibold">{title}</h2>
          {badge}
        </div>
        {actions}
      </div>
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}

const AI_PROVIDER_LABEL: Record<string, string> = {
  anthropic: "Anthropic (Claude)",
  openai: "OpenAI (GPT)",
};

function GoalCampaignForm({
  businessId,
  aiConfigured,
}: {
  businessId: string;
  aiConfigured: boolean;
}) {
  if (!aiConfigured) {
    return (
      <Link href={`/business/${businessId}/settings`} className="inline-block text-sm text-brand hover:underline">
        Configura tu IA para usar esta función →
      </Link>
    );
  }

  return (
    <form action={createCampaignFromObjective.bind(null, businessId)} className="space-y-3">
      <Textarea
        name="goal"
        required
        rows={2}
        placeholder="Ej. Quiero vender más blanqueamientos este mes"
      />
      <Button type="submit">Crear campaña</Button>
    </form>
  );
}

function AiSettingsCard({
  businessId,
  provider,
}: {
  businessId: string;
  provider: string | null;
}) {
  return (
    <Card className="flex items-center justify-between gap-4">
      <div>
        <p className="flex items-center gap-1.5 font-medium">
          {provider && <CheckCircle2 className="size-4 text-green-600 dark:text-green-400" />}
          {provider ? `IA: ${AI_PROVIDER_LABEL[provider] ?? provider}` : "Configura tu proveedor de IA"}
        </p>
        <p className="mt-1 text-sm text-muted">
          {provider
            ? "Usado para generar campañas y contenido."
            : "Necesario para generar campañas y contenido con tu propia API key."}
        </p>
      </div>
      <LinkButton href={`/business/${businessId}/settings`} variant="secondary" size="sm" className="shrink-0">
        {provider ? "Editar" : "Configurar"}
      </LinkButton>
    </Card>
  );
}

function ConnectionCard({
  business,
}: {
  business: {
    id: string;
    socialConnection: {
      metaUserName: string;
      pages: { id: string; name: string; instagramUsername: string | null }[];
    } | null;
  };
}) {
  if (!business.socialConnection) {
    return (
      <Card className="flex items-center justify-between gap-4">
        <div>
          <p className="font-medium">Conecta Facebook e Instagram</p>
          <p className="mt-1 text-sm text-muted">
            Necesario para que la IA empiece a analizar tus datos reales.
          </p>
        </div>
        <LinkButton href={`/api/auth/meta/start?businessId=${business.id}`} size="sm" className="shrink-0">
          Conectar
        </LinkButton>
      </Card>
    );
  }

  const { pages, metaUserName } = business.socialConnection;

  return (
    <Card>
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="flex items-center gap-1.5 font-medium">
            <CheckCircle2 className="size-4 text-green-600 dark:text-green-400" />
            Conectado como {metaUserName}
          </p>
          <p className="mt-1 text-sm text-muted">
            {pages.length === 0
              ? "No encontramos páginas de Facebook administradas por esta cuenta."
              : `${pages.length} página(s) conectada(s).`}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <form action={refreshPages.bind(null, business.id)}>
            <Button type="submit" variant="secondary" size="sm">
              Actualizar
            </Button>
          </form>
          <form action={disconnectMeta.bind(null, business.id)}>
            <Button type="submit" variant="secondary" size="sm">
              Desconectar
            </Button>
          </form>
        </div>
      </div>
      {pages.length > 0 && (
        <ul className="mt-4 space-y-1">
          {pages.map((page) => (
            <li key={page.id} className="text-sm">
              {page.name}
              {page.instagramUsername && <span className="text-muted"> · @{page.instagramUsername}</span>}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function AdAccountCard({
  businessId,
  adAccount,
  availableAccounts,
  error,
}: {
  businessId: string;
  adAccount: { adAccountId: string; name: string; currency: string } | null;
  availableAccounts: AdAccount[];
  error: string | null;
}) {
  if (adAccount) {
    return (
      <Card>
        <p className="flex items-center gap-1.5 font-medium">
          <Target className="size-4 text-brand" />
          Cuenta publicitaria: {adAccount.name}
        </p>
        <p className="mt-1 text-sm text-muted">
          Moneda: {adAccount.currency}. Las campañas que crees empiezan pausadas — tú decides
          cuándo activarlas.
        </p>
      </Card>
    );
  }

  return (
    <Card>
      <p className="font-medium">Conecta tu cuenta publicitaria de Meta</p>
      <p className="mt-1 text-sm text-muted">
        Necesario para poder pautar (con presupuesto) las publicaciones que ya funcionan bien.
      </p>

      {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}

      {!error && availableAccounts.length === 0 && (
        <p className="mt-2 text-sm text-muted">
          No encontramos cuentas publicitarias administradas por esta cuenta de Meta.
        </p>
      )}

      {availableAccounts.length > 0 && (
        <form action={connectAdAccount.bind(null, businessId)} className="mt-3 flex flex-wrap items-center gap-2">
          <Select name="adAccountId" required className="w-auto">
            {availableAccounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name} ({account.currency})
              </option>
            ))}
          </Select>
          <Button type="submit" size="sm">
            Conectar
          </Button>
        </form>
      )}
    </Card>
  );
}

function CompetitorSummary({
  businessId,
  competitors,
}: {
  businessId: string;
  competitors: { id: string; name: string; instagramUsername: string | null; _count: { posts: number } }[];
}) {
  if (competitors.length === 0) {
    return (
      <p className="text-sm text-muted">
        Agrega a tus competidores para ver qué publican, qué les funciona y recibir ideas de video
        basadas en eso.{" "}
        <Link href={`/business/${businessId}/competitors`} className="text-brand hover:underline">
          Agregar competidores →
        </Link>
      </p>
    );
  }
  return (
    <ul className="flex flex-wrap gap-2">
      {competitors.map((c) => (
        <li key={c.id} className="rounded-full border border-border px-3 py-1 text-sm">
          {c.name}
          {c.instagramUsername && <span className="text-muted"> @{c.instagramUsername}</span>}
          <span className="text-faint"> · {c._count.posts} publicaciones</span>
        </li>
      ))}
    </ul>
  );
}

function PieceBriefForm({ businessId, aiConfigured }: { businessId: string; aiConfigured: boolean }) {
  if (!aiConfigured) {
    return (
      <Link href={`/business/${businessId}/settings`} className="mt-3 inline-block text-sm text-brand hover:underline">
        Configura tu IA para generar guiones →
      </Link>
    );
  }
  return (
    <form action={createPieceFromBrief.bind(null, businessId)} className="mt-3 space-y-3">
      <Textarea
        name="brief"
        required
        rows={2}
        placeholder="¿Sobre qué quieres tu próximo video? Ej. Mostrar cómo es una primera visita"
      />
      <div className="flex flex-wrap items-center gap-2">
        <Select name="purpose" defaultValue="" className="w-auto">
          <option value="">Propósito: que la IA decida</option>
          {PURPOSES.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </Select>
        <Button type="submit">Generar guion</Button>
      </div>
    </form>
  );
}

function PageActivitySection({ activity }: { activity: PageActivity[] }) {
  return (
    <div className="space-y-4">
      {activity.map((page) => {
        const latestPost = page.posts[0];
        return (
          <Card key={page.pageId} className="p-4">
            <p className="text-sm font-medium">{page.pageName}</p>

            {page.error && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{page.error}</p>}

            {!page.error && !latestPost && (
              <p className="mt-1 text-sm text-muted">Esta página aún no tiene publicaciones.</p>
            )}

            {!page.error && latestPost && (
              <div className="mt-2">
                <p className="text-xs text-faint">
                  Última publicación · {new Date(latestPost.createdTime).toLocaleDateString()}
                </p>
                {latestPost.message && (
                  <p className="mt-1 text-sm text-muted">
                    &ldquo;{latestPost.message.slice(0, 160)}
                    {latestPost.message.length > 160 ? "…" : ""}&rdquo;
                  </p>
                )}
                <p className="mt-1 flex items-center gap-1 text-sm">
                  <Repeat2 className="size-4 text-faint" /> {latestPost.shares} compartidos
                </p>
                {latestPost.permalinkUrl && (
                  <a
                    href={latestPost.permalinkUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-block text-sm text-brand hover:underline"
                  >
                    Ver publicación
                  </a>
                )}
              </div>
            )}

            {page.instagram && (
              <div className="mt-3 border-t border-border pt-3">
                <p className="flex items-center gap-1.5 text-sm font-medium">
                  <Camera className="size-4 text-faint" /> @{page.instagram.username}
                </p>
                {page.instagram.error && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">{page.instagram.error}</p>
                )}
                {!page.instagram.error && (
                  <>
                    <p className="mt-1 text-xs text-faint">
                      {page.instagram.followersCount != null && `${page.instagram.followersCount} seguidores`}
                      {page.instagram.followersCount != null && page.instagram.mediaCount != null && " · "}
                      {page.instagram.mediaCount != null && `${page.instagram.mediaCount} publicaciones`}
                    </p>
                    {page.instagram.posts[0] && (
                      <div className="mt-2">
                        {page.instagram.posts[0].caption && (
                          <p className="text-sm text-muted">
                            &ldquo;{page.instagram.posts[0].caption.slice(0, 160)}
                            {page.instagram.posts[0].caption.length > 160 ? "…" : ""}&rdquo;
                          </p>
                        )}
                        <p className="mt-1 flex items-center gap-3 text-sm">
                          <span className="flex items-center gap-1">
                            <Heart className="size-4 text-faint" /> {page.instagram.posts[0].likes}
                          </span>
                          <span className="flex items-center gap-1">
                            <MessageCircle className="size-4 text-faint" /> {page.instagram.posts[0].comments}
                          </span>
                        </p>
                        {page.instagram.posts[0].permalinkUrl && (
                          <a
                            href={page.instagram.posts[0].permalinkUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-1 inline-block text-sm text-brand hover:underline"
                          >
                            Ver publicación
                          </a>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}

function InsightCard({
  insight,
  businessId,
  aiConfigured,
}: {
  insight: Insight;
  businessId: string;
  aiConfigured: boolean;
}) {
  const insightSummary = insight.recommendation
    ? `${insight.description} Recomendación: ${insight.recommendation}`
    : insight.description;

  return (
    <Card>
      <div className="flex items-start justify-between gap-4">
        <p className="font-medium">
          {insight.emoji} {insight.title}
        </p>
        {insight.potential && <Badge>Potencial: {insight.potential}</Badge>}
      </div>
      <p className="mt-2 text-sm text-muted">{insight.description}</p>
      {insight.recommendation && (
        <p className="mt-2 text-sm">
          <span className="font-medium">Recomendación: </span>
          {insight.recommendation}
        </p>
      )}
      {insight.actionLabel &&
        (aiConfigured ? (
          <form action={createCampaign.bind(null, businessId, insight.title, insightSummary)}>
            <Button type="submit" size="sm" className="mt-3">
              {insight.actionLabel}
            </Button>
          </form>
        ) : (
          <LinkButton href={`/business/${businessId}/settings`} variant="secondary" size="sm" className="mt-3">
            Configura tu IA para generar
          </LinkButton>
        ))}
    </Card>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-sm font-medium text-muted">{label}</p>
      <p className="mt-1">{value}</p>
    </div>
  );
}
