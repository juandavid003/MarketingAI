import { prisma } from "@/lib/prisma";
import { decryptToken } from "@/lib/crypto";
import { publishPageVideo } from "@/lib/meta";
import { readStored } from "@/lib/storage";
import { signedMediaUrl } from "@/lib/signedMedia";
import { shortErrorMessage } from "@/lib/errors";
import {
  createReelContainer,
  containerStatus,
  publishContainer,
  InstagramPermissionError,
} from "@/lib/instagramPublish";

// Runs scheduled PublishJobs (polled every minute by lib/jobs/
// publishScheduler.ts, and right away for "publish now").
//
//   scheduled ──claim──▶ publishing ──▶ published
//                          │  (Instagram: container processing, polled
//                          │   every 30 s until FINISHED, max 30 min)
//                          └──error──▶ scheduled again (retry in 5 / 20 min)
//                                      or failed after 3 attempts / a
//                                      permission error (no point retrying)
//
// "manual" jobs are reminders for networks we can't post to directly; the
// owner marks them published, so they are never picked up here.

export const AUTO_TARGETS = ["facebook_page", "instagram_reels"] as const;
export const MAX_ATTEMPTS = 3;
const RETRY_DELAYS_MS = [5 * 60_000, 20 * 60_000];
const CONTAINER_POLL_MS = 30_000;
const CONTAINER_TIMEOUT_MS = 30 * 60_000;
const STALE_PUBLISHING_MS = 15 * 60_000;

export function retryDelayMs(attemptsSoFar: number): number | null {
  return attemptsSoFar < MAX_ATTEMPTS ? RETRY_DELAYS_MS[Math.min(attemptsSoFar - 1, RETRY_DELAYS_MS.length - 1)] : null;
}

// "container:<id>:<startedAtMs>" — the Instagram container being processed.
export function parseContainerRef(ref: string | null): { id: string; startedAt: number } | null {
  const m = ref?.match(/^container:([^:]+):(\d+)$/);
  return m ? { id: m[1], startedAt: Number(m[2]) } : null;
}

type Job = NonNullable<Awaited<ReturnType<typeof loadJob>>>;

function loadJob(id: string) {
  return prisma.publishJob.findUnique({
    where: { id },
    include: { videoVersion: { include: { videoAsset: { select: { businessId: true } } } } },
  });
}

// One run at a time per process (scheduler tick and "publish now" share it).
export function runDuePublishJobs(): Promise<void> {
  const g = globalThis as { __publishRun?: Promise<void> };
  if (!g.__publishRun) {
    g.__publishRun = runOnce()
      .catch((err) => console.error("[publishJobs]", err))
      .finally(() => {
        g.__publishRun = undefined;
      });
  }
  return g.__publishRun;
}

async function runOnce(): Promise<void> {
  const now = new Date();

  // 1) Instagram containers still processing.
  const polling = await prisma.publishJob.findMany({
    where: { status: "publishing", target: "instagram_reels", externalId: { startsWith: "container:" }, nextAttemptAt: { lte: now } },
    take: 10,
  });
  for (const { id } of polling) {
    const job = await loadJob(id);
    if (job) await pollInstagram(job).catch((err) => failAttempt(job, err));
  }

  // 2) Uploads interrupted by a restart (no container, stuck in publishing).
  const stale = await prisma.publishJob.findMany({
    where: {
      status: "publishing",
      updatedAt: { lt: new Date(now.getTime() - STALE_PUBLISHING_MS) },
      OR: [{ externalId: null }, { NOT: { externalId: { startsWith: "container:" } } }],
    },
    take: 10,
  });
  for (const { id } of stale) {
    const job = await loadJob(id);
    if (job) await failAttempt(job, new Error("La publicación se interrumpió."));
  }

  // 3) Due jobs.
  const due = await prisma.publishJob.findMany({
    where: {
      status: "scheduled",
      target: { in: [...AUTO_TARGETS] },
      scheduledAt: { lte: now },
      OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }],
    },
    orderBy: { scheduledAt: "asc" },
    take: 5,
  });
  for (const { id } of due) {
    const claimed = await prisma.publishJob.updateMany({
      where: { id, status: "scheduled" },
      data: { status: "publishing", lastError: null },
    });
    if (claimed.count === 0) continue;
    const job = await loadJob(id);
    if (job) await start(job).catch((err) => failAttempt(job, err));
  }
}

async function pageFor(job: Job) {
  const page = job.socialPageId
    ? await prisma.socialPage.findFirst({ where: { id: job.socialPageId, connection: { businessId: job.businessId } } })
    : null;
  if (!page) throw new InstagramPermissionError("La página conectada ya no existe. Reconecta Meta y vuelve a programar.");
  return page;
}

async function start(job: Job): Promise<void> {
  if (job.videoVersion.videoAsset.businessId !== job.businessId) throw new Error("Video inválido.");
  const page = await pageFor(job);
  const token = decryptToken(page.pageAccessToken);

  if (job.target === "facebook_page") {
    const buffer = await readStored(job.videoVersion.outputPath);
    const { videoId, permalinkUrl } = await publishPageVideo(page.facebookPageId, token, buffer, job.caption);
    await prisma.publishedVideo.create({
      data: {
        videoVersionId: job.videoVersionId,
        facebookPageId: page.facebookPageId,
        pageName: page.name,
        facebookVideoId: videoId,
        permalinkUrl,
        message: job.caption,
      },
    });
    await succeed(job, videoId, permalinkUrl);
    return;
  }

  if (!page.instagramAccountId) {
    throw new InstagramPermissionError("Esta página no tiene una cuenta de Instagram profesional vinculada.");
  }
  const containerId = await createReelContainer({
    igUserId: page.instagramAccountId,
    accessToken: token,
    videoUrl: signedMediaUrl(job.videoVersion.outputPath, 2 * 3600),
    caption: job.caption,
    coverUrl: job.videoVersion.thumbnailPath ? signedMediaUrl(job.videoVersion.thumbnailPath, 2 * 3600) : null,
  });
  await prisma.publishJob.update({
    where: { id: job.id },
    data: { externalId: `container:${containerId}:${Date.now()}`, nextAttemptAt: new Date(Date.now() + CONTAINER_POLL_MS) },
  });
}

async function pollInstagram(job: Job): Promise<void> {
  const ref = parseContainerRef(job.externalId);
  if (!ref) throw new Error("Contenedor de Instagram inválido.");
  const page = await pageFor(job);
  const token = decryptToken(page.pageAccessToken);
  const { status, detail } = await containerStatus(ref.id, token);

  if (status === "FINISHED") {
    const { mediaId, permalink } = await publishContainer({ igUserId: page.instagramAccountId!, accessToken: token, containerId: ref.id });
    await succeed(job, mediaId, permalink);
  } else if (status === "IN_PROGRESS") {
    if (Date.now() - ref.startedAt > CONTAINER_TIMEOUT_MS) throw new Error("Instagram tardó demasiado en procesar el video.");
    await prisma.publishJob.update({ where: { id: job.id }, data: { nextAttemptAt: new Date(Date.now() + CONTAINER_POLL_MS) } });
  } else {
    throw new Error(`Instagram no pudo procesar el video (${status}${detail ? `: ${detail}` : ""}).`);
  }
}

async function succeed(job: Job, externalId: string, permalink: string | null): Promise<void> {
  await prisma.publishJob.update({
    where: { id: job.id },
    data: { status: "published", externalId, permalink, publishedAt: new Date(), lastError: null, nextAttemptAt: null },
  });
  if (job.planItemId) {
    await prisma.contentPlanItem
      .update({ where: { id: job.planItemId }, data: { status: "published", publishedUrl: permalink ?? undefined } })
      .catch(() => {});
  }
}

async function failAttempt(job: Job, err: unknown): Promise<void> {
  const attempts = job.attempts + 1;
  const message = shortErrorMessage(err, "Error al publicar.");
  const delay = err instanceof InstagramPermissionError ? null : retryDelayMs(attempts);
  console.error(`[publishJobs ${job.id}] attempt ${attempts}:`, err);
  await prisma.publishJob.update({
    where: { id: job.id },
    data: {
      attempts,
      lastError: message,
      externalId: null,
      ...(delay != null
        ? { status: "scheduled", nextAttemptAt: new Date(Date.now() + delay) }
        : { status: "failed", nextAttemptAt: null }),
    },
  });
}
