import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { Card } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/Button";
import { Check } from "lucide-react";
import SubscribeButton from "./SubscribeButton";

const FEATURES = [
  "Negocios ilimitados",
  "Campañas y contenido generado con tu propia IA",
  "Publicar y pautar en Meta con tu propia cuenta",
  "Análisis de competencia",
];

export default async function PricingPage() {
  const session = await auth.api.getSession({ headers: await headers() });

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-16">
      <h1 className="text-2xl font-semibold">Un solo plan</h1>

      <Card className="mt-6">
        <p className="text-3xl font-semibold">
          $100<span className="text-base font-normal text-muted">/mes</span>
        </p>
        <ul className="mt-4 space-y-2 text-sm text-muted">
          {FEATURES.map((feature) => (
            <li key={feature} className="flex items-start gap-2">
              <Check className="mt-0.5 size-4 shrink-0 text-brand" />
              {feature}
            </li>
          ))}
        </ul>

        <div className="mt-6">
          {session ? (
            <SubscribeButton />
          ) : (
            <LinkButton href="/signup" className="w-full">
              Crea tu cuenta para suscribirte
            </LinkButton>
          )}
        </div>
      </Card>
    </main>
  );
}
