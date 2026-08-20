import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { OBJECTIVES } from "@/lib/constants";
import { generateInsights, type Insight } from "@/lib/insights";
import { getPageActivity, type PageActivity } from "@/lib/pageActivity";
import { generateRealInsights } from "@/lib/realInsights";
import { disconnectMeta, refreshPages, createCampaign } from "./actions";

export default async function BusinessProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ connected?: string; meta_error?: string; campaign_error?: string }>;
}) {
  const { id } = await params;
  const { connected, meta_error: metaError, campaign_error: campaignError } = await searchParams;

  const business = await prisma.business.findUnique({
    where: { id },
    include: {
      products: true,
      socialConnection: { include: { pages: true } },
      campaigns: { orderBy: { createdAt: "desc" } },
      videoAssets: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!business) {
    notFound();
  }

  const objectiveLabel =
    OBJECTIVES.find((o) => o.value === business.objective)?.label ??
    business.objective;

  const pageActivity = business.socialConnection
    ? await getPageActivity(business.socialConnection.pages)
    : [];
  const realInsights = generateRealInsights(pageActivity, business.products);
  const usingRealInsights = realInsights.length > 0;
  const insights = usingRealInsights ? realInsights : generateInsights(business);

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
        {business.industry} · {business.location}
      </p>
      <h1 className="mt-1 text-2xl font-semibold">{business.name}</h1>

      {connected === "1" && (
        <p className="mt-4 rounded-md bg-green-50 px-4 py-3 text-sm text-green-700 dark:bg-green-950 dark:text-green-300">
          Conectaste tu cuenta de Meta correctamente.
        </p>
      )}
      {metaError && (
        <p className="mt-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          No se pudo conectar con Meta: {metaError}
        </p>
      )}
      {campaignError && (
        <p className="mt-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          No se pudo crear la campaña: {campaignError}
        </p>
      )}

      <ConnectionCard business={business} />
      <AiSettingsCard businessId={business.id} provider={business.aiProvider} />

      {pageActivity.length > 0 && <PageActivitySection activity={pageActivity} />}

      <section className="mt-10">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">🧠 Tu negocio esta semana</h2>
          {usingRealInsights ? (
            <span className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-800 dark:bg-green-900/40 dark:text-green-300">
              Datos en vivo
            </span>
          ) : (
            <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
              Vista previa
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          {usingRealInsights
            ? "Generado a partir de la actividad real de tus páginas conectadas."
            : "Estos son ejemplos ilustrativos generados a partir de tu perfil. Conecta Facebook/Instagram para que la IA analice datos reales cada semana."}
        </p>

        <div className="mt-6 space-y-4">
          {insights.map((insight) => (
            <InsightCard
              key={insight.title + insight.description}
              insight={insight}
              businessId={business.id}
              aiConfigured={business.aiProvider != null}
            />
          ))}
        </div>
      </section>

      {business.campaigns.length > 0 && (
        <section className="mt-14">
          <h2 className="text-lg font-semibold">📣 Campañas</h2>
          <ul className="mt-3 divide-y divide-neutral-200 dark:divide-neutral-800">
            {business.campaigns.map((campaign) => (
              <li key={campaign.id}>
                <Link
                  href={`/business/${business.id}/campaigns/${campaign.id}`}
                  className="flex items-center justify-between py-3 hover:text-neutral-500"
                >
                  <span className="font-medium">{campaign.title}</span>
                  <span className="text-sm text-neutral-500 dark:text-neutral-400">
                    {new Date(campaign.createdAt).toLocaleDateString()}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-14">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">🎬 Videos</h2>
          <Link
            href={`/business/${business.id}/videos/upload`}
            className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
          >
            Subir video
          </Link>
        </div>
        {business.videoAssets.length > 0 && (
          <ul className="mt-3 divide-y divide-neutral-200 dark:divide-neutral-800">
            {business.videoAssets.map((video) => (
              <li key={video.id}>
                <Link
                  href={`/business/${business.id}/videos/${video.id}`}
                  className="flex items-center justify-between py-3 hover:text-neutral-500"
                >
                  <span className="font-medium">{video.originalFilename}</span>
                  <span className="text-sm text-neutral-500 dark:text-neutral-400">{video.status}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-14 space-y-6 border-t border-neutral-200 pt-10 dark:border-neutral-800">
        <h2 className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
          Perfil de negocio
        </h2>
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
          <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
            Productos / servicios
          </p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {business.products.map((product) => (
              <li
                key={product.id}
                className="rounded-full border border-neutral-300 px-3 py-1 text-sm dark:border-neutral-700"
              >
                {product.name}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <Link
        href="/onboarding"
        className="mt-8 inline-block text-sm text-neutral-500 underline hover:text-neutral-800 dark:hover:text-neutral-200"
      >
        + Agregar otro negocio
      </Link>
    </main>
  );
}

const AI_PROVIDER_LABEL: Record<string, string> = {
  anthropic: "Anthropic (Claude)",
  openai: "OpenAI (GPT)",
};

function AiSettingsCard({
  businessId,
  provider,
}: {
  businessId: string;
  provider: string | null;
}) {
  return (
    <div className="mt-4 flex items-center justify-between gap-4 rounded-lg border border-neutral-200 p-5 dark:border-neutral-800">
      <div>
        <p className="font-medium">
          {provider ? `✅ IA: ${AI_PROVIDER_LABEL[provider] ?? provider}` : "Configura tu proveedor de IA"}
        </p>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          {provider
            ? "Usado para generar campañas y contenido."
            : "Necesario para generar campañas y contenido con tu propia API key."}
        </p>
      </div>
      <Link
        href={`/business/${businessId}/settings`}
        className="shrink-0 rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
      >
        {provider ? "Editar" : "Configurar"}
      </Link>
    </div>
  );
}

function ConnectionCard({
  business,
}: {
  business: {
    id: string;
    socialConnection: {
      metaUserName: string;
      pages: {
        id: string;
        name: string;
        instagramUsername: string | null;
      }[];
    } | null;
  };
}) {
  if (!business.socialConnection) {
    return (
      <div className="mt-6 flex items-center justify-between gap-4 rounded-lg border border-neutral-200 p-5 dark:border-neutral-800">
        <div>
          <p className="font-medium">Conecta Facebook e Instagram</p>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            Necesario para que la IA empiece a analizar tus datos reales.
          </p>
        </div>
        <a
          href={`/api/auth/meta/start?businessId=${business.id}`}
          className="shrink-0 rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
        >
          Conectar
        </a>
      </div>
    );
  }

  const { pages, metaUserName } = business.socialConnection;

  return (
    <div className="mt-6 rounded-lg border border-neutral-200 p-5 dark:border-neutral-800">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="font-medium">✅ Conectado como {metaUserName}</p>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            {pages.length === 0
              ? "No encontramos páginas de Facebook administradas por esta cuenta."
              : `${pages.length} página(s) conectada(s).`}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <form action={refreshPages.bind(null, business.id)}>
            <button
              type="submit"
              className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
            >
              Actualizar páginas
            </button>
          </form>
          <form action={disconnectMeta.bind(null, business.id)}>
            <button
              type="submit"
              className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
            >
              Desconectar
            </button>
          </form>
        </div>
      </div>
      {pages.length > 0 && (
        <ul className="mt-4 space-y-1">
          {pages.map((page) => (
            <li key={page.id} className="text-sm">
              {page.name}
              {page.instagramUsername && (
                <span className="text-neutral-500 dark:text-neutral-400">
                  {" "}
                  · @{page.instagramUsername}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PageActivitySection({ activity }: { activity: PageActivity[] }) {
  return (
    <section className="mt-10">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">📊 Actividad real de tus páginas</h2>
        <span className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-800 dark:bg-green-900/40 dark:text-green-300">
          Datos en vivo
        </span>
      </div>
      <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
        Los likes y comentarios de Facebook requieren que tu app complete la
        revisión de Meta (App Review); por ahora mostramos el contenido
        publicado y las veces compartido. Instagram sí incluye likes y
        comentarios reales.
      </p>

      <div className="mt-4 space-y-4">
        {activity.map((page) => {
          const latestPost = page.posts[0];
          return (
            <div key={page.pageId} className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
              <p className="text-sm font-medium">{page.pageName}</p>

              {page.error && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{page.error}</p>
              )}

              {!page.error && !latestPost && (
                <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                  Esta página aún no tiene publicaciones.
                </p>
              )}

              {!page.error && latestPost && (
                <div className="mt-2">
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    Última publicación · {new Date(latestPost.createdTime).toLocaleDateString()}
                  </p>
                  {latestPost.message && (
                    <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                      &ldquo;{latestPost.message.slice(0, 160)}
                      {latestPost.message.length > 160 ? "…" : ""}&rdquo;
                    </p>
                  )}
                  <p className="mt-1 text-sm">🔁 {latestPost.shares} compartidos</p>
                  {latestPost.permalinkUrl && (
                    <a
                      href={latestPost.permalinkUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-block text-sm underline text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
                    >
                      Ver publicación
                    </a>
                  )}
                </div>
              )}

              {page.instagram && (
                <div className="mt-3 border-t border-neutral-200 pt-3 dark:border-neutral-800">
                  <p className="text-sm font-medium">📷 Instagram @{page.instagram.username}</p>
                  {page.instagram.error && (
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">{page.instagram.error}</p>
                  )}
                  {!page.instagram.error && (
                    <>
                      <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                        {page.instagram.followersCount != null && `${page.instagram.followersCount} seguidores`}
                        {page.instagram.followersCount != null && page.instagram.mediaCount != null && " · "}
                        {page.instagram.mediaCount != null && `${page.instagram.mediaCount} publicaciones`}
                      </p>
                      {page.instagram.posts[0] && (
                        <div className="mt-2">
                          {page.instagram.posts[0].caption && (
                            <p className="text-sm text-neutral-600 dark:text-neutral-400">
                              &ldquo;{page.instagram.posts[0].caption.slice(0, 160)}
                              {page.instagram.posts[0].caption.length > 160 ? "…" : ""}&rdquo;
                            </p>
                          )}
                          <p className="mt-1 text-sm">
                            ❤️ {page.instagram.posts[0].likes} · 💬 {page.instagram.posts[0].comments}
                          </p>
                          {page.instagram.posts[0].permalinkUrl && (
                            <a
                              href={page.instagram.posts[0].permalinkUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-1 inline-block text-sm underline text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
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
            </div>
          );
        })}
      </div>
    </section>
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
    <div className="rounded-lg border border-neutral-200 p-5 dark:border-neutral-800">
      <div className="flex items-start justify-between gap-4">
        <p className="font-medium">
          {insight.emoji} {insight.title}
        </p>
        {insight.potential && (
          <span className="shrink-0 rounded-full border border-neutral-300 px-2.5 py-0.5 text-xs text-neutral-600 dark:border-neutral-700 dark:text-neutral-400">
            Potencial: {insight.potential}
          </span>
        )}
      </div>
      <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
        {insight.description}
      </p>
      {insight.recommendation && (
        <p className="mt-2 text-sm">
          <span className="font-medium">Recomendación: </span>
          {insight.recommendation}
        </p>
      )}
      {insight.actionLabel &&
        (aiConfigured ? (
          <form action={createCampaign.bind(null, businessId, insight.title, insightSummary)}>
            <button
              type="submit"
              className="mt-3 rounded-md bg-black px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
            >
              {insight.actionLabel}
            </button>
          </form>
        ) : (
          <Link
            href={`/business/${businessId}/settings`}
            className="mt-3 inline-block rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
          >
            Configura tu IA para generar
          </Link>
        ))}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
        {label}
      </p>
      <p className="mt-1">{value}</p>
    </div>
  );
}
