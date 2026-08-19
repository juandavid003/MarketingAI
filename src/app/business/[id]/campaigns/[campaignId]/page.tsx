import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import type { GeneratedCampaign } from "@/lib/ai";
import { createStoryboard } from "../../actions";

export default async function CampaignPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; campaignId: string }>;
  searchParams: Promise<{ storyboard_error?: string }>;
}) {
  const { id, campaignId } = await params;
  const { storyboard_error: storyboardError } = await searchParams;

  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: { storyboards: { orderBy: { createdAt: "desc" } } },
  });

  if (!campaign || campaign.businessId !== id) {
    notFound();
  }

  let content: GeneratedCampaign;
  try {
    content = JSON.parse(campaign.content) as GeneratedCampaign;
  } catch {
    notFound();
  }

  const storyboardByIndex = new Map(campaign.storyboards.map((sb) => [sb.contentIndex, sb]));

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <Link
        href={`/business/${id}`}
        className="text-sm text-neutral-500 underline hover:text-neutral-800 dark:hover:text-neutral-200"
      >
        ← Volver al negocio
      </Link>

      <p className="mt-4 text-sm font-medium text-neutral-500 dark:text-neutral-400">
        Campaña generada · {campaign.provider} ({campaign.model})
      </p>
      <h1 className="mt-1 text-2xl font-semibold">🎯 {campaign.title}</h1>
      <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
        Basada en: {campaign.sourceInsight}
      </p>

      {storyboardError && (
        <p className="mt-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          No se pudo generar el guion: {storyboardError}
        </p>
      )}

      <div className="mt-8 space-y-6">
        <Section label="Objetivo" value={content.objetivo} />
        <Section label="Audiencia" value={content.audiencia} />
        <Section label="Concepto" value={content.concepto} />

        <div>
          <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400">Contenido</p>
          <div className="mt-2 space-y-3">
            {content.contenido.map((item, i) => {
              const storyboard = storyboardByIndex.get(i);
              return (
                <div key={i} className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
                  <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400">{item.formato}</p>
                  <p className="mt-1 text-sm">&ldquo;{item.hook}&rdquo;</p>
                  {storyboard ? (
                    <Link
                      href={`/business/${id}/campaigns/${campaignId}/storyboards/${storyboard.id}`}
                      className="mt-2 inline-block text-sm underline text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
                    >
                      Ver guion generado →
                    </Link>
                  ) : (
                    <form action={createStoryboard.bind(null, id, campaignId, i)}>
                      <button
                        type="submit"
                        className="mt-2 rounded-md bg-black px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
                      >
                        Generar storyboard y guion
                      </button>
                    </form>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <Section label="Oferta" value={content.oferta} />
        <Section label="Llamado a la acción" value={content.cta} />
      </div>
    </main>
  );
}

function Section({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400">{label}</p>
      <p className="mt-1">{value}</p>
    </div>
  );
}
