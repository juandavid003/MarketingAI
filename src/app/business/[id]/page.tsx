import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { OBJECTIVES } from "@/lib/constants";

export default async function BusinessProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const business = await prisma.business.findUnique({
    where: { id },
    include: { products: true },
  });

  if (!business) {
    notFound();
  }

  const objectiveLabel =
    OBJECTIVES.find((o) => o.value === business.objective)?.label ??
    business.objective;

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
        Perfil de negocio
      </p>
      <h1 className="mt-1 text-2xl font-semibold">{business.name}</h1>
      <p className="mt-1 text-neutral-600 dark:text-neutral-400">
        {business.industry} · {business.location}
      </p>

      <section className="mt-8 space-y-6">
        <Detail label="¿Qué vende?" value={business.description} />
        <Detail label="Audiencia objetivo" value={business.targetAudience} />
        <Detail label="Objetivo principal" value={objectiveLabel} />
        {business.avgTicket != null && (
          <Detail
            label="Ticket promedio"
            value={business.avgTicket.toLocaleString(undefined, {
              style: "currency",
              currency: "USD",
            })}
          />
        )}
        <div>
          <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
            Productos / servicios
          </p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {business.products.map((product) => (
              <li
                key={product.id}
                className="rounded-full border border-neutral-300 px-3 py-1 text-sm dark:border-neutral-700"
              >
                {product.name}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mt-12 rounded-lg border border-dashed border-neutral-300 p-6 text-center dark:border-neutral-700">
        <p className="font-medium">🧠 Tu equipo de marketing con IA</p>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          Próximamente: conecta Instagram/Facebook para que la IA empiece a
          detectar oportunidades, problemas y tendencias cada semana.
        </p>
      </section>

      <Link
        href="/onboarding"
        className="mt-8 inline-block text-sm text-neutral-500 underline hover:text-neutral-800 dark:hover:text-neutral-200"
      >
        + Agregar otro negocio
      </Link>
    </main>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
        {label}
      </p>
      <p className="mt-1">{value}</p>
    </div>
  );
}
