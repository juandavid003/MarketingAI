import Link from "next/link";
import { Target, CheckCircle2, Camera, Repeat2, Heart, MessageCircle } from "lucide-react";
import type { Insight } from "@/lib/insights";
import type { PageActivity } from "@/lib/pageActivity";
import type { AdAccount } from "@/lib/meta";
import { PURPOSES } from "@/lib/contentAi";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button, LinkButton } from "@/components/ui/Button";
import { Select, Textarea } from "@/components/ui/Field";
import {
  disconnectMeta,
  refreshPages,
  createCampaign,
  createCampaignFromObjective,
} from "@/app/(app)/business/[id]/actions";
import { createPieceFromBrief } from "@/app/(app)/business/[id]/content-actions";
import { connectAdAccount } from "@/app/(app)/business/[id]/ads-actions";

// Building blocks shared by the business module pages (Resumen, Ideas,
// Copywriter, Conexiones, Resultados).

export function Notice({ tone, children }: { tone: "success" | "danger"; children: React.ReactNode }) {
  const toneClasses =
    tone === "success"
      ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
      : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300";
  return <p className={`rounded-md px-4 py-3 text-sm ${toneClasses}`}>{children}</p>;
}

export function Section({
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

export function GoalCampaignForm({
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

export function AiSettingsCard({
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

export function ConnectionCard({
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

export function AdAccountCard({
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

export function CompetitorSummary({
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

export function PieceBriefForm({ businessId, aiConfigured }: { businessId: string; aiConfigured: boolean }) {
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

export function PageActivitySection({ activity }: { activity: PageActivity[] }) {
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

export function InsightCard({
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

export function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-sm font-medium text-muted">{label}</p>
      <p className="mt-1">{value}</p>
    </div>
  );
}
