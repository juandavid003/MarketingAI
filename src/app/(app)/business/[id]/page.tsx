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
  ExternalLink,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireBusinessAccess } from "@/lib/dal";
import { ADS_ENABLED } from "@/lib/features";
import { OBJECTIVES } from "@/lib/constants";
import { generateInsights, type Insight } from "@/lib/insights";
import { getPageActivity, type PageActivity } from "@/lib/pageActivity";
import { generateRealInsights } from "@/lib/realInsights";
import { fetchAdAccounts, type AdAccount } from "@/lib/meta";
import { searchCompetitorAds, guessCountryCode, type AdLibraryAd } from "@/lib/adLibrary";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button, LinkButton } from "@/components/ui/Button";
import { Input, Select, Textarea } from "@/components/ui/Field";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  disconnectMeta,
  refreshPages,
  createCampaign,
  createCampaignFromObjective,
  addCompetitor,
  removeCompetitor,
} from "./actions";
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
  }>;
}) {
  const { id } = await params;
  const {
    connected,
    meta_error: metaError,
    campaign_error: campaignError,
    ad_error: adError,
  } = await searchParams;

  await requireBusinessAccess(id);

  const business = await prisma.business.findUnique({
    where: { id },
    include: {
      products: true,
      socialConnection: { include: { pages: true, adAccount: true } },
      campaigns: { orderBy: { createdAt: "desc" } },
      videoAssets: { orderBy: { createdAt: "desc" } },
      competitors: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!business) {
    notFound();
  }

  let availableAdAccounts: AdAccount[] = [];
  let adAccountsError: string | null = null;
  if (ADS_ENABLED && business.socialConnection && !business.socialConnection.adAccount) {
    try {
      availableAdAccounts = await fetchAdAccounts(business.socialConnection.accessToken);
    } catch (err) {
      adAccountsError =
        err instanceof Error ? err.message : "No se pudieron leer las cuentas publicitarias.";
    }
  }

  const competitorCountryCode = guessCountryCode(business.location);
  const competitorAds = new Map<string, { ads: AdLibraryAd[]; error: string | null }>();
  await Promise.all(
    business.competitors.map(async (competitor) => {
      try {
        const ads = await searchCompetitorAds(competitor.name, competitorCountryCode);
        competitorAds.set(competitor.id, { ads, error: null });
      } catch (err) {
        competitorAds.set(competitor.id, {
          ads: [],
          error: err instanceof Error ? err.message : "Error al consultar la Ad Library.",
        });
      }
    })
  );

  const objectiveLabel =
    OBJECTIVES.find((o) => o.value === business.objective)?.label ?? business.objective;

  const pageActivity = business.socialConnection
    ? await getPageActivity(business.socialConnection.pages)
    : [];
  const realInsights = generateRealInsights(pageActivity, business.products);
  const usingRealInsights = realInsights.length > 0;
  const insights = usingRealInsights ? realInsights : generateInsights(business);

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
        badge={
          <Badge tone={usingRealInsights ? "success" : "warning"}>
            {usingRealInsights ? "Datos en vivo" : "Vista previa"}
          </Badge>
        }
      >
        <p className="text-sm text-muted">
          {usingRealInsights
            ? "Generado a partir de la actividad real de tus páginas conectadas."
            : "Estos son ejemplos ilustrativos generados a partir de tu perfil. Conecta Facebook/Instagram para que la IA analice datos reales cada semana."}
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
      </Section>

      <Section icon={Eye} title="Competencia" className="mt-10">
        <p className="text-sm text-muted">
          Anuncios activos ahora mismo de negocios que agregues, según la Ad Library pública de
          Meta — no necesitamos acceso a sus cuentas.
        </p>
        <CompetitorSection
          businessId={business.id}
          competitors={business.competitors}
          competitorAds={competitorAds}
        />
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
        <h2 className="text-sm font-medium text-muted">Perfil de negocio</h2>
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

function CompetitorSection({
  businessId,
  competitors,
  competitorAds,
}: {
  businessId: string;
  competitors: { id: string; name: string }[];
  competitorAds: Map<string, { ads: AdLibraryAd[]; error: string | null }>;
}) {
  return (
    <div>
      <form action={addCompetitor.bind(null, businessId)} className="flex flex-wrap items-center gap-2">
        <Input
          type="text"
          name="name"
          required
          placeholder="Nombre del competidor (ej. Clínica Dental ABC)"
          className="w-64"
        />
        <Button type="submit" variant="secondary" size="sm">
          Agregar
        </Button>
      </form>

      {competitors.length === 0 ? (
        <p className="mt-4 text-sm text-muted">
          Agrega el nombre de un competidor para ver qué anuncios está pautando.
        </p>
      ) : (
        <div className="mt-4 space-y-4">
          {competitors.map((competitor) => {
            const result = competitorAds.get(competitor.id);
            return (
              <Card key={competitor.id} className="p-4">
                <div className="flex items-center justify-between gap-4">
                  <p className="font-medium">{competitor.name}</p>
                  <form action={removeCompetitor.bind(null, businessId, competitor.id)}>
                    <button type="submit" className="text-sm text-muted hover:text-foreground hover:underline">
                      Quitar
                    </button>
                  </form>
                </div>

                {result?.error && (
                  <p className="mt-2 text-sm text-red-600 dark:text-red-400">{result.error}</p>
                )}

                {!result?.error && result?.ads.length === 0 && (
                  <p className="mt-2 text-sm text-muted">No tiene anuncios activos por ahora.</p>
                )}

                {!result?.error && result && result.ads.length > 0 && (
                  <ul className="mt-2 space-y-2">
                    {result.ads.map((ad) => (
                      <li key={ad.id} className="text-sm">
                        {ad.bodies[0] && (
                          <p className="text-muted">
                            &ldquo;{ad.bodies[0].slice(0, 140)}
                            {ad.bodies[0].length > 140 ? "…" : ""}&rdquo;
                          </p>
                        )}
                        <div className="mt-0.5 flex items-center gap-2 text-xs text-faint">
                          {ad.startedAt && <span>Desde {new Date(ad.startedAt).toLocaleDateString()}</span>}
                          {ad.snapshotUrl && (
                            <a
                              href={ad.snapshotUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-0.5 hover:text-foreground hover:underline"
                            >
                              Ver anuncio <ExternalLink className="size-3" />
                            </a>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
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
