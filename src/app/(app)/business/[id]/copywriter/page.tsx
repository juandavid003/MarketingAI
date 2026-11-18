import Link from "next/link";
import { PenLine } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireBusinessAccess } from "@/lib/dal";
import { purposeLabel } from "@/lib/contentAi";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Notice, PieceBriefForm } from "@/components/business/sections";

const SOURCE_LABEL: Record<string, string> = {
  brief: "Encargo",
  campaign: "Campaña",
  competitor_idea: "Idea de la competencia",
};

// Copywriter: every script (hook, scenes, description, CTAs) of this business.
export default async function CopywriterPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const { business } = await requireBusinessAccess(id);

  const pieces = await prisma.contentPiece.findMany({
    where: { businessId: id },
    orderBy: { createdAt: "desc" },
    include: {
      takes: { where: { slot: "main" }, select: { status: true } },
      _count: { select: { videoAssets: { where: { variantCode: null } } } },
    },
  });

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <PageHeader
        eyebrow={business.name}
        title="Copywriter"
        description="Guiones listos para grabar con el celular: hook, escenas (qué mostrar, qué decir y cómo grabarlo), descripción, hashtags y llamadas a la acción."
      />
      {error && <Notice tone="danger">{error}</Notice>}

      <Card className="mt-4 p-5">
        <p className="font-medium">Nuevo guion</p>
        <p className="mt-1 text-sm text-muted">
          También puedes crearlo desde una campaña o desde una idea de la competencia en el{" "}
          <Link href={`/business/${id}/ideas`} className="text-brand hover:underline">
            Generador de ideas
          </Link>
          .
        </p>
        <PieceBriefForm businessId={id} aiConfigured={business.aiProvider != null} />
      </Card>

      <h2 className="mt-10 text-lg font-semibold">Guiones</h2>
      {pieces.length === 0 ? (
        <div className="mt-3">
          <EmptyState icon={PenLine} title="Todavía no tienes guiones" />
        </div>
      ) : (
        <ul className="mt-3 divide-y divide-border">
          {pieces.map((piece) => {
            const content = safeScenes(piece.content);
            const ready = piece.takes.filter((t) => t.status === "ready").length;
            const status =
              piece._count.videoAssets > 0
                ? { label: "Video armado", tone: "success" as const }
                : ready > 0
                  ? { label: `${ready}/${content} tomas`, tone: "warning" as const }
                  : { label: "Por grabar", tone: "neutral" as const };
            return (
              <li key={piece.id}>
                <Link
                  href={`/business/${id}/pieces/${piece.id}`}
                  className="flex items-center justify-between gap-3 py-3 hover:text-brand"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">“{piece.hook}”</span>
                    <span className="text-xs text-muted">
                      {purposeLabel(piece.purpose)} · {piece.format} · {SOURCE_LABEL[piece.sourceType] ?? piece.sourceType}
                    </span>
                  </span>
                  <Badge tone={status.tone} className="shrink-0">
                    {status.label}
                  </Badge>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}

function safeScenes(raw: string): number {
  try {
    return (JSON.parse(raw) as { escenas?: unknown[] }).escenas?.length ?? 0;
  } catch {
    return 0;
  }
}
