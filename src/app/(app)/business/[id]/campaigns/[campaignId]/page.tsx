import { notFound } from "next/navigation";
import Image from "next/image";
import { Flame, CheckCircle2, Play, Pause, TrendingUp, ExternalLink } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireBusinessAccess } from "@/lib/dal";
import { ADS_ENABLED } from "@/lib/features";
import { fileUrl } from "@/lib/storage";
import { decryptToken } from "@/lib/crypto";
import type { GeneratedCampaign } from "@/lib/ai";
import { createCampaignImage, publishCampaignImage } from "../../actions";
import { createPieceFromCampaign } from "../../content-actions";
import { launchAdCampaign, activateAdCampaign, pauseAdCampaign, updateAdBudget } from "../../ads-actions";
import { fetchAdSetInsights, type AdSetInsights } from "@/lib/meta";
import {
  getCampaignPerformance,
  findPerformanceHighlight,
  type PublishedPostPerformance,
} from "@/lib/campaignPerformance";
import type { AdCampaign } from "@/generated/prisma/client";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Field";

export default async function CampaignPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; campaignId: string }>;
  searchParams: Promise<{
    storyboard_error?: string;
    error?: string;
    image_error?: string;
    publish_error?: string;
    ad_error?: string;
  }>;
}) {
  const { id, campaignId } = await params;
  const {
    storyboard_error: storyboardError,
    error: pieceError,
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
        contentPieces: { select: { id: true, contentIndex: true } },
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
  const pieceByIndex = new Map(campaign.contentPieces.map((p) => [p.contentIndex, p]));
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
  if (ADS_ENABLED && activeAdCampaigns.length > 0 && business.socialConnection) {
    const accessToken = decryptToken(business.socialConnection.accessToken);
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
    <main className="mx-auto max-w-2xl px-6 py-12">
      <PageHeader
        backHref={`/business/${id}`}
        backLabel="Volver al negocio"
        eyebrow={`Campaña generada · ${campaign.provider} (${campaign.model})`}
        title={campaign.title}
        description={`Basada en: ${campaign.sourceInsight}`}
      />

      <div className="space-y-2">
        {storyboardError && <Notice>No se pudo generar el guion: {storyboardError}</Notice>}
        {pieceError && <Notice>No se pudo generar el guion: {pieceError}</Notice>}
        {imageError && <Notice>No se pudo generar la imagen: {imageError}</Notice>}
        {publishError && <Notice>No se pudo publicar: {publishError}</Notice>}
        {adError && <Notice>{adError}</Notice>}
      </div>

      {highlight && (
        <Card className="mt-4">
          <p className="flex items-center gap-1.5 font-medium">
            <Flame className="size-4 text-orange-500" /> Oportunidad
          </p>
          <p className="mt-2 text-sm text-muted">
            La pieza &ldquo;{content.contenido[highlight.best.contentIndex]?.hook}&rdquo; está
            funcionando {highlight.multiplier.toFixed(1)}× mejor que el resto de esta campaña (
            {highlight.best.shares} compartidos
            {highlight.best.likes != null && `, ${highlight.best.likes} likes`}
            {highlight.best.comments != null && `, ${highlight.best.comments} comentarios`}).
          </p>
          <p className="mt-2 text-sm">
            <span className="font-medium">Recomendación: </span>
            Crea variantes basadas en ese patrón para el resto de la campaña.
          </p>
        </Card>
      )}

      <div className="mt-8 space-y-6">
        <Section label="Objetivo" value={content.objetivo} />
        <Section label="Audiencia" value={content.audiencia} />
        <Section label="Concepto" value={content.concepto} />

        <div>
          <p className="text-sm font-medium text-muted">Contenido</p>
          <div className="mt-2 space-y-3">
            {content.contenido.map((item, i) => {
              const storyboard = storyboardByIndex.get(i);
              const piece = pieceByIndex.get(i);
              const image = imageByIndex.get(i);
              const published = publishedByIndex.get(i);
              const piecePerformance = performanceByIndex.get(i);
              const adCampaign = adCampaignByIndex.get(i);
              return (
                <Card key={i} className="p-4">
                  <p className="text-xs font-medium text-muted">{item.formato}</p>
                  <p className="mt-1 text-sm">&ldquo;{item.hook}&rdquo;</p>

                  {image && (
                    <div className="mt-2">
                      <Image
                        src={fileUrl(image.imagePath)}
                        unoptimized
                        alt={item.hook}
                        width={256}
                        height={384}
                        className="w-40 rounded-md border border-border"
                      />
                      {image.provider === "placeholder" && (
                        <p className="mt-1 max-w-[10rem] text-xs text-amber-700 dark:text-amber-400">
                          Vista previa, no generada por IA. Agrega tu key de OpenAI para imágenes
                          en Configuración.
                        </p>
                      )}
                    </div>
                  )}

                  <div className="mt-2 flex flex-wrap gap-2">
                    {piece ? (
                      <a
                        href={`/business/${id}/pieces/${piece.id}`}
                        className="inline-block text-sm text-brand hover:underline"
                      >
                        Ver guion y grabar escenas →
                      </a>
                    ) : (
                      <form action={createPieceFromCampaign.bind(null, id, campaignId, i)}>
                        <Button type="submit" size="sm">
                          Generar guion completo
                        </Button>
                      </form>
                    )}
                    {storyboard && !piece && (
                      <a
                        href={`/business/${id}/campaigns/${campaignId}/storyboards/${storyboard.id}`}
                        className="inline-block text-sm text-muted hover:underline"
                      >
                        Ver storyboard anterior
                      </a>
                    )}

                    {!image && (
                      <form action={createCampaignImage.bind(null, id, campaignId, i)}>
                        <Button type="submit" variant="secondary" size="sm">
                          Generar imagen
                        </Button>
                      </form>
                    )}
                  </div>

                  {image && (
                    <div className="mt-3 border-t border-border pt-3">
                      {published ? (
                        <div>
                          <p className="flex items-center gap-1.5 text-sm">
                            <CheckCircle2 className="size-4 text-green-600 dark:text-green-400" />
                            Publicado en {published.pageName}
                            {published.permalinkUrl && (
                              <a
                                href={published.permalinkUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-0.5 text-brand hover:underline"
                              >
                                Ver publicación <ExternalLink className="size-3" />
                              </a>
                            )}
                          </p>
                          <PerformanceLine performance={piecePerformance} />
                        </div>
                      ) : pages.length > 0 ? (
                        <form
                          action={publishCampaignImage.bind(null, id, campaignId, i)}
                          className="flex flex-wrap items-center gap-2"
                        >
                          <Select name="pageId" required className="w-auto">
                            {pages.map((page) => (
                              <option key={page.id} value={page.facebookPageId}>
                                {page.name}
                              </option>
                            ))}
                          </Select>
                          <Button type="submit" size="sm">
                            Publicar en Facebook
                          </Button>
                        </form>
                      ) : (
                        <p className="text-sm text-muted">
                          Conecta una página de Facebook para poder publicar.
                        </p>
                      )}
                    </div>
                  )}

                  {published && ADS_ENABLED && (
                    <AdsSection
                      businessId={id}
                      campaignId={campaignId}
                      contentIndex={i}
                      adAccount={adAccount}
                      adCampaign={adCampaign ?? null}
                      insights={adCampaign ? (adInsightsById.get(adCampaign.id) ?? null) : null}
                    />
                  )}
                </Card>
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

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
      {children}
    </p>
  );
}

function PerformanceLine({ performance }: { performance: PublishedPostPerformance | undefined }) {
  if (!performance) {
    return <p className="mt-1 text-xs text-faint">Rendimiento no disponible por ahora.</p>;
  }

  const parts = [`🔁 ${performance.shares} compartidos`];
  if (performance.likes != null) parts.push(`❤️ ${performance.likes}`);
  if (performance.comments != null) parts.push(`💬 ${performance.comments}`);

  return <p className="mt-1 text-xs text-faint">{parts.join(" · ")}</p>;
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
      <div className="mt-3 border-t border-border pt-3">
        <form
          action={launchAdCampaign.bind(null, businessId, campaignId, contentIndex)}
          className="flex flex-wrap items-center gap-2"
        >
          <span className="text-sm text-muted">Pautar esta publicación —</span>
          <input
            type="number"
            name="dailyBudget"
            required
            min="1"
            step="0.01"
            placeholder={`Presupuesto diario (${adAccount.currency})`}
            className="w-48 rounded-md border border-border bg-transparent px-2 py-1.5 text-sm outline-none focus:border-brand"
          />
          <Button type="submit" variant="secondary" size="sm">
            Crear campaña (pausada)
          </Button>
        </form>
      </div>
    );
  }

  const dailyBudget = (adCampaign.dailyBudgetCents / 100).toFixed(2);
  const suggestedBudget = ((adCampaign.dailyBudgetCents * 1.2) / 100).toFixed(2);

  return (
    <div className="mt-3 border-t border-border pt-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-sm">
          <Badge tone={adCampaign.status === "active" ? "success" : "neutral"}>
            {adCampaign.status === "active" ? "Pautando" : "Pausada"}
          </Badge>
          en Meta Ads · {dailyBudget} {adAccount.currency}/día
        </p>
        {adCampaign.status === "active" ? (
          <form action={pauseAdCampaign.bind(null, businessId, adCampaign.id)}>
            <Button type="submit" variant="secondary" size="sm">
              <Pause className="size-3.5" /> Pausar
            </Button>
          </form>
        ) : (
          <form action={activateAdCampaign.bind(null, businessId, adCampaign.id)}>
            <Button type="submit" size="sm">
              <Play className="size-3.5" /> Activar (empieza a gastar)
            </Button>
          </form>
        )}
      </div>

      {adCampaign.status === "active" && (
        <div className="mt-2">
          {insights ? (
            <p className="text-xs text-faint">
              Últimos 7 días · {insights.spend.toFixed(2)} {adAccount.currency} gastados ·{" "}
              {insights.impressions} impresiones · {insights.clicks} clics
              {insights.ctr != null && ` · CTR ${insights.ctr.toFixed(2)}%`}
              {insights.cpc != null && ` · CPC ${insights.cpc.toFixed(2)} ${adAccount.currency}`}
            </p>
          ) : (
            <p className="text-xs text-faint">Aún no hay datos de rendimiento para esta pauta.</p>
          )}

          <form
            action={updateAdBudget.bind(null, businessId, adCampaign.id)}
            className="mt-2 flex flex-wrap items-center gap-2"
          >
            <input type="hidden" name="dailyBudget" value={suggestedBudget} />
            <Button type="submit" variant="secondary" size="sm" className="text-xs">
              <TrendingUp className="size-3.5" /> Subir presupuesto 20% (a {suggestedBudget}{" "}
              {adAccount.currency}/día)
            </Button>
          </form>
        </div>
      )}
    </div>
  );
}

function Section({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-sm font-medium text-muted">{label}</p>
      <p className="mt-1">{value}</p>
    </div>
  );
}
