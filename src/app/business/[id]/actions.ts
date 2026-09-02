"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { encryptSecret, decryptSecret } from "@/lib/crypto";
import { generateCampaign, generateStoryboard, generateImagePrompt, type AiProvider, type GeneratedCampaign } from "@/lib/ai";
import { fetchPages, publishPagePhoto } from "@/lib/meta";
import { generateImage } from "@/lib/images";
import { generatePlaceholderImage } from "@/lib/placeholderImage";
import { mkdir, writeFile, readFile } from "fs/promises";
import path from "path";

// Image generation (GPT Image) is OpenAI-only. If the business already uses
// OpenAI for text, its main key doubles as the image key; otherwise a
// dedicated openaiImageKeyEncrypted is required (set in AI settings).
function resolveOpenAiImageKeyEncrypted(business: {
  aiProvider: string | null;
  aiApiKeyEncrypted: string | null;
  openaiImageKeyEncrypted: string | null;
}): string | null {
  if (business.openaiImageKeyEncrypted) return business.openaiImageKeyEncrypted;
  if (business.aiProvider === "openai" && business.aiApiKeyEncrypted) return business.aiApiKeyEncrypted;
  return null;
}

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
  const openaiTranscriptionKey = formData.get("openaiTranscriptionKey");
  const openaiImageKey = formData.get("openaiImageKey");

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

  let transcriptionKeyTrimmed: string | null = null;
  if (typeof openaiTranscriptionKey === "string" && openaiTranscriptionKey.trim().length > 0) {
    transcriptionKeyTrimmed = openaiTranscriptionKey.trim();
    if (!transcriptionKeyTrimmed.startsWith("sk-")) {
      return { error: 'La API key de OpenAI para transcripción debe empezar con "sk-".' };
    }
  }

  let imageKeyTrimmed: string | null = null;
  if (typeof openaiImageKey === "string" && openaiImageKey.trim().length > 0) {
    imageKeyTrimmed = openaiImageKey.trim();
    if (!imageKeyTrimmed.startsWith("sk-")) {
      return { error: 'La API key de OpenAI para imágenes debe empezar con "sk-".' };
    }
  }

  await prisma.business.update({
    where: { id: businessId },
    data: {
      aiProvider: provider,
      aiApiKeyEncrypted: encryptSecret(trimmed),
      aiModel: typeof modelOverride === "string" && modelOverride.trim() ? modelOverride.trim() : null,
      aiConfiguredAt: new Date(),
      ...(transcriptionKeyTrimmed
        ? { openaiTranscriptionKeyEncrypted: encryptSecret(transcriptionKeyTrimmed) }
        : {}),
      ...(imageKeyTrimmed ? { openaiImageKeyEncrypted: encryptSecret(imageKeyTrimmed) } : {}),
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

export async function clearTranscriptionKey(businessId: string) {
  await prisma.business.update({
    where: { id: businessId },
    data: { openaiTranscriptionKeyEncrypted: null },
  });
  revalidatePath(`/business/${businessId}`);
  revalidatePath(`/business/${businessId}/settings`);
}

export async function clearImageKey(businessId: string) {
  await prisma.business.update({
    where: { id: businessId },
    data: { openaiImageKeyEncrypted: null },
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

export async function createCampaignFromObjective(businessId: string, formData: FormData) {
  const goalRaw = formData.get("goal");
  const goal = typeof goalRaw === "string" ? goalRaw.trim() : "";

  if (goal.length < 5) {
    redirect(
      `/business/${businessId}?campaign_error=${encodeURIComponent(
        "Describe con un poco más de detalle qué quieres lograr."
      )}`
    );
  }

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
      insightSummary: goal,
      briefKind: "goal",
    });

    const campaign = await prisma.campaign.create({
      data: {
        businessId,
        title: goal.length > 60 ? `${goal.slice(0, 60)}…` : goal,
        sourceInsight: goal,
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

export async function createCampaignImage(
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
        "Configura tu proveedor de IA antes de generar una imagen."
      )}`
    );
  }

  // Real AI image generation (GPT Image) requires OpenAI specifically. When
  // no OpenAI image key is configured, fall back to a local text-on-background
  // placeholder (via ffmpeg) so the rest of the pipeline (review → publish)
  // can still be exercised — clearly marked as such, never passed off as AI.
  const openaiImageKeyEncrypted = resolveOpenAiImageKeyEncrypted(business);

  let campaignContent: GeneratedCampaign;
  try {
    campaignContent = JSON.parse(campaign.content) as GeneratedCampaign;
  } catch {
    redirect(
      `/business/${businessId}/campaigns/${campaignId}?image_error=${encodeURIComponent(
        "No se pudo leer el contenido de esta campaña."
      )}`
    );
  }

  const item = campaignContent.contenido[contentIndex];
  if (!item) {
    redirect(
      `/business/${businessId}/campaigns/${campaignId}?image_error=${encodeURIComponent(
        "Esa pieza de contenido ya no existe."
      )}`
    );
  }

  try {
    const textApiKey = decryptSecret(business.aiApiKeyEncrypted);
    const { imagePrompt } = await generateImagePrompt({
      provider: business.aiProvider as AiProvider,
      apiKey: textApiKey,
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
      hook: item.hook,
      formato: item.formato,
    });

    const dir = path.join(process.cwd(), "public", "uploads", businessId, "campaign-images");
    await mkdir(dir, { recursive: true });
    const filename = `${campaignId}-${contentIndex}-${Date.now()}.png`;
    const diskPath = path.join(dir, filename);
    const imagePublicPath = `/uploads/${businessId}/campaign-images/${filename}`;

    let provider: string;
    let model: string;

    if (openaiImageKeyEncrypted) {
      const imageApiKey = decryptSecret(openaiImageKeyEncrypted);
      const imageBuffer = await generateImage(imageApiKey, imagePrompt);
      await writeFile(diskPath, imageBuffer);
      provider = "openai";
      model = "gpt-image-2";
    } else {
      await generatePlaceholderImage(`${item.hook}\n\n${campaignContent.oferta}`, diskPath);
      provider = "placeholder";
      model = "ffmpeg-drawtext";
    }

    await prisma.campaignImage.create({
      data: {
        campaignId,
        contentIndex,
        prompt: imagePrompt,
        imagePath: imagePublicPath,
        provider,
        model,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al generar la imagen.";
    redirect(`/business/${businessId}/campaigns/${campaignId}?image_error=${encodeURIComponent(message)}`);
  }

  redirect(`/business/${businessId}/campaigns/${campaignId}`);
}

export async function publishCampaignImage(
  businessId: string,
  campaignId: string,
  contentIndex: number,
  formData: FormData
) {
  const facebookPageId = formData.get("pageId");
  if (typeof facebookPageId !== "string" || facebookPageId.length === 0) {
    redirect(
      `/business/${businessId}/campaigns/${campaignId}?publish_error=${encodeURIComponent(
        "Selecciona una página para publicar."
      )}`
    );
  }

  const [campaign, page] = await Promise.all([
    prisma.campaign.findUnique({
      where: { id: campaignId },
      include: { images: { where: { contentIndex } } },
    }),
    prisma.socialPage.findFirst({
      where: { facebookPageId, connection: { businessId } },
    }),
  ]);

  if (!campaign || campaign.businessId !== businessId) {
    redirect(`/business/${businessId}`);
  }
  if (!page) {
    redirect(
      `/business/${businessId}/campaigns/${campaignId}?publish_error=${encodeURIComponent(
        "No se encontró esa página conectada."
      )}`
    );
  }

  const image = campaign.images[0];
  if (!image) {
    redirect(
      `/business/${businessId}/campaigns/${campaignId}?publish_error=${encodeURIComponent(
        "Genera una imagen para esta pieza antes de publicar."
      )}`
    );
  }

  let campaignContent: GeneratedCampaign;
  try {
    campaignContent = JSON.parse(campaign.content) as GeneratedCampaign;
  } catch {
    redirect(
      `/business/${businessId}/campaigns/${campaignId}?publish_error=${encodeURIComponent(
        "No se pudo leer el contenido de esta campaña."
      )}`
    );
  }

  const item = campaignContent.contenido[contentIndex];
  const caption = [item?.hook, campaignContent.oferta, campaignContent.cta]
    .filter(Boolean)
    .join("\n\n");

  try {
    const imageDiskPath = path.join(process.cwd(), "public", image.imagePath);
    const imageBuffer = await readFile(imageDiskPath);

    const { postId, permalinkUrl } = await publishPagePhoto(
      page.facebookPageId,
      page.pageAccessToken,
      imageBuffer,
      caption
    );

    await prisma.publishedPost.create({
      data: {
        campaignId,
        contentIndex,
        facebookPageId: page.facebookPageId,
        pageName: page.name,
        facebookPostId: postId,
        permalinkUrl,
        message: caption,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al publicar en Facebook.";
    redirect(`/business/${businessId}/campaigns/${campaignId}?publish_error=${encodeURIComponent(message)}`);
  }

  redirect(`/business/${businessId}/campaigns/${campaignId}`);
}

export async function addCompetitor(businessId: string, formData: FormData) {
  const name = formData.get("name");
  if (typeof name !== "string" || name.trim().length === 0) {
    redirect(`/business/${businessId}`);
  }

  await prisma.competitor.create({
    data: { businessId, name: name.trim() },
  });

  revalidatePath(`/business/${businessId}`);
  redirect(`/business/${businessId}`);
}

export async function removeCompetitor(businessId: string, competitorId: string) {
  await prisma.competitor.deleteMany({ where: { id: competitorId, businessId } });
  revalidatePath(`/business/${businessId}`);
  redirect(`/business/${businessId}`);
}
