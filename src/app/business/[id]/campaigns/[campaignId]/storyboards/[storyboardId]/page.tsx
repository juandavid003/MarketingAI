import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import type { GeneratedStoryboard } from "@/lib/ai";

export default async function StoryboardPage({
  params,
}: {
  params: Promise<{ id: string; campaignId: string; storyboardId: string }>;
}) {
  const { id, campaignId, storyboardId } = await params;

  const storyboard = await prisma.storyboard.findUnique({
    where: { id: storyboardId },
  });

  if (!storyboard || storyboard.campaignId !== campaignId) {
    notFound();
  }

  let content: GeneratedStoryboard;
  try {
    content = JSON.parse(storyboard.scenes) as GeneratedStoryboard;
  } catch {
    notFound();
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <Link
        href={`/business/${id}/campaigns/${campaignId}`}
        className="text-sm text-neutral-500 underline hover:text-neutral-800 dark:hover:text-neutral-200"
      >
        ← Volver a la campaña
      </Link>

      <p className="mt-4 text-sm font-medium text-neutral-500 dark:text-neutral-400">
        Guion generado · {storyboard.format} · {storyboard.provider} ({storyboard.model})
      </p>
      <h1 className="mt-1 text-2xl font-semibold">🎬 &ldquo;{storyboard.hook}&rdquo;</h1>
      <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
        Duración estimada: {content.duracionTotal}
      </p>

      <div className="mt-8 space-y-4">
        {content.escenas.map((scene) => (
          <div key={scene.numero} className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Escena {scene.numero}</p>
              <span className="text-xs text-neutral-500 dark:text-neutral-400">
                {scene.duracionSegundos}s
              </span>
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
          </div>
        ))}
      </div>
    </main>
  );
}
