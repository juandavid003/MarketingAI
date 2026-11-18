"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireBusinessAccess } from "@/lib/dal";
import { OBJECTIVES, PLATFORMS, CONTENT_LANGUAGES } from "@/lib/constants";
import { redirect } from "next/navigation";
import { storageKey, saveUpload, deleteStored } from "@/lib/storage";

export type ProfileFormState = {
  error?: string;
  success?: boolean;
};

const MAX_TEXT = 2000;

function text(formData: FormData, key: string): string | null {
  const value = formData.get(key);
  if (typeof value !== "string") return null;
  const trimmed = value.trim().slice(0, MAX_TEXT);
  return trimmed.length > 0 ? trimmed : null;
}

function required(formData: FormData, key: string, label: string): string {
  const value = text(formData, key);
  if (!value) throw new Error(`"${label}" es obligatorio.`);
  return value;
}

function normalizeUrl(raw: string | null): string | null {
  if (!raw) return null;
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const url = new URL(withScheme);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    throw new Error("El sitio web no es una URL válida.");
  }
}

function normalizeColors(raw: string | null): string | null {
  if (!raw) return null;
  const colors = raw
    .split(/[,\s]+/)
    .map((c) => c.trim())
    .filter(Boolean)
    .map((c) => (c.startsWith("#") ? c : `#${c}`));
  for (const c of colors) {
    if (!/^#[0-9a-fA-F]{6}$/.test(c)) {
      throw new Error(`"${c}" no es un color hex válido (ej. #0EA5E9).`);
    }
  }
  return colors.slice(0, 5).join(", ").toUpperCase();
}

export async function updateBusinessProfile(
  businessId: string,
  _prev: ProfileFormState,
  formData: FormData
): Promise<ProfileFormState> {
  await requireBusinessAccess(businessId);

  try {
    const objective = required(formData, "objective", "Objetivo de marketing");
    if (!OBJECTIVES.some((o) => o.value === objective)) {
      throw new Error("Selecciona un objetivo válido.");
    }

    const contentLanguage = text(formData, "contentLanguage") ?? "es";
    if (!CONTENT_LANGUAGES.some((l) => l.value === contentLanguage)) {
      throw new Error("Selecciona un idioma válido.");
    }

    const allowedPlatforms = new Set<string>(PLATFORMS.map((p) => p.value));
    const mainPlatforms = formData
      .getAll("mainPlatforms")
      .filter((p): p is string => typeof p === "string" && allowedPlatforms.has(p));

    const avgTicketRaw = text(formData, "avgTicket");
    const avgTicket = avgTicketRaw === null ? null : Number(avgTicketRaw);
    if (avgTicket !== null && (Number.isNaN(avgTicket) || avgTicket < 0)) {
      throw new Error("El ticket promedio debe ser un número válido.");
    }

    const productNames = (text(formData, "products") ?? "")
      .split("\n")
      .map((p) => p.trim())
      .filter(Boolean)
      .slice(0, 50);
    if (productNames.length === 0) {
      throw new Error("Agrega al menos un producto o servicio.");
    }

    const data = {
      name: required(formData, "name", "Nombre del negocio"),
      industry: required(formData, "industry", "Industria"),
      subIndustry: text(formData, "subIndustry"),
      description: required(formData, "description", "¿Qué vendes?"),
      avgTicket,
      valueProposition: text(formData, "valueProposition"),
      targetAudience: required(formData, "targetAudience", "Público objetivo"),
      customerPersonas: text(formData, "customerPersonas"),
      location: required(formData, "location", "Ubicación"),
      serviceArea: text(formData, "serviceArea"),
      objective,
      businessGoals: text(formData, "businessGoals"),
      conversionGoal: text(formData, "conversionGoal"),
      brandTone: text(formData, "brandTone"),
      brandColors: normalizeColors(text(formData, "brandColors")),
      contentLanguage,
      mainPlatforms,
      preferredCtas: text(formData, "preferredCtas"),
      websiteUrl: normalizeUrl(text(formData, "websiteUrl")),
      whatsapp: text(formData, "whatsapp"),
      contactEmail: text(formData, "contactEmail"),
    };

    // Products are just names with no dependent rows, so replacing the list
    // wholesale is safe and keeps the form a simple one-per-line textarea.
    await prisma.$transaction([
      prisma.business.update({ where: { id: businessId }, data }),
      prisma.product.deleteMany({ where: { businessId } }),
      prisma.product.createMany({ data: productNames.map((name) => ({ businessId, name })) }),
    ]);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "No se pudo guardar el perfil." };
  }

  revalidatePath(`/business/${businessId}`);
  revalidatePath(`/business/${businessId}/profile`);
  return { success: true };
}

// ---------------------------------------------------------------------------
// Brand logo (overlaid on assembled videos, lib/videoEdit.ts renderFinal)
// ---------------------------------------------------------------------------

const LOGO_TYPES: Record<string, string> = { "image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp" };
const MAX_LOGO_BYTES = 2 * 1024 * 1024;

export async function uploadLogo(businessId: string, formData: FormData) {
  const { business } = await requireBusinessAccess(businessId);
  const file = formData.get("logo");
  const back = (error?: string) =>
    redirect(`/business/${businessId}/profile${error ? `?logo_error=${encodeURIComponent(error)}` : "?logo=1"}#logo`);
  if (!(file instanceof File) || file.size === 0) back("Elige una imagen.");
  const f = file as File;
  const ext = LOGO_TYPES[f.type];
  if (!ext) back("El logo debe ser PNG, JPG o WEBP (mejor PNG con fondo transparente).");
  if (f.size > MAX_LOGO_BYTES) back("El logo debe pesar menos de 2 MB.");

  const key = storageKey(businessId, "brand", `logo-${Date.now()}${ext}`);
  await saveUpload(key, f);
  await prisma.business.update({ where: { id: businessId }, data: { logoPath: key } });
  if (business.logoPath) await deleteStored(business.logoPath).catch(() => {});
  revalidatePath(`/business/${businessId}/profile`);
  back();
}

export async function removeLogo(businessId: string) {
  const { business } = await requireBusinessAccess(businessId);
  await prisma.business.update({ where: { id: businessId }, data: { logoPath: null } });
  if (business.logoPath) await deleteStored(business.logoPath).catch(() => {});
  revalidatePath(`/business/${businessId}/profile`);
}
