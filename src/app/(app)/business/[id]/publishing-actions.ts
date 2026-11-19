"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireBusinessAccess } from "@/lib/dal";
import { audit } from "@/lib/audit";
import { runDuePublishJobs } from "@/lib/jobs/publishJobs";
import { parseDestination, localInputToUtc, IG_PUBLISH_ENABLED } from "@/lib/publishing";

const publishingPath = (businessId: string) => `/business/${businessId}/publishing`;
const fail = (businessId: string, message: string): never =>
  redirect(`${publishingPath(businessId)}?error=${encodeURIComponent(message)}`);

export async function schedulePublication(businessId: string, formData: FormData) {
  const { user } = await requireBusinessAccess(businessId);
  const versionId = String(formData.get("versionId") ?? "");
  const destination = parseDestination(String(formData.get("destination") ?? ""));
  const caption = String(formData.get("caption") ?? "").trim().slice(0, 5000);
  const now = String(formData.get("when") ?? "") === "now";
  const planItemId = String(formData.get("planItemId") ?? "") || null;

  const version = await prisma.videoVersion.findFirst({
    where: { id: versionId, videoAsset: { businessId } },
    include: { videoAsset: { select: { status: true } } },
  });
  if (!version || version.videoAsset.status !== "ready") fail(businessId, "Elige un video listo.");
  if (!destination) fail(businessId, "Elige dónde publicar.");
  if (!caption) fail(businessId, "Escribe el texto de la publicación.");

  let socialPageId: string | null = null;
  if (destination!.target !== "manual") {
    const page = await prisma.socialPage.findFirst({
      where: { id: destination!.socialPageId, connection: { businessId } },
    });
    if (!page) fail(businessId, "Esa página ya no está conectada.");
    if (destination!.target === "instagram_reels") {
      if (!IG_PUBLISH_ENABLED) fail(businessId, "La publicación directa en Instagram aún no está activada.");
      if (!page!.instagramAccountId) fail(businessId, "Esa página no tiene una cuenta de Instagram profesional vinculada.");
    }
    socialPageId = page!.id;
  }

  const scheduledAt = now
    ? new Date()
    : localInputToUtc(String(formData.get("at") ?? ""), Number(formData.get("tzOffset")));
  if (!scheduledAt) fail(businessId, "Elige fecha y hora.");
  if (!now && scheduledAt!.getTime() < Date.now() - 5 * 60_000) fail(businessId, "Esa fecha ya pasó.");

  const item = planItemId
    ? await prisma.contentPlanItem.findFirst({ where: { id: planItemId, businessId }, select: { id: true } })
    : null;

  const job = await prisma.publishJob.create({
    data: {
      businessId,
      videoVersionId: version!.id,
      planItemId: item?.id ?? null,
      target: destination!.target,
      socialPageId,
      platform: destination!.platform,
      caption,
      scheduledAt: scheduledAt!,
    },
  });
  if (item) {
    await prisma.contentPlanItem.update({ where: { id: item.id }, data: { status: "ready" } });
  }
  await audit({
    action: now ? "publish.now" : "publish.scheduled",
    actor: user,
    businessId,
    target: job.id,
    details: { platform: job.platform, target: job.target, scheduledAt: job.scheduledAt.toISOString() },
  });
  if (now && destination!.target !== "manual") after(() => runDuePublishJobs());
  revalidatePath(publishingPath(businessId));
  redirect(`${publishingPath(businessId)}?saved=1`);
}

export async function cancelPublication(businessId: string, jobId: string) {
  const { user } = await requireBusinessAccess(businessId);
  const canceled = await prisma.publishJob.updateMany({
    where: { id: jobId, businessId, status: { in: ["scheduled", "failed"] } },
    data: { status: "canceled", nextAttemptAt: null },
  });
  if (canceled.count > 0) await audit({ action: "publish.canceled", actor: user, businessId, target: jobId });
  revalidatePath(publishingPath(businessId));
}

export async function retryPublication(businessId: string, jobId: string) {
  const { user } = await requireBusinessAccess(businessId);
  const updated = await prisma.publishJob.updateMany({
    where: { id: jobId, businessId, status: "failed" },
    data: { status: "scheduled", attempts: 0, nextAttemptAt: null, scheduledAt: new Date(), lastError: null },
  });
  if (updated.count > 0) {
    await audit({ action: "publish.retried", actor: user, businessId, target: jobId });
    after(() => runDuePublishJobs());
  }
  revalidatePath(publishingPath(businessId));
}

// Manual destinations: the owner posted it and pastes the link.
export async function markPublished(businessId: string, jobId: string, formData: FormData) {
  const { user } = await requireBusinessAccess(businessId);
  const job = await prisma.publishJob.findFirst({ where: { id: jobId, businessId, target: "manual" } });
  if (!job) return;
  const url = String(formData.get("url") ?? "").trim();
  const permalink = /^https?:\/\//i.test(url) ? url.slice(0, 500) : null;
  await prisma.publishJob.update({
    where: { id: jobId },
    data: { status: "published", publishedAt: new Date(), permalink },
  });
  await audit({ action: "publish.marked_done", actor: user, businessId, target: jobId, details: { platform: job.platform } });
  if (job.planItemId) {
    await prisma.contentPlanItem
      .update({ where: { id: job.planItemId }, data: { status: "published", publishedUrl: permalink ?? undefined } })
      .catch(() => {});
  }
  revalidatePath(publishingPath(businessId));
}
