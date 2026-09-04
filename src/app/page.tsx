import { headers } from "next/headers";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import AuthNav from "./AuthNav";

// Lists the current set of businesses from the database — always current
// data, not a snapshot frozen at build time. Statically prerendering this
// also meant Turbopack's parallel build workers all opened DB connections
// at once, which the Postgres pooler's connection limit couldn't handle.
export const dynamic = "force-dynamic";

// Temporary: this becomes the public marketing landing page in the UI
// redesign pass, with a separate authenticated dashboard route for this
// list. For now it just scopes the list to the signed-in user instead of
// leaking every client's businesses to every visitor.
export default async function Home() {
  const session = await auth.api.getSession({ headers: await headers() });
  const businesses = session
    ? await prisma.business.findMany({
        where: { userId: session.user.id },
        orderBy: { createdAt: "desc" },
      })
    : [];

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-6 py-16">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
          MarketingAI
        </p>
        <AuthNav userEmail={session?.user.email ?? null} />
      </div>
      <h1 className="mt-8 text-3xl font-semibold">
        Tu equipo de marketing con IA
      </h1>
      <p className="mt-3 max-w-md text-neutral-600 dark:text-neutral-400">
        Conecta tu negocio y deja que la IA descubra qué está funcionando,
        qué no, y qué deberías hacer para vender más esta semana.
      </p>

      <Link
        href="/onboarding"
        className="mt-8 inline-flex w-fit items-center rounded-md bg-black px-5 py-3 font-medium text-white transition hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
      >
        Crear perfil de negocio
      </Link>

      {businesses.length > 0 && (
        <section className="mt-14">
          <h2 className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
            Tus negocios
          </h2>
          <ul className="mt-3 divide-y divide-neutral-200 dark:divide-neutral-800">
            {businesses.map((business) => (
              <li key={business.id}>
                <Link
                  href={`/business/${business.id}`}
                  className="flex items-center justify-between py-3 hover:text-neutral-500"
                >
                  <span className="font-medium">{business.name}</span>
                  <span className="text-sm text-neutral-500 dark:text-neutral-400">
                    {business.industry}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mt-auto flex gap-4 pt-14 text-sm text-neutral-500">
        <Link href="/privacy" className="underline hover:text-neutral-800 dark:hover:text-neutral-200">
          Política de privacidad
        </Link>
        <Link href="/terms" className="underline hover:text-neutral-800 dark:hover:text-neutral-200">
          Condiciones del servicio
        </Link>
      </div>
    </main>
  );
}
