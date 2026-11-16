"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireBusinessAccess } from "@/lib/dal";
import { ADS_ENABLED } from "@/lib/features";
import { decryptToken } from "@/lib/crypto";
import {
  fetchAdAccounts,
  searchAdGeoLocation,
  buildGeoTargeting,
  createAdCampaign,
  createAdSet,
  createAdCreativeFromPost,
  createAd,
  setAdSetStatus,
  setAdStatus,
  updateAdSetDailyBudget,
} from "@/lib/meta";

// Paid ads are frozen (see lib/features.ts). Every action below goes through
// this first, so a stale form or hand-crafted request can't create spend.
async function requireAdsAccess(businessId: string) {
  await requireBusinessAccess(businessId);
  if (!ADS_ENABLED) {
    redirectToBusiness(businessId, "La pauta en Meta Ads está desactivada por ahora.");
  }
}

function redirectToBusiness(businessId: string, error: string): never {
  redirect(`/business/${businessId}?ad_error=${encodeURIComponent(error)}`);
}

export async function connectAdAccount(businessId: string, formData: FormData) {
  await requireAdsAccess(businessId);

  const adAccountId = formData.get("adAccountId");
  if (typeof adAccountId !== "string" || adAccountId.length === 0) {
    redirectToBusiness(businessId, "Selecciona una cuenta publicitaria.");
  }

  const connection = await prisma.socialConnection.findUnique({ where: { businessId } });
  if (!connection) {
    redirectToBusiness(businessId, "Conecta primero Facebook/Instagram.");
  }

  try {
    const accounts = await fetchAdAccounts(decryptToken(connection.accessToken));
    const account = accounts.find((a) => a.id === adAccountId);
    if (!account) {
      redirectToBusiness(businessId, "Esa cuenta publicitaria ya no está disponible.");
    }

    await prisma.metaAdAccount.upsert({
      where: { connectionId: connection.id },
      create: {
        connectionId: connection.id,
        adAccountId: account.id,
        name: account.name,
        currency: account.currency,
      },
      update: {
        adAccountId: account.id,
        name: account.name,
        currency: account.currency,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al conectar la cuenta publicitaria.";
    redirectToBusiness(businessId, message);
  }

  redirect(`/business/${businessId}`);
}

function redirectToCampaign(businessId: string, campaignId: string, error: string): never {
  redirect(
    `/business/${businessId}/campaigns/${campaignId}?ad_error=${encodeURIComponent(error)}`
  );
}

// Builds the full funnel (campaign -> adset -> creative -> ad) from an
// already-published organic post — a "boost" — and saves it PAUSED. Nothing
// here spends money: activateAdCampaign is a separate, explicit step.
export async function launchAdCampaign(
  businessId: string,
  campaignId: string,
  contentIndex: number,
  formData: FormData
) {
  await requireAdsAccess(businessId);

  const dailyBudgetRaw = formData.get("dailyBudget");
  const dailyBudget = typeof dailyBudgetRaw === "string" ? Number(dailyBudgetRaw) : NaN;
  if (!Number.isFinite(dailyBudget) || dailyBudget <= 0) {
    redirectToCampaign(businessId, campaignId, "Ingresa un presupuesto diario válido.");
  }

  const [business, campaign] = await Promise.all([
    prisma.business.findUnique({
      where: { id: businessId },
      include: { socialConnection: { include: { adAccount: true } } },
    }),
    prisma.campaign.findUnique({
      where: { id: campaignId },
      include: { publishedPosts: { where: { contentIndex } } },
    }),
  ]);

  if (!business || !campaign || campaign.businessId !== businessId) {
    redirectToCampaign(businessId, campaignId, "No se encontró la campaña.");
  }

  const connection = business.socialConnection;
  const adAccount = connection?.adAccount;
  if (!connection || !adAccount) {
    redirectToCampaign(businessId, campaignId, "Conecta una cuenta publicitaria de Meta primero.");
  }

  const published = campaign.publishedPosts[0];
  if (!published) {
    redirectToCampaign(
      businessId,
      campaignId,
      "Primero publica esta pieza en Facebook — la pauta usa esa publicación."
    );
  }

  // Meta's daily_budget is in the account's currency minor unit; assumes a
  // 2-decimal currency (true for USD, the common case for these accounts).
  const dailyBudgetCents = Math.round(dailyBudget * 100);
  const accessToken = decryptToken(connection.accessToken);

  try {
    const location = await searchAdGeoLocation(accessToken, business.location);
    if (!location) {
      redirectToCampaign(
        businessId,
        campaignId,
        `No se pudo resolver la ubicación "${business.location}" para segmentar el anuncio.`
      );
    }
    const geoTargeting = buildGeoTargeting(location);

    const namePrefix = `${business.name} — ${campaign.title}`.slice(0, 120);

    const metaCampaignId = await createAdCampaign(adAccount.adAccountId, accessToken, namePrefix);
    const metaAdSetId = await createAdSet(adAccount.adAccountId, accessToken, {
      name: `${namePrefix} — Conjunto`,
      campaignId: metaCampaignId,
      dailyBudgetCents,
      geoTargeting,
    });
    const metaCreativeId = await createAdCreativeFromPost(
      adAccount.adAccountId,
      accessToken,
      published.facebookPageId,
      published.facebookPostId,
      `${namePrefix} — Creativo`
    );
    const metaAdId = await createAd(adAccount.adAccountId, accessToken, {
      name: `${namePrefix} — Anuncio`,
      adSetId: metaAdSetId,
      creativeId: metaCreativeId,
    });

    await prisma.adCampaign.upsert({
      where: { campaignId_contentIndex: { campaignId, contentIndex } },
      create: {
        campaignId,
        contentIndex,
        metaCampaignId,
        metaAdSetId,
        metaAdId,
        metaCreativeId,
        dailyBudgetCents,
        status: "paused",
      },
      update: {
        metaCampaignId,
        metaAdSetId,
        metaAdId,
        metaCreativeId,
        dailyBudgetCents,
        status: "paused",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al crear la campaña en Meta Ads.";
    redirectToCampaign(businessId, campaignId, message);
  }

  redirect(`/business/${businessId}/campaigns/${campaignId}`);
}

async function requireAdCampaignAccess(businessId: string, adCampaignId: string) {
  const adCampaign = await prisma.adCampaign.findUnique({
    where: { id: adCampaignId },
    include: { campaign: { include: { business: { include: { socialConnection: true } } } } },
  });
  if (!adCampaign || adCampaign.campaign.businessId !== businessId) {
    return null;
  }
  const accessToken = adCampaign.campaign.business.socialConnection?.accessToken;
  if (!accessToken) {
    return null;
  }
  return { adCampaign, accessToken: decryptToken(accessToken) };
}

// The only place spend can turn on — always triggered by an explicit click
// on the "Activar" button, never automatically.
export async function activateAdCampaign(businessId: string, adCampaignId: string) {
  await requireAdsAccess(businessId);
  const access = await requireAdCampaignAccess(businessId, adCampaignId);
  if (!access) {
    redirect(`/business/${businessId}`);
  }
  const { adCampaign, accessToken } = access;
  const campaignId = adCampaign.campaignId;

  try {
    await setAdSetStatus(adCampaign.metaAdSetId, accessToken, "ACTIVE");
    await setAdStatus(adCampaign.metaAdId, accessToken, "ACTIVE");
    await prisma.adCampaign.update({ where: { id: adCampaignId }, data: { status: "active" } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al activar la campaña.";
    redirectToCampaign(businessId, campaignId, message);
  }

  redirect(`/business/${businessId}/campaigns/${campaignId}`);
}

export async function pauseAdCampaign(businessId: string, adCampaignId: string) {
  await requireAdsAccess(businessId);
  const access = await requireAdCampaignAccess(businessId, adCampaignId);
  if (!access) {
    redirect(`/business/${businessId}`);
  }
  const { adCampaign, accessToken } = access;
  const campaignId = adCampaign.campaignId;

  try {
    await setAdSetStatus(adCampaign.metaAdSetId, accessToken, "PAUSED");
    await setAdStatus(adCampaign.metaAdId, accessToken, "PAUSED");
    await prisma.adCampaign.update({ where: { id: adCampaignId }, data: { status: "paused" } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al pausar la campaña.";
    redirectToCampaign(businessId, campaignId, message);
  }

  redirect(`/business/${businessId}/campaigns/${campaignId}`);
}

// Applies a budget change the user explicitly approved by clicking (e.g. a
// "sube presupuesto 20%" suggestion) — never invoked on its own.
export async function updateAdBudget(businessId: string, adCampaignId: string, formData: FormData) {
  await requireAdsAccess(businessId);

  const dailyBudgetRaw = formData.get("dailyBudget");
  const dailyBudget = typeof dailyBudgetRaw === "string" ? Number(dailyBudgetRaw) : NaN;

  const access = await requireAdCampaignAccess(businessId, adCampaignId);
  if (!access) {
    redirect(`/business/${businessId}`);
  }
  const { adCampaign, accessToken } = access;
  const campaignId = adCampaign.campaignId;

  if (!Number.isFinite(dailyBudget) || dailyBudget <= 0) {
    redirectToCampaign(businessId, campaignId, "Presupuesto inválido.");
  }

  const dailyBudgetCents = Math.round(dailyBudget * 100);

  try {
    await updateAdSetDailyBudget(adCampaign.metaAdSetId, accessToken, dailyBudgetCents);
    await prisma.adCampaign.update({
      where: { id: adCampaignId },
      data: { dailyBudgetCents },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al actualizar el presupuesto.";
    redirectToCampaign(businessId, campaignId, message);
  }

  redirect(`/business/${businessId}/campaigns/${campaignId}`);
}
