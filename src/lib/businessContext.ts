import type { Business, Product } from "@/generated/prisma/client";

// The single place that turns a Business row into the context every AI
// prompt receives. Previously each server action hand-copied the same seven
// fields; adding a profile field meant editing every call site.
export type AiBusinessContext = {
  name: string;
  industry: string;
  description: string;
  targetAudience: string;
  location: string;
  objective: string;
  products: { name: string }[];
};

export function toAiBusiness(business: Business & { products: Product[] }): AiBusinessContext {
  return {
    name: business.name,
    industry: business.industry,
    description: business.description,
    targetAudience: business.targetAudience,
    location: business.location,
    objective: business.objective,
    products: business.products.map((p) => ({ name: p.name })),
  };
}
