import { runDuePublishJobs } from "@/lib/jobs/publishJobs";
import { cleanupOldOriginals } from "@/lib/jobs/storageCleanup";

// Polls scheduled publications every minute inside the web server process
// (single droplet, one instance — see docs/TECHNICAL_ARCHITECTURE.md).
// Started from src/instrumentation.ts in production only.
const TICK_MS = 60_000;
// Storage cleanup (lib/jobs/storageCleanup.ts) piggybacks on the same
// process: once shortly after start, then every 6 hours.
const CLEANUP_MS = 6 * 60 * 60_000;

export function startPublishScheduler(): void {
  const g = globalThis as { __publishScheduler?: NodeJS.Timeout };
  if (g.__publishScheduler) return;
  const tick = () => void runDuePublishJobs();
  setTimeout(tick, 20_000);
  g.__publishScheduler = setInterval(tick, TICK_MS);
  const cleanup = () =>
    void cleanupOldOriginals()
      .then((n) => n > 0 && console.log(`[storageCleanup] deleted ${n} originals`))
      .catch((err) => console.error("[storageCleanup]", err));
  setTimeout(cleanup, 5 * 60_000);
  setInterval(cleanup, CLEANUP_MS);
  console.log("[publishScheduler] started");
}
