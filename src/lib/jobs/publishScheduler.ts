import { runDuePublishJobs } from "@/lib/jobs/publishJobs";

// Polls scheduled publications every minute inside the web server process
// (single droplet, one instance — see docs/TECHNICAL_ARCHITECTURE.md).
// Started from src/instrumentation.ts in production only.
const TICK_MS = 60_000;

export function startPublishScheduler(): void {
  const g = globalThis as { __publishScheduler?: NodeJS.Timeout };
  if (g.__publishScheduler) return;
  const tick = () => void runDuePublishJobs();
  setTimeout(tick, 20_000);
  g.__publishScheduler = setInterval(tick, TICK_MS);
  console.log("[publishScheduler] started");
}
