import { requireEnabledAccount } from "@/lib/dal";
import { PageHeader } from "@/components/ui/PageHeader";
import OnboardingForm from "./OnboardingForm";

export default async function OnboardingPage() {
  await requireEnabledAccount();

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <PageHeader
        eyebrow="Paso 1 de 1"
        title="Cuéntanos sobre tu negocio"
        description="Con esta información tu equipo de marketing con IA empezará a analizar oportunidades para ti."
      />
      <OnboardingForm />
    </main>
  );
}
