"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { encryptSecret, decryptSecret } from "@/lib/crypto";
import { generateCampaign, generateStoryboard, type AiProvider, type GeneratedCampaign } from "@/lib/ai";
import { fetchPages } from "@/lib/meta";

export async function disconnectMeta(businessId: string) {
  await prisma.socialConnection.deleteMany({ where: { businessId } });
  revalidatePath(`/business/${businessId}`);
}

export async function refreshPages(businessId: string) {
  const connection = await prisma.socialConnection.findUnique({ where: { businessId } });
  if (!connection) return;

  const pages = await fetchPages(connection.accessToken);

  await prisma.$transaction([
    prisma.socialPage.deleteMany({ where: { connectionId: connection.id } }),
    prisma.socialPage.createMany({
      data: pages.map((page) => ({
        connectionId: connection.id,
        facebookPageId: page.id,
        name: page.name,
        pageAccessToken: page.access_token,
        instagramAccountId: page.instagram_business_account?.id,
        instagramUsername: page.instagram_business_account?.username,
      })),
    }),
  ]);

  revalidatePath(`/business/${businessId}`);
}

export type AiSettingsState = {
  error?: string;
  success?: boolean;
};

const KEY_PREFIXES: Record<string, string> = {
  anthropic: "sk-ant-",
  openai: "sk-",
};

export async function saveAiSettings(
  businessId: string,
  _prevState: AiSettingsState,
  formData: FormData
): Promise<AiSettingsState> {
  const provider = formData.get("provider");
  const apiKey = formData.get("apiKey");
  const modelOverride = formData.get("model");

  if (provider !== "anthropic" && provider !== "openai") {
    return { error: "Selecciona un proveedor válido." };
  }
  if (typeof apiKey !== "string" || apiKey.trim().length < 10) {
    return { error: "Ingresa una API key válida." };
  }

  const trimmed = apiKey.trim();
  const expectedPrefix = KEY_PREFIXES[provider];
  if (!trimmed.startsWith(expectedPrefix)) {
    return {
      error: `Las API keys de ${provider === "anthropic" ? "Anthropic" : "OpenAI"} suelen empezar con "${expectedPrefix}". Verifica que copiaste la key correcta.`,
    };
  }

  await prisma.business.update({
    where: { id: businessId },
    data: {
      aiProvider: provider,
      aiApiKeyEncrypted: encryptSecret(trimmed),
      aiModel: typeof modelOverride === "string" && modelOverride.trim() ? modelOverride.trim() : null,
      aiConfiguredAt: new Date(),
    },
  });

  revalidatePath(`/business/${businessId}`);
  revalidatePath(`/business/${businessId}/settings`);
  return { success: true };
}

export async function clearAiSettings(businessId: string) {
  await prisma.business.update({
    where: { id: businessId },
    data: { aiProvider: null, aiApiKeyEncrypted: null, aiModel: null, aiConfiguredAt: null },
  });
  revalidatePath(`/business/${businessId}`);
  revalidatePath(`/business/${businessId}/settings`);
}

export async function createCampaign(
  businessId: string,
  insightTitle: string,
  insightSummary: string
) {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    include: { products: true },
  });

  if (!business) {
    redirect("/");
  }

  if (!business.aiProvider || !business.aiApiKeyEncrypted) {
    redirect(
      `/business/${businessId}/settings?campaign_error=${encodeURIComponent(
        "Configura tu proveedor de IA antes de crear una campaña."
      )}`
    );
  }

  let campaignId: string;

  try {
    const apiKey = decryptSecret(business.aiApiKeyEncrypted);
    const { content, resolvedModel } = await generateCampaign({
      provider: business.aiProvider as AiProvider,
      apiKey,
      model: business.aiModel,
      business: {
        name: business.name,
        industry: business.industry,
        description: business.description,
        targetAudience: business.targetAudience,
        location: business.location,
        objective: business.objective,
        products: business.products,
      },
      insightSummary,
    });

    const campaign = await prisma.campaign.create({
      data: {
        businessId,
        title: insightTitle,
        sourceInsight: insightSummary,
        provider: business.aiProvider,
        model: resolvedModel,
        content: JSON.stringify(content),
      },
    });
    campaignId = campaign.id;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al generar la campaña.";
    redirect(`/business/${businessId}?campaign_error=${encodeURIComponent(message)}`);
  }

  redirect(`/business/${businessId}/campaigns/${campaignId}`);
}

export async function createStoryboard(
  businessId: string,
  campaignId: string,
  contentIndex: number
) {
  const [business, campaign] = await Promise.all([
    prisma.business.findUnique({ where: { id: businessId }, include: { products: true } }),
    prisma.campaign.findUnique({ where: { id: campaignId } }),
  ]);

  if (!business || !campaign || campaign.businessId !== businessId) {
    redirect(`/business/${businessId}`);
  }

  if (!business.aiProvider || !business.aiApiKeyEncrypted) {
    redirect(
      `/business/${businessId}/settings?campaign_error=${encodeURIComponent(
        "Configura tu proveedor de IA antes de generar un guion."
      )}`
    );
  }

  let campaignContent: GeneratedCampaign;
  try {
    campaignContent = JSON.parse(campaign.content) as GeneratedCampaign;
  } catch {
    redirect(
      `/business/${businessId}/campaigns/${campaignId}?storyboard_error=${encodeURIComponent(
        "No se pudo leer el contenido de esta campaña."
      )}`
    );
  }

  const item = campaignContent.contenido[contentIndex];
  if (!item) {
    redirect(
      `/business/${businessId}/campaigns/${campaignId}?storyboard_error=${encodeURIComponent(
        "Esa pieza de contenido ya no existe."
      )}`
    );
  }

  let storyboardId: string;

  try {
    const apiKey = decryptSecret(business.aiApiKeyEncrypted);
    const { content, resolvedModel } = await generateStoryboard({
      provider: business.aiProvider as AiProvider,
      apiKey,
      model: business.aiModel,
      business: {
        name: business.name,
        industry: business.industry,
        description: business.description,
        targetAudience: business.targetAudience,
        location: business.location,
        objective: business.objective,
        products: business.products,
      },
      concepto: campaignContent.concepto,
      oferta: campaignContent.oferta,
      cta: campaignContent.cta,
      hook: item.hook,
      formato: item.formato,
    });

    const storyboard = await prisma.storyboard.create({
      data: {
        campaignId,
        contentIndex,
        hook: item.hook,
        format: item.formato,
        provider: business.aiProvider,
        model: resolvedModel,
        scenes: JSON.stringify(content),
      },
    });
    storyboardId = storyboard.id;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al generar el guion.";
    redirect(`/business/${businessId}/campaigns/${campaignId}?storyboard_error=${encodeURIComponent(message)}`);
  }

  redirect(`/business/${businessId}/campaigns/${campaignId}/storyboards/${storyboardId}`);
}
