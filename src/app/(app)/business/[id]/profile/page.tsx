import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireBusinessAccess } from "@/lib/dal";
import { profileCompleteness } from "@/lib/profileCompleteness";
import { PageHeader } from "@/components/ui/PageHeader";
import ProfileForm from "./ProfileForm";

export default async function BusinessProfileEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireBusinessAccess(id);

  const business = await prisma.business.findUnique({
    where: { id },
    include: { products: { orderBy: { createdAt: "asc" } } },
  });
  if (!business) notFound();

  const { percent, missing } = profileCompleteness(business);

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <PageHeader
        title="Perfil del negocio"
        description="La IA usa toda esta información para personalizar estrategias, guiones y textos. Mientras más completo, mejores resultados."
      />

      <div className="mb-8 rounded-lg border border-border p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">Perfil completo al {percent}%</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-border">
          <div className="h-full rounded-full bg-brand" style={{ width: `${percent}%` }} />
        </div>
        {missing.length > 0 && (
          <p className="mt-2 text-xs text-muted">Falta: {missing.join(", ")}.</p>
        )}
      </div>

      <ProfileForm
        businessId={business.id}
        initial={{
          name: business.name,
          industry: business.industry,
          subIndustry: business.subIndustry ?? "",
          description: business.description,
          products: business.products.map((p) => p.name).join("\n"),
          avgTicket: business.avgTicket != null ? String(business.avgTicket) : "",
          valueProposition: business.valueProposition ?? "",
          targetAudience: business.targetAudience,
          customerPersonas: business.customerPersonas ?? "",
          location: business.location,
          serviceArea: business.serviceArea ?? "",
          objective: business.objective,
          businessGoals: business.businessGoals ?? "",
          conversionGoal: business.conversionGoal ?? "",
          brandTone: business.brandTone ?? "",
          brandColors: business.brandColors ?? "",
          contentLanguage: business.contentLanguage,
          mainPlatforms: business.mainPlatforms,
          preferredCtas: business.preferredCtas ?? "",
          websiteUrl: business.websiteUrl ?? "",
          whatsapp: business.whatsapp ?? "",
          contactEmail: business.contactEmail ?? "",
        }}
      />
    </main>
  );
}
