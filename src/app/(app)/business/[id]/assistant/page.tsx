import Link from "next/link";
import { Sparkles, Database, AlertTriangle } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireBusinessAccess } from "@/lib/dal";
import { can } from "@/lib/access";
import { loadAssistantData } from "@/lib/assistantData";
import { buildFacts, parseAnswer, SUGGESTED_QUESTIONS, type Fact } from "@/lib/assistant";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { AssistantForm } from "@/components/business/AssistantForm";
import { askAssistant, clearConversation } from "./actions";

export default async function AssistantPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, business, role } = await requireBusinessAccess(id);
  const hasAi = Boolean(business.aiProvider && business.aiApiKeyEncrypted);

  const [latest, data] = await Promise.all([
    prisma.assistantMessage.findMany({
      where: { businessId: id, userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 40,
    }),
    loadAssistantData(business),
  ]);
  const messages = latest.reverse();
  const facts = buildFacts(data);

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <PageHeader
        eyebrow={business.name}
        title="Asistente de crecimiento"
        description="Pregunta qué está funcionando y qué hacer esta semana. Responde solo con los datos de tu negocio y cada cifra lleva su fuente: haz clic para ver de dónde sale."
        actions={
          messages.length > 0 ? (
            <form action={clearConversation.bind(null, id)}>
              <button type="submit" className="text-sm text-muted hover:text-foreground">
                Nueva conversación
              </button>
            </form>
          ) : undefined
        }
      />

      {!hasAi && (
        <Card className="mb-6 p-4 text-sm">
          El asistente usa la IA de tu negocio (tu propia API key).{" "}
          {can(role, "manage_settings") ? (
            <Link href={`/business/${id}/settings`} className="text-brand hover:underline">
              Configúrala aquí →
            </Link>
          ) : (
            "Pídele al dueño del negocio que la configure."
          )}
        </Card>
      )}

      <div className="space-y-4">
        {messages.length === 0 && (
          <Card className="p-5 text-sm text-muted">
            <p className="flex items-center gap-2 font-medium text-foreground">
              <Sparkles className="size-4 text-brand" /> ¿Qué quieres saber?
            </p>
            <p className="mt-2">
              Mira tus enlaces, leads, ventas, el calendario, las publicaciones, los resultados de tus creativos, la
              competencia y las fechas que vienen. Si algo no está registrado en la app, te lo dirá en vez de adivinar.
            </p>
          </Card>
        )}
        {messages.map((m) =>
          m.role === "user" ? (
            <div key={m.id} className="flex justify-end">
              <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-brand px-4 py-2 text-sm text-brand-foreground">
                {m.content}
              </p>
            </div>
          ) : (
            <AssistantAnswer key={m.id} content={m.content} facts={parseFacts(m.facts)} at={m.createdAt} />
          )
        )}
      </div>

      <AssistantForm
        action={askAssistant.bind(null, id)}
        disabled={!hasAi}
        suggestions={messages.length === 0 ? SUGGESTED_QUESTIONS : []}
      />

      <details className="mt-10 rounded-lg border border-border bg-surface p-4 text-sm">
        <summary className="flex cursor-pointer items-center gap-2 font-medium">
          <Database className="size-4 text-brand" /> Los datos que ve el asistente hoy ({facts.length})
        </summary>
        <p className="mt-2 text-muted">
          La app los calcula de tus registros; la IA no ve nada más (ni datos de contacto de tus leads ni tus API keys).
        </p>
        <FactList facts={facts} />
      </details>
    </main>
  );
}

function parseFacts(raw: string | null): Fact[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? (v as Fact[]) : [];
  } catch {
    return [];
  }
}

function AssistantAnswer({ content, facts, at }: { content: string; facts: Fact[]; at: Date }) {
  const parsed = parseAnswer(content, facts);
  return (
    <Card className="p-4 text-sm">
      <p className="whitespace-pre-wrap leading-relaxed">
        {parsed.parts.map((part, i) =>
          part.type === "text" ? (
            <span key={i}>{part.text}</span>
          ) : part.fact ? (
            <Link
              key={i}
              href={part.fact.href}
              title={`${part.fact.label}: ${part.fact.value}`}
              className="mx-0.5 rounded bg-brand-soft px-1 align-super text-[10px] font-semibold text-brand hover:underline"
            >
              {part.id}
            </Link>
          ) : (
            <span key={i} title="Esta cita no corresponde a ningún dato" className="mx-0.5 rounded bg-red-500/10 px-1 align-super text-[10px] font-semibold text-red-600 line-through dark:text-red-400">
              {part.id}
            </span>
          )
        )}
      </p>

      {(parsed.unknownIds.length > 0 || parsed.unsourcedNumbers.length > 0) && (
        <p className="mt-3 flex items-start gap-2 rounded-md bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          <span>
            {parsed.unsourcedNumbers.length > 0 &&
              `Estas cifras no están en tus datos (pueden ser cálculos o sugerencias de la IA, revísalas): ${parsed.unsourcedNumbers.join(", ")}. `}
            {parsed.unknownIds.length > 0 && `Citas que no existen: ${parsed.unknownIds.join(", ")}.`}
          </span>
        </p>
      )}

      {parsed.cited.length > 0 ? (
        <div className="mt-3 border-t border-border pt-2">
          <p className="text-xs font-medium text-muted">
            Fuentes · datos del {at.toLocaleDateString("es", { day: "numeric", month: "short" })}
          </p>
          <FactList facts={parsed.cited} />
        </div>
      ) : (
        <p className="mt-3 border-t border-border pt-2 text-xs text-faint">Esta respuesta no cita datos de tu negocio.</p>
      )}
    </Card>
  );
}

function FactList({ facts }: { facts: Fact[] }) {
  return (
    <ul className="mt-2 space-y-1 text-xs">
      {facts.map((f) => (
        <li key={f.id} className="flex gap-2">
          <span className="w-8 shrink-0 font-semibold text-brand">{f.id}</span>
          <span className="min-w-0">
            <span className="text-muted">{f.label}:</span> {f.value}{" "}
            <Link href={f.href} className="whitespace-nowrap text-brand hover:underline">
              {f.topic} →
            </Link>
          </span>
        </li>
      ))}
    </ul>
  );
}
