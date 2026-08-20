import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { clearAiSettings, clearTranscriptionKey } from "../actions";
import AiSettingsForm from "./AiSettingsForm";

const PROVIDER_LABEL: Record<string, string> = {
  anthropic: "Anthropic (Claude)",
  openai: "OpenAI (GPT)",
};

export default async function AiSettingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const business = await prisma.business.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      aiProvider: true,
      aiConfiguredAt: true,
      openaiTranscriptionKeyEncrypted: true,
    },
  });

  if (!business) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <Link
        href={`/business/${business.id}`}
        className="text-sm text-neutral-500 underline hover:text-neutral-800 dark:hover:text-neutral-200"
      >
        ← Volver al negocio
      </Link>

      <h1 className="mt-4 text-2xl font-semibold">Configuración de IA</h1>
      <p className="mt-1 text-neutral-600 dark:text-neutral-400">
        Elige el proveedor de IA que se usará para generar campañas y contenido para {business.name}. Usamos tu propia API key — no compartimos ni reutilizamos tu cuota entre negocios.
      </p>

      {business.aiProvider && (
        <div className="mt-6 flex items-center justify-between gap-4 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
          <p className="text-sm">
            ✅ Configurado: <span className="font-medium">{PROVIDER_LABEL[business.aiProvider] ?? business.aiProvider}</span>
          </p>
          <form action={clearAiSettings.bind(null, business.id)}>
            <button
              type="submit"
              className="shrink-0 rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
            >
              Quitar
            </button>
          </form>
        </div>
      )}

      {business.openaiTranscriptionKeyEncrypted && (
        <div className="mt-4 flex items-center justify-between gap-4 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
          <p className="text-sm">✅ OpenAI para transcripción de video: configurada</p>
          <form action={clearTranscriptionKey.bind(null, business.id)}>
            <button
              type="submit"
              className="shrink-0 rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
            >
              Quitar
            </button>
          </form>
        </div>
      )}

      <div className="mt-6">
        <AiSettingsForm businessId={business.id} />
      </div>
    </main>
  );
}
