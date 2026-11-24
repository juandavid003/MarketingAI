import "server-only";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";

// Audit trail for sensitive actions: API keys, social connections, publishing,
// account activation, team members. Never blocks the action it records — a
// failed insert is logged and swallowed.
//
// details must never carry secrets: sanitizeDetails drops any key that looks
// like one (key, token, secret, password), whatever the caller passes.

export type AuditAction =
  | "ai_key.updated"
  | "ai_key.cleared"
  | "transcription_key.cleared"
  | "image_key.cleared"
  | "gemini_key.updated"
  | "gemini_key.cleared"
  | "video_ai.updated"
  | "video_ai.cleared"
  | "meta.connected"
  | "meta.disconnected"
  | "publish.now"
  | "publish.scheduled"
  | "publish.canceled"
  | "publish.retried"
  | "publish.marked_done"
  | "publish.succeeded"
  | "publish.failed"
  | "account.enabled"
  | "account.disabled"
  | "member.invited"
  | "member.accepted"
  | "member.removed"
  | "storage.originals_cleaned"
  | "video.ai_edit";

const SECRET_KEY = /key|token|secret|password|authorization/i;

export function sanitizeDetails(details: Record<string, unknown> | undefined): string | null {
  if (!details) return null;
  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(details)) {
    if (SECRET_KEY.test(k)) continue;
    clean[k] = typeof v === "string" ? v.slice(0, 500) : v;
  }
  return Object.keys(clean).length > 0 ? JSON.stringify(clean) : null;
}

async function requestIp(): Promise<string | null> {
  try {
    const h = await headers();
    return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
  } catch {
    return null; // outside a request (scheduler)
  }
}

export async function audit(event: {
  action: AuditAction;
  actor?: { id: string; email?: string | null } | null;
  businessId?: string | null;
  target?: string | null;
  details?: Record<string, unknown>;
}): Promise<void> {
  try {
    await prisma.auditEvent.create({
      data: {
        action: event.action,
        actorId: event.actor?.id ?? null,
        actorEmail: event.actor?.email ?? null,
        businessId: event.businessId ?? null,
        target: event.target ?? null,
        details: sanitizeDetails(event.details),
        ip: event.actor ? await requestIp() : null,
      },
    });
  } catch (err) {
    console.error("[audit] could not record", event.action, err);
  }
}

export const AUDIT_LABEL: Record<string, string> = {
  "ai_key.updated": "Configuró la IA (proveedor/API key)",
  "ai_key.cleared": "Quitó la API key de IA",
  "transcription_key.cleared": "Quitó la key de transcripción",
  "image_key.cleared": "Quitó la key de imágenes",
  "gemini_key.updated": "Guardó la key de Gemini",
  "gemini_key.cleared": "Quitó la key de Gemini",
  "meta.connected": "Conectó Facebook/Instagram",
  "meta.disconnected": "Desconectó Facebook/Instagram",
  "publish.now": "Publicó ahora",
  "publish.scheduled": "Programó una publicación",
  "publish.canceled": "Canceló una publicación",
  "publish.retried": "Reintentó una publicación",
  "publish.marked_done": "Marcó como publicado a mano",
  "publish.succeeded": "Publicación completada",
  "publish.failed": "Publicación fallida",
  "account.enabled": "Activó una cuenta",
  "account.disabled": "Desactivó una cuenta",
  "member.invited": "Invitó a un encargado",
  "member.accepted": "Aceptó la invitación",
  "member.removed": "Quitó a un encargado",
  "storage.originals_cleaned": "Limpieza de videos originales",
  "video.ai_edit": "Editó un video con IA",
};
