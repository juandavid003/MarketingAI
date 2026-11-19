// Usage limits per business for the paid pilot: video minutes uploaded per
// calendar month and disk space. They protect the single 2 GB droplet (CPU
// for ffmpeg, disk for media) — AI usage is not metered here because each
// client pays their own AI keys.
//
// Limits are env-tunable so the admin can raise them without a deploy of
// new code. The pure part (checkUpload, monthStart) is unit-tested.

export const DEFAULT_VIDEO_MINUTES_PER_MONTH = 120;
export const DEFAULT_STORAGE_GB = 10;
// Uploaded originals of an edited video are deleted this many days after it
// is ready; the rendered versions are kept (lib/jobs/storageCleanup.ts).
export const ORIGINAL_RETENTION_DAYS = 30;

function envNumber(name: string, fallback: number): number {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export type UsageLimits = { videoMinutesPerMonth: number; storageBytes: number };

export function usageLimits(): UsageLimits {
  return {
    videoMinutesPerMonth: envNumber("USAGE_VIDEO_MINUTES_PER_MONTH", DEFAULT_VIDEO_MINUTES_PER_MONTH),
    storageBytes: envNumber("USAGE_STORAGE_GB", DEFAULT_STORAGE_GB) * 1024 ** 3,
  };
}

export type Usage = { videoMinutes: number; storageBytes: number };

// First instant of the current calendar month, UTC.
export function monthStart(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

// null = allowed; otherwise the message shown to the user. Minutes are
// checked against what was already uploaded (the new file's duration isn't
// known until it's processed), so a month can end slightly over the limit.
export function checkUpload(usage: Usage, limits: UsageLimits, fileBytes: number): string | null {
  if (usage.videoMinutes >= limits.videoMinutesPerMonth) {
    return `Llegaste al límite de ${limits.videoMinutesPerMonth} minutos de video este mes. Se renueva el día 1; si necesitas más, escríbenos desde "Enviar comentarios".`;
  }
  if (usage.storageBytes + fileBytes > limits.storageBytes) {
    return `No queda espacio: usas ${formatBytes(usage.storageBytes)} de ${formatBytes(limits.storageBytes)}. Borra videos que ya no necesites o escríbenos.`;
  }
  return null;
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  if (bytes >= 1024 ** 2) return `${Math.round(bytes / 1024 ** 2)} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}
