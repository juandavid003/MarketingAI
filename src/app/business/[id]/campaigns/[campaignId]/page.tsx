import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import type { GeneratedCampaign } from "@/lib/ai";

export default async function CampaignPage({
  params,
}: {
  params: Promise<{ id: string; campaignId: string }>;
}) {
  const { id, campaignId } = await params;

  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
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

      <div className="mt-8 space-y-6">
        <Section label="Objetivo" value={content.objetivo} />
        <Section label="Audiencia" value={content.audiencia} />
        <Section label="Concepto" value={content.concepto} />

        <div>
          <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400">Contenido</p>
          <div className="mt-2 space-y-3">
            {content.contenido.map((item, i) => (
              <div key={i} className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
                <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400">{item.formato}</p>
                <p className="mt-1 text-sm">&ldquo;{item.hook}&rdquo;</p>
              </div>
            ))}
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
