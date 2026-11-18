"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireBusinessAccess } from "@/lib/dal";
import { newSlug, normalizeDestination, slugifyUtm, whatsAppUrl } from "@/lib/links";
import { normalizePromoCode } from "@/lib/leads";

const linksPath = (businessId: string) => `/business/${businessId}/links`;
const text = (fd: FormData, name: string, max: number) => String(fd.get(name) ?? "").trim().slice(0, max);
const fail = (businessId: string, message: string): never =>
  redirect(`${linksPath(businessId)}?error=${encodeURIComponent(message)}`);

async function ownedCampaignAndPiece(businessId: string, fd: FormData) {
  const campaignId = text(fd, "campaignId", 60) || null;
  const pieceId = text(fd, "contentPieceId", 60) || null;
  const [campaign, piece] = await Promise.all([
    campaignId ? prisma.campaign.findFirst({ where: { id: campaignId, businessId } }) : null,
    pieceId ? prisma.contentPiece.findFirst({ where: { id: pieceId, businessId } }) : null,
  ]);
  return { campaign, piece };
}

export async function createTrackedLink(businessId: string, formData: FormData) {
  const { business } = await requireBusinessAccess(businessId);
  const label = text(formData, "label", 120);
  if (!label) fail(businessId, "Ponle un nombre al enlace (ej. Bio de Instagram, Reel de blanqueamiento).");

  const kind = text(formData, "kind", 20);
  const slug = newSlug();
  let destination: string | null;
  if (kind === "whatsapp") {
    const phone = text(formData, "phone", 30) || business.whatsapp || "";
    const message = text(formData, "message", 500);
    // The ref lets the owner match an incoming chat to this link.
    destination = whatsAppUrl(phone, `${message || "Hola, quiero más información"} (ref: ${slug})`);
    if (!destination) fail(businessId, "Escribe un número de WhatsApp válido, con código de país.");
  } else {
    destination = normalizeDestination(text(formData, "destination", 1000));
    if (!destination) fail(businessId, "Escribe una dirección web válida (ej. https://tusitio.com/oferta).");
  }

  const { campaign, piece } = await ownedCampaignAndPiece(businessId, formData);
  const source = text(formData, "utmSource", 60) || "social";
  await prisma.trackedLink.create({
    data: {
      businessId,
      slug,
      label,
      destinationUrl: destination!,
      utmSource: slugifyUtm(source),
      utmMedium: slugifyUtm(text(formData, "utmMedium", 60) || "organic"),
      utmCampaign: slugifyUtm(campaign?.title ?? label),
      utmContent: piece ? slugifyUtm(piece.hook).slice(0, 40) : null,
      campaignId: campaign?.id ?? null,
      contentPieceId: piece?.id ?? null,
    },
  });
  revalidatePath(linksPath(businessId));
  redirect(`${linksPath(businessId)}?created=${slug}`);
}

export async function setLinkArchived(businessId: string, linkId: string, archived: boolean) {
  await requireBusinessAccess(businessId);
  await prisma.trackedLink.updateMany({ where: { id: linkId, businessId }, data: { archived } });
  revalidatePath(linksPath(businessId));
}

export async function createPromoCode(businessId: string, formData: FormData) {
  await requireBusinessAccess(businessId);
  const code = normalizePromoCode(text(formData, "code", 40));
  if (!code) fail(businessId, "El código debe tener de 3 a 30 letras, números, guiones o guiones bajos.");
  const exists = await prisma.promoCode.findUnique({ where: { businessId_code: { businessId, code: code! } } });
  if (exists) fail(businessId, `Ya tienes el código ${code}.`);
  const { campaign, piece } = await ownedCampaignAndPiece(businessId, formData);
  await prisma.promoCode.create({
    data: {
      businessId,
      code: code!,
      description: text(formData, "description", 200) || null,
      campaignId: campaign?.id ?? null,
      contentPieceId: piece?.id ?? null,
    },
  });
  revalidatePath(linksPath(businessId));
  redirect(linksPath(businessId));
}

export async function setPromoCodeActive(businessId: string, codeId: string, active: boolean) {
  await requireBusinessAccess(businessId);
  await prisma.promoCode.updateMany({ where: { id: codeId, businessId }, data: { active } });
  revalidatePath(linksPath(businessId));
}
