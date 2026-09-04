import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { prisma } from "@/lib/prisma";
import { requireBusinessAccess } from "@/lib/dal";
import type { GeneratedCampaign } from "@/lib/ai";
import { createStoryboard, createCampaignImage, publishCampaignImage } from "../../actions";
import { launchAdCampaign, activateAdCampaign, pauseAdCampaign, updateAdBudget } from "../../ads-actions";
import { fetchAdSetInsights, type AdSetInsights } from "@/lib/meta";
import {
  getCampaignPerformance,
  findPerformanceHighlight,
  type PublishedPostPerformance,
} from "@/lib/campaignPerformance";
import type { AdCampaign } from "@/generated/prisma/client";

export default async function CampaignPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; campaignId: string }>;
  searchParams: Promise<{
    storyboard_error?: string;
    image_error?: string;
    publish_error?: string;
    ad_error?: string;
  }>;
}) {
  const { id, campaignId } = await params;
  const {
    storyboard_error: storyboardError,
    image_error: imageError,
    publish_error: publishError,
    ad_error: adError,
  } = await searchParams;

  await requireBusinessAccess(id);

  const [campaign, business] = await Promise.all([
    prisma.campaign.findUnique({
      where: { id: campaignId },
      include: {
        storyboards: { orderBy: { createdAt: "desc" } },
        images: { orderBy: { createdAt: "desc" } },
        publishedPosts: { orderBy: { createdAt: "desc" } },
        adCampaigns: true,
      },
    }),
    prisma.business.findUnique({
      where: { id },
      include: { socialConnection: { include: { pages: true, adAccount: true } } },
    }),
  ]);

  if (!campaign || campaign.businessId !== id || !business) {
    notFound();
  }

  let content: GeneratedCampaign;
  try {
    content = JSON.parse(campaign.content) as GeneratedCampaign;
  } catch {
    notFound();
  }

  const storyboardByIndex = new Map(campaign.storyboards.map((sb) => [sb.contentIndex, sb]));
  const imageByIndex = new Map(campaign.images.map((img) => [img.contentIndex, img]));
  const publishedByIndex = new Map(campaign.publishedPosts.map((p) => [p.contentIndex, p]));
  const pages = business.socialConnection?.pages ?? [];

  const performance =
    campaign.publishedPosts.length > 0
      ? await getCampaignPerformance(campaign.publishedPosts, pages)
      : [];
  const performanceByIndex = new Map(performance.map((p) => [p.contentIndex, p]));
  const highlight = findPerformanceHighlight(performance);

  const adAccount = business.socialConnection?.adAccount ?? null;
  const adCampaignByIndex = new Map(campaign.adCampaigns.map((ac) => [ac.contentIndex, ac]));
  const activeAdCampaigns = campaign.adCampaigns.filter((ac) => ac.status === "active");
  const adInsightsById = new Map<string, AdSetInsights | null>();
  if (activeAdCampaigns.length > 0 && business.socialConnection) {
    const accessToken = business.socialConnection.accessToken;
    await Promise.all(
      activeAdCampaigns.map(async (ac) => {
        try {
          adInsightsById.set(ac.id, await fetchAdSetInsights(ac.metaAdSetId, accessToken));
        } catch {
          adInsightsById.set(ac.id, null);
        }
      })
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <Link
        href={`/business/${id}`}
        className="text-sm text-neutral-500 underline hover:text-neutral-800 dark:hover:text-neutral-200"
      >
        ← Volver al negocio
      </Link>

      <p className="mt-4 text-sm font-medium text-neutral-500 dark:text-neutral-400">
        Campaña generada · {campaign.provider} ({campaign.model})
      </p>
      <h1 className="mt-1 text-2xl font-semibold">🎯 {campaign.title}</h1>
      <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
        Basada en: {campaign.sourceInsight}
      </p>

      {storyboardError && (
        <p className="mt-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          No se pudo generar el guion: {storyboardError}
        </p>
      )}
      {imageError && (
        <p className="mt-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          No se pudo generar la imagen: {imageError}
        </p>
      )}
      {publishError && (
        <p className="mt-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          No se pudo publicar: {publishError}
        </p>
      )}
      {adError && (
        <p className="mt-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {adError}
        </p>
      )}

      {highlight && (
        <div className="mt-4 rounded-lg border border-neutral-200 p-5 dark:border-neutral-800">
          <p className="font-medium">🔥 Oportunidad</p>
          <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
            La pieza &ldquo;{content.contenido[highlight.best.contentIndex]?.hook}&rdquo; está funcionando{" "}
            {highlight.multiplier.toFixed(1)}× mejor que el resto de esta campaña (
            {highlight.best.shares} compartidos
            {highlight.best.likes != null && `, ${highlight.best.likes} likes`}
            {highlight.best.comments != null && `, ${highlight.best.comments} comentarios`}
            ).
          </p>
          <p className="mt-2 text-sm">
            <span className="font-medium">Recomendación: </span>
            Crea variantes basadas en ese patrón para el resto de la campaña.
          </p>
        </div>
      )}

      <div className="mt-8 space-y-6">
        <Section label="Objetivo" value={content.objetivo} />
        <Section label="Audiencia" value={content.audiencia} />
        <Section label="Concepto" value={content.concepto} />

        <div>
          <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400">Contenido</p>
          <div className="mt-2 space-y-3">
            {content.contenido.map((item, i) => {
              const storyboard = storyboardByIndex.get(i);
              const image = imageByIndex.get(i);
              const published = publishedByIndex.get(i);
              const piecePerformance = performanceByIndex.get(i);
              const adCampaign = adCampaignByIndex.get(i);
              return (
                <div key={i} className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
                  <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400">{item.formato}</p>
                  <p className="mt-1 text-sm">&ldquo;{item.hook}&rdquo;</p>

                  {image && (
                    <div className="mt-2">
                      <Image
                        src={image.imagePath}
                        alt={item.hook}
                        width={256}
                        height={384}
                        className="w-40 rounded-md border border-neutral-200 dark:border-neutral-800"
                      />
                      {image.provider === "placeholder" && (
                        <p className="mt-1 max-w-[10rem] text-xs text-amber-700 dark:text-amber-400">
                          Vista previa, no generada por IA. Agrega tu key de OpenAI para imágenes en Configuración.
                        </p>
                      )}
                    </div>
                  )}

                  <div className="mt-2 flex flex-wrap gap-2">
                    {storyboard ? (
                      <Link
                        href={`/business/${id}/campaigns/${campaignId}/storyboards/${storyboard.id}`}
                        className="inline-block text-sm underline text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
                      >
                        Ver guion generado →
                      </Link>
                    ) : (
                      <form action={createStoryboard.bind(null, id, campaignId, i)}>
                        <button
                          type="submit"
                          className="rounded-md bg-black px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
                        >
                          Generar storyboard y guion
                        </button>
                      </form>
                    )}

                    {!image && (
                      <form action={createCampaignImage.bind(null, id, campaignId, i)}>
                        <button
                          type="submit"
                          className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
                        >
                          Generar imagen
                        </button>
                      </form>
                    )}
                  </div>

                  {image && (
                    <div className="mt-3 border-t border-neutral-200 pt-3 dark:border-neutral-800">
                      {published ? (
                        <div>
                          <p className="text-sm">
                            ✅ Publicado en {published.pageName}
                            {published.permalinkUrl && (
                              <>
                                {" · "}
                                <a
                                  href={published.permalinkUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="underline text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
                                >
                                  Ver publicación
                                </a>
                              </>
                            )}
                          </p>
                          <PerformanceLine performance={piecePerformance} />
                        </div>
                      ) : pages.length > 0 ? (
                        <form
                          action={publishCampaignImage.bind(null, id, campaignId, i)}
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
                  )}

                  {published && (
                    <AdsSection
                      businessId={id}
                      campaignId={campaignId}
                      contentIndex={i}
                      adAccount={adAccount}
                      adCampaign={adCampaign ?? null}
                      insights={adCampaign ? (adInsightsById.get(adCampaign.id) ?? null) : null}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <Section label="Oferta" value={content.oferta} />
        <Section label="Llamado a la acción" value={content.cta} />
      </div>
    </main>
  );
}

function PerformanceLine({ performance }: { performance: PublishedPostPerformance | undefined }) {
  if (!performance) {
    return (
      <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
        Rendimiento no disponible por ahora.
      </p>
    );
  }

  const parts = [`🔁 ${performance.shares} compartidos`];
  if (performance.likes != null) parts.push(`❤️ ${performance.likes}`);
  if (performance.comments != null) parts.push(`💬 ${performance.comments}`);

  return (
    <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">{parts.join(" · ")}</p>
  );
}

function AdsSection({
  businessId,
  campaignId,
  contentIndex,
  adAccount,
  adCampaign,
  insights,
}: {
  businessId: string;
  campaignId: string;
  contentIndex: number;
  adAccount: { adAccountId: string; name: string; currency: string } | null;
  adCampaign: AdCampaign | null;
  insights: AdSetInsights | null;
}) {
  if (!adAccount) {
    return null;
  }

  if (!adCampaign) {
    return (
      <div className="mt-3 border-t border-neutral-200 pt-3 dark:border-neutral-800">
        <form
          action={launchAdCampaign.bind(null, businessId, campaignId, contentIndex)}
          className="flex flex-wrap items-center gap-2"
        >
          <span className="text-sm text-neutral-500 dark:text-neutral-400">
            🎯 Pautar esta publicación —
          </span>
          <input
            type="number"
            name="dailyBudget"
            required
            min="1"
            step="0.01"
            placeholder={`Presupuesto diario (${adAccount.currency})`}
            className="w-48 rounded-md border border-neutral-300 bg-transparent px-2 py-1.5 text-sm outline-none focus:border-black dark:border-neutral-700 dark:focus:border-white"
          />
          <button
            type="submit"
            className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
          >
            Crear campaña (pausada)
          </button>
        </form>
      </div>
    );
  }

  const dailyBudget = (adCampaign.dailyBudgetCents / 100).toFixed(2);
  const suggestedBudget = ((adCampaign.dailyBudgetCents * 1.2) / 100).toFixed(2);

  return (
    <div className="mt-3 border-t border-neutral-200 pt-3 dark:border-neutral-800">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm">
          {adCampaign.status === "active" ? "🟢 Pautando" : "⏸ Pausada"} en Meta Ads · {dailyBudget}{" "}
          {adAccount.currency}/día
        </p>
        {adCampaign.status === "active" ? (
          <form action={pauseAdCampaign.bind(null, businessId, adCampaign.id)}>
            <button
              type="submit"
              className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
            >
              Pausar
            </button>
          </form>
        ) : (
          <form action={activateAdCampaign.bind(null, businessId, adCampaign.id)}>
            <button
              type="submit"
              className="rounded-md bg-black px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
            >
              Activar (empieza a gastar)
            </button>
          </form>
        )}
      </div>

      {adCampaign.status === "active" && (
        <div className="mt-2">
          {insights ? (
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Últimos 7 días · 💰 {insights.spend.toFixed(2)} {adAccount.currency} · 👁{" "}
              {insights.impressions} impresiones · 🖱 {insights.clicks} clics
              {insights.ctr != null && ` · CTR ${insights.ctr.toFixed(2)}%`}
              {insights.cpc != null && ` · CPC ${insights.cpc.toFixed(2)} ${adAccount.currency}`}
            </p>
          ) : (
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Aún no hay datos de rendimiento para esta pauta.
            </p>
          )}

          <form
            action={updateAdBudget.bind(null, businessId, adCampaign.id)}
            className="mt-2 flex flex-wrap items-center gap-2"
          >
            <input type="hidden" name="dailyBudget" value={suggestedBudget} />
            <button
              type="submit"
              className="rounded-md border border-neutral-300 px-3 py-1.5 text-xs font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
            >
              Subir presupuesto 20% (a {suggestedBudget} {adAccount.currency}/día)
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

function Section({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400">{label}</p>
      <p className="mt-1">{value}</p>
    </div>
  );
}
