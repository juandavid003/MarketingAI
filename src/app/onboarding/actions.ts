"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

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
