import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireBusinessAccess } from "@/lib/dal";
import { profileCompleteness } from "@/lib/profileCompleteness";
import { PageHeader } from "@/components/ui/PageHeader";
import ProfileForm from "./ProfileForm";
import { uploadLogo, removeLogo } from "./actions";
import { fileUrl } from "@/lib/storage";
import { Button } from "@/components/ui/Button";

export default async function BusinessProfileEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ logo?: string; logo_error?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
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

      <section id="logo" className="mb-8 rounded-lg border border-border p-4">
        <p className="font-medium">Logo de la marca</p>
        <p className="mt-1 text-sm text-muted">
          Aparece pequeño en la esquina superior izquierda de los videos que armamos y de los creativos. Mejor PNG con
          fondo transparente.
        </p>
        {sp.logo_error && <p className="mt-2 text-sm text-red-700 dark:text-red-400">{sp.logo_error}</p>}
        {sp.logo === "1" && <p className="mt-2 text-sm text-green-700 dark:text-green-400">Logo guardado. Se usará en los próximos videos que armes.</p>}
        <div className="mt-3 flex flex-wrap items-center gap-4">
          {business.logoPath && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={fileUrl(business.logoPath)} alt="Logo actual" className="h-14 max-w-32 rounded border border-border bg-[repeating-conic-gradient(#e5e5e5_0_25%,transparent_0_50%)] bg-[length:12px_12px] object-contain p-1" />
          )}
          <form action={uploadLogo.bind(null, business.id)} className="flex flex-wrap items-center gap-2">
            <input name="logo" type="file" accept="image/png,image/jpeg,image/webp" required className="text-sm" />
            <Button type="submit" size="sm" variant="secondary">
              {business.logoPath ? "Cambiar logo" : "Subir logo"}
            </Button>
          </form>
          {business.logoPath && (
            <form action={removeLogo.bind(null, business.id)}>
              <button type="submit" className="text-xs text-faint hover:text-red-600">
                Quitar
              </button>
            </form>
          )}
        </div>
      </section>

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
