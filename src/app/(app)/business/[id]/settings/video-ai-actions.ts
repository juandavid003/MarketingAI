"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireBusinessAccess } from "@/lib/dal";
import { audit } from "@/lib/audit";
import { encryptSecret } from "@/lib/crypto";
import { getVideoProvider } from "@/lib/videoGen";
import type { AiSettingsState } from "../actions";

// AI video provider for generated scenes (lib/videoGen). Owner only, like
// every key. The key is optional when switching only the model, and for
// Gemini when the visual-review key already exists.
export async function saveVideoAiSettings(
  businessId: string,
  _prev: AiSettingsState,
  formData: FormData
): Promise<AiSettingsState> {
  const { user, business } = await requireBusinessAccess(businessId, "manage_settings");
  const provider = getVideoProvider(String(formData.get("provider") ?? ""));
  if (!provider) return { error: "Elige un proveedor de video." };

  const key = String(formData.get("apiKey") ?? "").trim();
  const model = String(formData.get("model") ?? "").trim().slice(0, 200) || null;
  const sameProvider = business.videoAiProvider === provider.id;
  const reusableGemini = provider.id === "gemini" && business.geminiApiKeyEncrypted != null;
  const keepsKey = sameProvider && business.videoAiKeyEncrypted != null;

  if (!key && !keepsKey && !reusableGemini) return { error: `Pega tu ${provider.keyLabel}.` };
  let warning: string | undefined;
  if (key) {
    if (key.length < 16) return { error: "Esa API key parece incompleta." };
    const check = await provider.checkKey(key);
    if (check.status === "invalid") return { error: check.message };
    warning = check.message;
  }

  await prisma.business.update({
    where: { id: businessId },
    data: {
      videoAiProvider: provider.id,
      videoAiModel: model,
      // A new key replaces the old one; switching provider without a key
      // drops the other provider's key (it wouldn't work here).
      ...(key ? { videoAiKeyEncrypted: encryptSecret(key) } : sameProvider ? {} : { videoAiKeyEncrypted: null }),
    },
  });
  await audit({ action: "video_ai.updated", actor: user, businessId, details: { provider: provider.id, model } });
  revalidatePath(`/business/${businessId}/settings`);
  return { success: true, warning };
}

export async function clearVideoAiSettings(businessId: string) {
  const { user } = await requireBusinessAccess(businessId, "manage_settings");
  await audit({ action: "video_ai.cleared", actor: user, businessId });
  await prisma.business.update({
    where: { id: businessId },
    data: { videoAiProvider: null, videoAiKeyEncrypted: null, videoAiModel: null },
  });
  revalidatePath(`/business/${businessId}/settings`);
}
