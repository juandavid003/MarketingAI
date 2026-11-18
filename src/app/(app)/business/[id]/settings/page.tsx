import { notFound } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireBusinessAccess } from "@/lib/dal";
import { clearAiSettings, clearTranscriptionKey, clearImageKey, clearGeminiKey } from "../actions";
import { parseReview } from "@/lib/takeReview";
import { GEMINI_VIDEO_MODEL } from "@/lib/visualReview";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import AiSettingsForm, { GeminiKeyForm } from "./AiSettingsForm";

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
      geminiApiKeyEncrypted: true,
    },
  });

  if (!business) {
    notFound();
  }

  // Gemini spike: what the visual reviews have cost so far.
  const reviewed = await prisma.sceneTake.findMany({
    where: { contentPiece: { businessId: id }, review: { contains: '"visual"' } },
    select: { review: true },
  });
  const visualStats = { count: 0, rerecord: 0, cost: 0, tokens: 0 };
  for (const t of reviewed) {
    const visual = parseReview(t.review)?.visual;
    if (!visual) continue;
    visualStats.count++;
    if (visual.verdict === "rerecord") visualStats.rerecord++;
    visualStats.cost += visual.costUsd;
    visualStats.tokens += visual.inputTokens + visual.outputTokens;
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

      <section className="mt-12 space-y-3 border-t border-border pt-8">
        <h2 className="text-lg font-semibold">Revisión visual de tomas (Gemini)</h2>
        {business.geminiApiKeyEncrypted ? (
          <ConfiguredRow label="Google Gemini: configurada y verificada" onClear={clearGeminiKey.bind(null, business.id)} />
        ) : (
          <GeminiKeyForm businessId={business.id} />
        )}
        {visualStats.count > 0 && (
          <Card className="p-4 text-sm">
            <p className="font-medium">Uso hasta ahora</p>
            <p className="mt-1 text-muted">
              {visualStats.count} tomas revisadas · {visualStats.rerecord} con aviso de regrabar · costo estimado total US$
              {visualStats.cost.toFixed(4)} (≈ US${(visualStats.cost / visualStats.count).toFixed(4)} por toma,{" "}
              {Math.round(visualStats.tokens / visualStats.count).toLocaleString("es")} tokens en promedio).
            </p>
            <p className="mt-1 text-xs text-faint">
              Estimado con precios de referencia de {GEMINI_VIDEO_MODEL}; el cobro real lo ves en tu cuenta de Google.
            </p>
          </Card>
        )}
      </section>
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
