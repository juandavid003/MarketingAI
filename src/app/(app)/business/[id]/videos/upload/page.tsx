import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireBusinessAccess } from "@/lib/dal";
import { PageHeader } from "@/components/ui/PageHeader";
import UploadVideoForm from "./UploadVideoForm";

export default async function UploadVideoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  await requireBusinessAccess(id);

  const business = await prisma.business.findUnique({
    where: { id },
    select: { id: true, name: true, aiProvider: true, openaiTranscriptionKeyEncrypted: true },
  });
  if (!business) {
    notFound();
  }

  const missingConfig = !business.aiProvider || !business.openaiTranscriptionKeyEncrypted;

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <PageHeader
        backHref={`/business/${business.id}/videos`}
        backLabel="Volver a Videos"
        title="Editar video con IA"
        description="Sube un video grabado con el celular. La IA transcribe el audio, elige el mejor fragmento, sugiere un hook y un CTA, y genera un clip vertical (9:16) con subtítulos quemados y thumbnail."
      />

      {missingConfig ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">
          Falta configurar tu proveedor de IA y/o tu key de OpenAI para transcripción.{" "}
          <Link href={`/business/${business.id}/settings`} className="underline">
            Configúralos aquí
          </Link>
          .
        </div>
      ) : (
        <UploadVideoForm businessId={business.id} />
      )}
    </main>
  );
}
