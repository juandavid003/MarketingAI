import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import UploadVideoForm from "./UploadVideoForm";

export default async function UploadVideoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const business = await prisma.business.findUnique({
    where: { id },
    select: { id: true, name: true, aiProvider: true, openaiTranscriptionKeyEncrypted: true },
  });

  if (!business) {
    notFound();
  }

  const missingConfig = !business.aiProvider || !business.openaiTranscriptionKeyEncrypted;

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <Link
        href={`/business/${business.id}`}
        className="text-sm text-neutral-500 underline hover:text-neutral-800 dark:hover:text-neutral-200"
      >
        ← Volver al negocio
      </Link>

      <h1 className="mt-4 text-2xl font-semibold">Editar video con IA</h1>
      <p className="mt-1 text-neutral-600 dark:text-neutral-400">
        Sube un video grabado con el celular. La IA transcribe el audio, elige el mejor fragmento, sugiere un hook y un CTA, y genera un clip vertical (9:16) con subtítulos quemados y thumbnail.
      </p>

      {missingConfig ? (
        <div className="mt-6 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">
          Falta configurar tu proveedor de IA y/o tu key de OpenAI para transcripción.{" "}
          <Link href={`/business/${business.id}/settings`} className="underline">
            Configúralos aquí
          </Link>
          .
        </div>
      ) : (
        <div className="mt-6">
          <UploadVideoForm businessId={business.id} />
        </div>
      )}
    </main>
  );
}
