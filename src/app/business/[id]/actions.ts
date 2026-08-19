"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { encryptSecret } from "@/lib/crypto";

export async function disconnectMeta(businessId: string) {
  await prisma.socialConnection.deleteMany({ where: { businessId } });
  revalidatePath(`/business/${businessId}`);
}

export type AiSettingsState = {
  error?: string;
  success?: boolean;
};

const KEY_PREFIXES: Record<string, string> = {
  anthropic: "sk-ant-",
  openai: "sk-",
};

export async function saveAiSettings(
  businessId: string,
  _prevState: AiSettingsState,
  formData: FormData
): Promise<AiSettingsState> {
  const provider = formData.get("provider");
  const apiKey = formData.get("apiKey");

  if (provider !== "anthropic" && provider !== "openai") {
    return { error: "Selecciona un proveedor válido." };
  }
  if (typeof apiKey !== "string" || apiKey.trim().length < 10) {
    return { error: "Ingresa una API key válida." };
  }

  const trimmed = apiKey.trim();
  const expectedPrefix = KEY_PREFIXES[provider];
  if (!trimmed.startsWith(expectedPrefix)) {
    return {
      error: `Las API keys de ${provider === "anthropic" ? "Anthropic" : "OpenAI"} suelen empezar con "${expectedPrefix}". Verifica que copiaste la key correcta.`,
    };
  }

  await prisma.business.update({
    where: { id: businessId },
    data: {
      aiProvider: provider,
      aiApiKeyEncrypted: encryptSecret(trimmed),
      aiConfiguredAt: new Date(),
    },
  });

  revalidatePath(`/business/${businessId}`);
  revalidatePath(`/business/${businessId}/settings`);
  return { success: true };
}

export async function clearAiSettings(businessId: string) {
  await prisma.business.update({
    where: { id: businessId },
    data: { aiProvider: null, aiApiKeyEncrypted: null, aiConfiguredAt: null },
  });
  revalidatePath(`/business/${businessId}`);
  revalidatePath(`/business/${businessId}/settings`);
}
