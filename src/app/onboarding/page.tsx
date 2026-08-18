import OnboardingForm from "./OnboardingForm";

export default function OnboardingPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <div className="mb-10 space-y-2">
        <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
          Paso 1 de 1
        </p>
        <h1 className="text-2xl font-semibold">Cuéntanos sobre tu negocio</h1>
        <p className="text-neutral-600 dark:text-neutral-400">
          Con esta información tu equipo de marketing con IA empezará a
          analizar oportunidades para ti.
        </p>
      </div>
      <OnboardingForm />
    </main>
  );
}
