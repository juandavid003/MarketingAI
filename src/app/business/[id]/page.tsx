import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { OBJECTIVES } from "@/lib/constants";
import { generateInsights, type Insight } from "@/lib/insights";

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

  const insights = generateInsights(business);

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
        {business.industry} · {business.location}
      </p>
      <h1 className="mt-1 text-2xl font-semibold">{business.name}</h1>

      <section className="mt-10">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">🧠 Tu negocio esta semana</h2>
          <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
            Vista previa
          </span>
        </div>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          Estos son ejemplos ilustrativos generados a partir de tu perfil.
          Conecta Instagram/Facebook para que la IA analice datos reales cada
          semana.
        </p>

        <div className="mt-6 space-y-4">
          {insights.map((insight) => (
            <InsightCard key={insight.title + insight.description} insight={insight} />
          ))}
        </div>
      </section>

      <section className="mt-14 space-y-6 border-t border-neutral-200 pt-10 dark:border-neutral-800">
        <h2 className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
          Perfil de negocio
        </h2>
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

      <Link
        href="/onboarding"
        className="mt-8 inline-block text-sm text-neutral-500 underline hover:text-neutral-800 dark:hover:text-neutral-200"
      >
        + Agregar otro negocio
      </Link>
    </main>
  );
}

function InsightCard({ insight }: { insight: Insight }) {
  return (
    <div className="rounded-lg border border-neutral-200 p-5 dark:border-neutral-800">
      <div className="flex items-start justify-between gap-4">
        <p className="font-medium">
          {insight.emoji} {insight.title}
        </p>
        {insight.potential && (
          <span className="shrink-0 rounded-full border border-neutral-300 px-2.5 py-0.5 text-xs text-neutral-600 dark:border-neutral-700 dark:text-neutral-400">
            Potencial: {insight.potential}
          </span>
        )}
      </div>
      <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
        {insight.description}
      </p>
      {insight.recommendation && (
        <p className="mt-2 text-sm">
          <span className="font-medium">Recomendación: </span>
          {insight.recommendation}
        </p>
      )}
      {insight.actionLabel && (
        <button
          type="button"
          disabled
          title="Disponible cuando conectes tus redes"
          className="mt-3 rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-400 cursor-not-allowed dark:border-neutral-700 dark:text-neutral-600"
        >
          {insight.actionLabel}
        </button>
      )}
    </div>
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
