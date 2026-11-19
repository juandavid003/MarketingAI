import { requireEnabledAccount } from "@/lib/dal";
import { PageHeader } from "@/components/ui/PageHeader";
import OnboardingForm from "./OnboardingForm";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { createDemo } from "./actions";

export default async function OnboardingPage() {
  await requireEnabledAccount();

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <PageHeader
        eyebrow="Paso 1 de 1"
        title="Cuéntanos sobre tu negocio"
        description="Con esta información tu equipo de marketing con IA empezará a analizar oportunidades para ti."
      />
      <Card className="mb-8 flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
        <p className="min-w-0 flex-1 text-muted">
          ¿Quieres ver primero cómo funciona? Crea una panadería de ejemplo con competidores, enlaces y
          leads inventados. La puedes eliminar cuando quieras.
        </p>
        <form action={createDemo}>
          <Button type="submit" size="sm" variant="secondary">
            Explorar con un negocio de ejemplo
          </Button>
        </form>
      </Card>
      <OnboardingForm />
    </main>
  );
}
