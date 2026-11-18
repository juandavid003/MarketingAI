// Runs once when the server starts. In production it starts the publishing
// scheduler (lib/jobs/publishScheduler.ts). Off in development — dev talks
// to the production database, so a local server must never publish.
// PUBLISH_SCHEDULER=off disables it in production too.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NODE_ENV !== "production" || process.env.PUBLISH_SCHEDULER === "off") return;
  const { startPublishScheduler } = await import("./lib/jobs/publishScheduler");
  startPublishScheduler();
}
