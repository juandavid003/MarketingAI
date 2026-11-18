"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireBusinessAccess } from "@/lib/dal";
import { decryptToken } from "@/lib/crypto";
import { businessAi } from "@/lib/aiCredentials";
import { toAiBusiness } from "@/lib/businessContext";
import { generateCompetitorIdeas, type CompetitorPostInput } from "@/lib/contentAi";
import { interactions } from "@/lib/competitorStats";
import {
  discoverInstagramAccount,
  normalizeInstagramUsername,
  mediaFormat,
  DiscoveryPermissionError,
  DiscoveryNotFoundError,
} from "@/lib/competitorDiscovery";

const page = (businessId: string) => `/business/${businessId}/competitors`;

function back(businessId: string, params: Record<string, string> = {}): never {
  const qs = new URLSearchParams(params).toString();
  redirect(`${page(businessId)}${qs ? `?${qs}` : ""}`);
}

function text(formData: FormData, name: string): string {
  const v = formData.get(name);
  return typeof v === "string" ? v.trim() : "";
}

function optionalInt(formData: FormData, name: string): number | null {
  const raw = text(formData, name).replace(/[.,\s]/g, "");
  if (!raw) return null;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 ? n : null;
}

async function ownCompetitor(businessId: string, competitorId: string) {
  const competitor = await prisma.competitor.findFirst({ where: { id: competitorId, businessId } });
  if (!competitor) back(businessId);
  return competitor;
}

export async function addCompetitor(businessId: string, formData: FormData) {
  await requireBusinessAccess(businessId);
  const name = text(formData, "name");
  const rawUsername = text(formData, "instagramUsername");
  if (!name) back(businessId, { error: "Escribe el nombre del competidor." });

  const instagramUsername = rawUsername ? normalizeInstagramUsername(rawUsername) : null;
  if (rawUsername && !instagramUsername) {
    back(businessId, { error: "Ese usuario de Instagram no es válido." });
  }

  const competitor = await prisma.competitor.create({ data: { businessId, name, instagramUsername } });
  if (instagramUsername) await syncOne(businessId, competitor.id);
  revalidatePath(`/business/${businessId}`);
  back(businessId);
}

export async function updateCompetitorUsername(businessId: string, competitorId: string, formData: FormData) {
  await requireBusinessAccess(businessId);
  await ownCompetitor(businessId, competitorId);
  const raw = text(formData, "instagramUsername");
  const instagramUsername = raw ? normalizeInstagramUsername(raw) : null;
  if (raw && !instagramUsername) back(businessId, { error: "Ese usuario de Instagram no es válido." });

  await prisma.competitor.update({
    where: { id: competitorId },
    data: { instagramUsername, syncError: null },
  });
  if (instagramUsername) await syncOne(businessId, competitorId);
  back(businessId);
}

export async function removeCompetitor(businessId: string, competitorId: string) {
  await requireBusinessAccess(businessId);
  await prisma.competitor.deleteMany({ where: { id: competitorId, businessId } });
  revalidatePath(`/business/${businessId}`);
  back(businessId);
}

export async function syncCompetitor(businessId: string, competitorId: string) {
  await requireBusinessAccess(businessId);
  await ownCompetitor(businessId, competitorId);
  await syncOne(businessId, competitorId);
  back(businessId);
}

// Reads the competitor's public profile + recent posts via Business
// Discovery and upserts them. Errors are stored on the competitor (shown in
// the UI) rather than thrown, so one bad username can't break the page.
async function syncOne(businessId: string, competitorId: string): Promise<void> {
  const competitor = await prisma.competitor.findFirst({ where: { id: competitorId, businessId } });
  if (!competitor?.instagramUsername) return;

  const igPage = await prisma.socialPage.findFirst({
    where: { connection: { businessId }, instagramAccountId: { not: null } },
  });
  if (!igPage?.instagramAccountId) {
    await prisma.competitor.update({
      where: { id: competitorId },
      data: {
        syncError:
          "Conecta una cuenta de Instagram Business o Creator (vinculada a tu página de Facebook): Instagram solo permite consultar otras cuentas desde una cuenta profesional propia.",
      },
    });
    return;
  }

  try {
    const account = await discoverInstagramAccount({
      ownIgUserId: igPage.instagramAccountId,
      pageAccessToken: decryptToken(igPage.pageAccessToken),
      username: competitor.instagramUsername,
    });

    await prisma.$transaction([
      ...account.media.map((m) =>
        prisma.competitorPost.upsert({
          where: { competitorId_externalId: { competitorId, externalId: m.id } },
          create: {
            competitorId,
            source: "instagram_api",
            externalId: m.id,
            permalink: m.permalink ?? null,
            caption: m.caption ?? null,
            mediaType: mediaFormat(m),
            likeCount: m.like_count ?? null,
            commentsCount: m.comments_count ?? null,
            postedAt: m.timestamp ? new Date(m.timestamp) : null,
          },
          update: {
            caption: m.caption ?? null,
            likeCount: m.like_count ?? null,
            commentsCount: m.comments_count ?? null,
          },
        })
      ),
      prisma.competitor.update({
        where: { id: competitorId },
        data: {
          followersCount: account.followersCount,
          mediaCount: account.mediaCount,
          lastSyncedAt: new Date(),
          syncError: null,
        },
      }),
    ]);
  } catch (err) {
    let syncError: string;
    if (err instanceof DiscoveryPermissionError) {
      syncError =
        "Instagram todavía no autoriza a esta app a leer cuentas de otros (falta el permiso instagram_manage_insights). Mientras tanto puedes registrar publicaciones de referencia a mano.";
    } else if (err instanceof DiscoveryNotFoundError) {
      syncError = `No encontramos @${competitor.instagramUsername}, o no es una cuenta Business/Creator (Instagram solo comparte datos públicos de esas cuentas).`;
    } else {
      syncError = err instanceof Error ? err.message.slice(0, 300) : "Error al consultar Instagram.";
    }
    await prisma.competitor.update({ where: { id: competitorId }, data: { syncError } });
  }
}

// A reference post the owner saw themselves (any platform). Metrics are
// optional and always labeled as "registrado por ti".
export async function addManualPost(businessId: string, competitorId: string, formData: FormData) {
  await requireBusinessAccess(businessId);
  await ownCompetitor(businessId, competitorId);

  const caption = text(formData, "caption");
  const permalink = text(formData, "permalink");
  const notes = text(formData, "notes");
  if (!caption && !notes) {
    back(businessId, { error: "Pega el texto de la publicación o describe de qué trata." });
  }
  if (permalink && !/^https?:\/\//i.test(permalink)) {
    back(businessId, { error: "El enlace debe empezar con http:// o https://" });
  }

  await prisma.competitorPost.create({
    data: {
      competitorId,
      source: "manual",
      permalink: permalink || null,
      caption: caption || null,
      notes: notes || null,
      mediaType: text(formData, "mediaType") || null,
      likeCount: optionalInt(formData, "likeCount"),
      commentsCount: optionalInt(formData, "commentsCount"),
    },
  });
  back(businessId);
}

export async function removeManualPost(businessId: string, postId: string) {
  await requireBusinessAccess(businessId);
  await prisma.competitorPost.deleteMany({
    where: { id: postId, source: "manual", competitor: { businessId } },
  });
  back(businessId);
}

export async function generateIdeasFromCompetitors(businessId: string) {
  await requireBusinessAccess(businessId);
  const business = await prisma.business.findUniqueOrThrow({
    where: { id: businessId },
    include: { products: true, competitors: { include: { posts: true } } },
  });
  const ai = businessAi(business);
  if (!ai) back(businessId, { error: "Configura tu proveedor de IA para generar ideas." });

  // Best-performing first; manual posts without metrics go after.
  const posts: (CompetitorPostInput & { score: number })[] = business.competitors
    .flatMap((c) =>
      c.posts.map((p) => ({
        id: p.id,
        competitor: c.instagramUsername ? `${c.name} (@${c.instagramUsername})` : c.name,
        source: p.source as CompetitorPostInput["source"],
        mediaType: p.mediaType,
        caption: p.caption ?? "",
        likes: p.likeCount,
        comments: p.commentsCount,
        postedAt: p.postedAt,
        notes: p.notes,
        score: interactions(p) ?? -1,
      }))
    )
    .sort((a, b) => b.score - a.score)
    .slice(0, 30);

  if (posts.length < 2) {
    back(businessId, {
      error: "Necesitamos al menos 2 publicaciones de la competencia (de Instagram o registradas a mano) para proponer ideas con fundamento.",
    });
  }

  try {
    const { content, resolvedModel } = await generateCompetitorIdeas(ai, toAiBusiness(business), posts);
    await prisma.competitorIdeaBatch.create({
      data: { businessId, provider: ai.provider, model: resolvedModel, content: JSON.stringify(content) },
    });
  } catch (err) {
    back(businessId, { error: err instanceof Error ? err.message.slice(0, 300) : "Error al generar ideas." });
  }
  back(businessId, { ideas: "1" });
}
