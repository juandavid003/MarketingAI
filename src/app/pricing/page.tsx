import { headers } from "next/headers";
import Link from "next/link";
import { auth } from "@/lib/auth";
import SubscribeButton from "./SubscribeButton";

export default async function PricingPage() {
  const session = await auth.api.getSession({ headers: await headers() });

  return (
    <main className="mx-auto flex min-h-full w-full max-w-sm flex-1 flex-col justify-center px-6 py-16">
      <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400">MarketingAI</p>
      <h1 className="mt-1 text-2xl font-semibold">Un solo plan</h1>

      <div className="mt-8 rounded-lg border border-neutral-200 p-6 dark:border-neutral-800">
        <p className="text-3xl font-semibold">
          $100<span className="text-base font-normal text-neutral-500 dark:text-neutral-400">/mes</span>
        </p>
        <ul className="mt-4 space-y-2 text-sm text-neutral-600 dark:text-neutral-400">
          <li>Negocios ilimitados</li>
          <li>Campañas y contenido generado con tu propia IA</li>
          <li>Publicar y pautar en Meta con tu propia cuenta</li>
          <li>Análisis de competencia</li>
        </ul>

        <div className="mt-6">
          {session ? (
            <SubscribeButton />
          ) : (
            <Link
              href="/signup"
              className="block w-full rounded-md bg-black px-4 py-2 text-center text-sm font-medium text-white hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
            >
              Crea tu cuenta para suscribirte
            </Link>
          )}
        </div>
      </div>
    </main>
  );
}
