// ffmpeg failures carry its whole stderr (kilobytes of logs) in the message.
// Keep what's useful to show in the UI and store in the DB.
export function shortErrorMessage(err: unknown, fallback: string, max = 300): string {
  const message = err instanceof Error ? err.message : fallback;
  if (message.length <= max) return message;
  const lastLines = message.trim().split(/\r?\n/).slice(-3).join(" ");
  return `${message.slice(0, 120)}… ${lastLines.slice(-(max - 125))}`;
}
