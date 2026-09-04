import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireBusinessAccess } from "@/lib/dal";
import type { GeneratedStoryboard } from "@/lib/ai";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";

export default async function StoryboardPage({
  params,
}: {
  params: Promise<{ id: string; campaignId: string; storyboardId: string }>;
}) {
  const { id, campaignId, storyboardId } = await params;

  await requireBusinessAccess(id);

  const [storyboard, campaign] = await Promise.all([
    prisma.storyboard.findUnique({ where: { id: storyboardId } }),
    prisma.campaign.findUnique({ where: { id: campaignId }, select: { businessId: true } }),
  ]);

  if (!storyboard || storyboard.campaignId !== campaignId || campaign?.businessId !== id) {
    notFound();
  }

  let content: GeneratedStoryboard;
  try {
    content = JSON.parse(storyboard.scenes) as GeneratedStoryboard;
  } catch {
    notFound();
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <PageHeader
        backHref={`/business/${id}/campaigns/${campaignId}`}
        backLabel="Volver a la campaña"
        eyebrow={`Guion generado · ${storyboard.format} · ${storyboard.provider} (${storyboard.model})`}
        title={`"${storyboard.hook}"`}
        description={`Duración estimada: ${content.duracionTotal}`}
      />

      <div className="space-y-4">
        {content.escenas.map((scene) => (
          <Card key={scene.numero} className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Escena {scene.numero}</p>
              <span className="text-xs text-faint">{scene.duracionSegundos}s</span>
            </div>
            <p className="mt-2 text-sm">
              <span className="font-medium">Visual: </span>
              {scene.visual}
            </p>
            {scene.textoPantalla && (
              <p className="mt-1 text-sm">
                <span className="font-medium">Texto en pantalla: </span>
                {scene.textoPantalla}
              </p>
            )}
            {scene.vozEnOff && (
              <p className="mt-1 text-sm">
                <span className="font-medium">Voz en off: </span>
                {scene.vozEnOff}
              </p>
            )}
          </Card>
        ))}
      </div>
    </main>
  );
}
