"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireBusinessAccess } from "@/lib/dal";
import { LEAD_SOURCES, LEAD_STATUSES, attributionFor, parseMoney } from "@/lib/leads";
import { dayFromIso } from "@/lib/contentPlan";

const leadsPath = (businessId: string) => `/business/${businessId}/leads`;
const text = (fd: FormData, name: string, max: number) => String(fd.get(name) ?? "").trim().slice(0, max);

// Only ids of this business are accepted; picking a link or code implies the
// lead's campaign/content when those were set on the link or code.
async function resolveRefs(businessId: string, fd: FormData) {
  const pick = (name: string) => text(fd, name, 60) || null;
  const [link, code, campaign, piece] = await Promise.all([
    pick("trackedLinkId") ? prisma.trackedLink.findFirst({ where: { id: pick("trackedLinkId")!, businessId } }) : null,
    pick("promoCodeId") ? prisma.promoCode.findFirst({ where: { id: pick("promoCodeId")!, businessId } }) : null,
    pick("campaignId") ? prisma.campaign.findFirst({ where: { id: pick("campaignId")!, businessId } }) : null,
    pick("contentPieceId") ? prisma.contentPiece.findFirst({ where: { id: pick("contentPieceId")!, businessId } }) : null,
  ]);
  const refs = {
    trackedLinkId: link?.id ?? null,
    promoCodeId: code?.id ?? null,
    campaignId: campaign?.id ?? link?.campaignId ?? code?.campaignId ?? null,
    contentPieceId: piece?.id ?? link?.contentPieceId ?? code?.contentPieceId ?? null,
  };
  return { ...refs, attribution: attributionFor(refs) };
}

export async function createLead(businessId: string, formData: FormData) {
  await requireBusinessAccess(businessId);
  const sourceRaw = text(formData, "source", 30);
  const refs = await resolveRefs(businessId, formData);
  const source = refs.promoCodeId
    ? "promo_code"
    : refs.trackedLinkId && !LEAD_SOURCES.some((s) => s.value === sourceRaw)
      ? "tracked_link"
      : LEAD_SOURCES.some((s) => s.value === sourceRaw)
        ? sourceRaw
        : "other";
  const status = text(formData, "status", 20);
  const occurredAt = dayFromIso(text(formData, "occurredAt", 10)) ?? new Date();

  await prisma.lead.create({
    data: {
      businessId,
      name: text(formData, "name", 120) || null,
      contact: text(formData, "contact", 120) || null,
      source,
      status: LEAD_STATUSES.some((s) => s.value === status) ? status : "new",
      value: parseMoney(text(formData, "value", 30)),
      notes: text(formData, "notes", 500) || null,
      occurredAt,
      ...refs,
    },
  });
  revalidatePath(leadsPath(businessId));
  redirect(`${leadsPath(businessId)}?saved=1`);
}

export async function updateLeadStatus(businessId: string, leadId: string, formData: FormData) {
  await requireBusinessAccess(businessId);
  const status = text(formData, "status", 20);
  const value = parseMoney(text(formData, "value", 30));
  if (!LEAD_STATUSES.some((s) => s.value === status)) return;
  await prisma.lead.updateMany({
    where: { id: leadId, businessId },
    data: { status, ...(text(formData, "value", 30) ? { value } : {}) },
  });
  revalidatePath(leadsPath(businessId));
}

export async function deleteLead(businessId: string, leadId: string) {
  await requireBusinessAccess(businessId);
  await prisma.lead.deleteMany({ where: { id: leadId, businessId } });
  revalidatePath(leadsPath(businessId));
}
