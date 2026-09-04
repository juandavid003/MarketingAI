import { headers } from "next/headers";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { LinkButton } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Radar, Wand2, Rocket, LineChart } from "lucide-react";

export default async function Home() {
  const session = await auth.api.getSession({ headers: await headers() });
  const ctaHref = session ? "/onboarding" : "/signup";

  return (
    <main className="flex-1">
      <section className="mx-auto max-w-3xl px-6 py-20 text-center">
        <p className="text-sm font-medium text-brand">Marketing con IA para negocios locales</p>
        <h1 className="mt-3 text-4xl font-semibold text-balance sm:text-5xl">
          Tu equipo de marketing, sin contratar un equipo
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-neutral-600 dark:text-neutral-400">
          Conecta tu negocio y deja que la IA descubra qué está funcionando, qué no, y qué
          deberías publicar esta semana para vender más.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <LinkButton href={ctaHref} size="lg">
            {session ? "Ir a mi cuenta" : "Crear cuenta"}
          </LinkButton>
          <LinkButton href="#precio" variant="secondary" size="lg">
            Ver precio
          </LinkButton>
        </div>
      </section>

      <section className="border-t border-border bg-surface">
        <div className="mx-auto grid max-w-5xl gap-6 px-6 py-16 sm:grid-cols-2 lg:grid-cols-4">
          <Feature
            icon={Radar}
            title="Observa"
            description="Analiza tu actividad real en Instagram y Facebook para encontrar qué contenido ya está funcionando."
          />
          <Feature
            icon={Wand2}
            title="Crea"
            description="Genera campañas, copys, imágenes y guiones de video con tu propio proveedor de IA."
          />
          <Feature
            icon={Rocket}
            title="Ejecuta"
            description="Publica en tus redes y pauta en Meta Ads con un clic — cada campaña empieza pausada, tú decides."
          />
          <Feature
            icon={LineChart}
            title="Aprende"
            description="Mide qué pieza rinde mejor y recibe recomendaciones para la siguiente campaña."
          />
        </div>
      </section>

      <section id="precio" className="mx-auto max-w-3xl px-6 py-16 text-center">
        <h2 className="text-2xl font-semibold">Un solo plan, sin sorpresas</h2>
        <Card className="mx-auto mt-6 max-w-xs">
          <p className="text-3xl font-semibold">
            $100<span className="text-base font-normal text-muted">/mes</span>
          </p>
          <p className="mt-2 text-sm text-muted">
            Negocios ilimitados. Pago por transferencia, activamos tu cuenta al confirmarlo.
          </p>
          <LinkButton href={ctaHref} className="mt-4 w-full">
            {session ? "Ir a mi cuenta" : "Empezar"}
          </LinkButton>
        </Card>
        <p className="mt-6 text-sm text-muted">
          ¿Ya tienes cuenta?{" "}
          <Link href="/login" className="text-brand hover:underline">
            Inicia sesión
          </Link>
        </p>
      </section>
    </main>
  );
}

function Feature({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <div>
      <div className="flex size-10 items-center justify-center rounded-md bg-brand-soft text-brand">
        <Icon className="size-5" />
      </div>
      <p className="mt-3 font-medium">{title}</p>
      <p className="mt-1 text-sm text-muted">{description}</p>
    </div>
  );
}
