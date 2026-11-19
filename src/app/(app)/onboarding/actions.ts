"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireEnabledAccount, requireBusinessAccess } from "@/lib/dal";
import { createDemoBusiness } from "@/lib/demoBusiness";
import { deleteBusinessFolder } from "@/lib/storage";

export type OnboardingState = {
  error?: string;
};

function requireField(formData: FormData, key: string): string {
  const value = formData.get(key);
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`El campo "${key}" es obligatorio.`);
  }
  return value.trim();
}

export async function createBusiness(
  _prevState: OnboardingState,
  formData: FormData
): Promise<OnboardingState> {
  const user = await requireEnabledAccount();

  let businessId: string;

  try {
    const name = requireField(formData, "name");
    const industry = requireField(formData, "industry");
    const description = requireField(formData, "description");
    const targetAudience = requireField(formData, "targetAudience");
    const location = requireField(formData, "location");
    const objective = requireField(formData, "objective");

    const avgTicketRaw = formData.get("avgTicket");
    const avgTicket =
      typeof avgTicketRaw === "string" && avgTicketRaw.trim() !== ""
        ? Number(avgTicketRaw)
        : null;

    if (avgTicket !== null && Number.isNaN(avgTicket)) {
      return { error: "El ticket promedio debe ser un número válido." };
    }

    const productsRaw = formData.get("products");
    const productNames =
      typeof productsRaw === "string"
        ? productsRaw
            .split("\n")
            .map((p) => p.trim())
            .filter((p) => p.length > 0)
        : [];

    if (productNames.length === 0) {
      return {
        error: "Agrega al menos un producto o servicio principal.",
      };
    }

    const business = await prisma.business.create({
      data: {
        userId: user.id,
        name,
        industry,
        description,
        targetAudience,
        location,
        objective,
        avgTicket,
        products: {
          create: productNames.map((productName) => ({ name: productName })),
        },
      },
    });

    businessId = business.id;
  } catch (err) {
    return {
      error:
        err instanceof Error
          ? err.message
          : "Ocurrió un error al guardar tu negocio.",
    };
  }

  redirect(`/business/${businessId}`);
}

// Fictional business to explore the app (lib/demoBusiness.ts). One per user.
export async function createDemo() {
  const user = await requireEnabledAccount();
  const id = await createDemoBusiness(user.id);
  redirect(`/business/${id}`);
}

// Only demo businesses can be deleted from the app for now.
export async function deleteDemoBusiness(businessId: string) {
  const { business } = await requireBusinessAccess(businessId, "manage_settings");
  if (!business.isDemo) redirect(`/business/${businessId}`);
  await prisma.business.delete({ where: { id: businessId } });
  // Files of the demo, if the user uploaded any while exploring.
  await deleteBusinessFolder(businessId).catch(() => {});
  redirect("/start");
}
