import { notFound } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireBusinessAccess } from "@/lib/dal";
import { clearAiSettings, clearTranscriptionKey, clearImageKey } from "../actions";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
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

  await requireBusinessAccess(id);

  const business = await prisma.business.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      aiProvider: true,
      aiConfiguredAt: true,
      openaiTranscriptionKeyEncrypted: true,
      openaiImageKeyEncrypted: true,
    },
  });

  if (!business) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <PageHeader
        title="Configuración de IA"
        description={`Elige el proveedor de IA que se usará para generar campañas y contenido para ${business.name}. Usamos tu propia API key — no compartimos ni reutilizamos tu cuota entre negocios.`}
      />

      <div className="space-y-3">
        {business.aiProvider && (
          <ConfiguredRow
            label={`Configurado: ${PROVIDER_LABEL[business.aiProvider] ?? business.aiProvider}`}
            onClear={clearAiSettings.bind(null, business.id)}
          />
        )}
        {business.openaiTranscriptionKeyEncrypted && (
          <ConfiguredRow
            label="OpenAI para transcripción de video: configurada"
            onClear={clearTranscriptionKey.bind(null, business.id)}
          />
        )}
        {business.openaiImageKeyEncrypted && (
          <ConfiguredRow
            label="OpenAI para imágenes: configurada"
            onClear={clearImageKey.bind(null, business.id)}
          />
        )}
      </div>

      <div className="mt-6">
        <AiSettingsForm businessId={business.id} />
      </div>
    </main>
  );
}

function ConfiguredRow({ label, onClear }: { label: string; onClear: () => Promise<void> }) {
  return (
    <Card className="flex items-center justify-between gap-4 p-4">
      <p className="flex items-center gap-1.5 text-sm">
        <CheckCircle2 className="size-4 text-green-600 dark:text-green-400" />
        {label}
      </p>
      <form action={onClear}>
        <Button type="submit" variant="secondary" size="sm" className="shrink-0">
          Quitar
        </Button>
      </form>
    </Card>
  );
}
