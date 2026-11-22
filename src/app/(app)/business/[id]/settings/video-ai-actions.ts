"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireBusinessAccess } from "@/lib/dal";
import { audit } from "@/lib/audit";
import { encryptSecret } from "@/lib/crypto";
import { VIDEO_PROVIDERS, getVideoProvider } from "@/lib/videoGen";
import { checkFalKey } from "@/lib/videoGen/providers/fal";
import type { AiSettingsState } from "../actions";

// AI video settings (lib/videoGen), owner only like every key:
// - preferred provider ("" = follow the per-scene recommendation),
// - a model per provider (empty = recommended default),
// - the fal.ai key, the only video key not saved elsewhere (Gemini and
//   OpenAI reuse the keys above in Settings).
export async function saveVideoAiSettings(
  businessId: string,
  _prev: AiSettingsState,
  formData: FormData
): Promise<AiSettingsState> {
  const { user } = await requireBusinessAccess(businessId, "manage_settings");

  const preferredRaw = String(formData.get("preferred") ?? "");
  const preferred = getVideoProvider(preferredRaw)?.id ?? null;
  if (preferredRaw && !preferred) return { error: "Proveedor desconocido." };

  const models: Record<string, string> = {};
  for (const p of VIDEO_PROVIDERS) {
    const m = String(formData.get(`model_${p.id}`) ?? "").trim().slice(0, 200);
    if (m) models[p.id] = m;
  }

  const falKey = String(formData.get("falKey") ?? "").trim();
  let warning: string | undefined;
  if (falKey) {
    if (falKey.length < 16) return { error: "La key de fal.ai parece incompleta." };
    const check = await checkFalKey(falKey);
    if (check.status === "invalid") return { error: check.message };
    warning = check.message;
  }

  await prisma.business.update({
    where: { id: businessId },
    data: {
      videoAiProvider: preferred,
      videoAiModels: Object.keys(models).length > 0 ? JSON.stringify(models) : null,
      ...(falKey ? { falApiKeyEncrypted: encryptSecret(falKey) } : {}),
    },
  });
  await audit({ action: "video_ai.updated", actor: user, businessId, details: { preferred, models, falUpdated: Boolean(falKey) } });
  revalidatePath(`/business/${businessId}/settings`);
  return { success: true, warning };
}

export async function clearFalKey(businessId: string) {
  const { user } = await requireBusinessAccess(businessId, "manage_settings");
  await audit({ action: "video_ai.cleared", actor: user, businessId, details: { provider: "fal" } });
  await prisma.business.update({ where: { id: businessId }, data: { falApiKeyEncrypted: null } });
  revalidatePath(`/business/${businessId}/settings`);
}
