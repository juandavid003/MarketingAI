import Link from "next/link";
import { Share2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireBusinessAccess } from "@/lib/dal";
import { parseStrategy } from "@/lib/distribution";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { LinkButton } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";

// Distribuidor de estrategia: per script, the creatives (same body, other
// hooks/CTAs), their test plan and results. The plan itself lives at
// /pieces/[pieceId]/creatives.
export default async function DistributionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { business } = await requireBusinessAccess(id);

  const pieces = await prisma.contentPiece.findMany({
    where: { businessId: id },
    orderBy: { createdAt: "desc" },
    include: { variants: { include: { _count: { select: { results: true } } } } },
  });
  const withPlan = pieces.filter((p) => p.strategy);
  const withoutPlan = pieces.filter((p) => !p.strategy);

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <PageHeader
        eyebrow={business.name}
        title="Distribuidor de estrategia"
        description="Saca varios creativos de cada video cambiando solo el hook y la llamada a la acción, y publícalos con un plan para descubrir cuál funciona mejor."
      />

      <Card className="p-4 text-sm text-muted">
        Cómo funciona: elige un guion, genera su plan (3 hooks y 2 CTAs alternativos y un calendario por red),
        genera los creativos con lo que ya grabaste y registra sus resultados. Fase 1 elige el mejor hook; fase 2,
        el mejor CTA. Puedes enviar el plan al{" "}
        <Link href={`/business/${id}/calendar`} className="text-brand hover:underline">
          Manager de contenido
        </Link>
        .
      </Card>

      <h2 className="mt-8 text-lg font-semibold">Con plan de distribución</h2>
      {withPlan.length === 0 ? (
        <p className="mt-2 text-sm text-muted">Ningún guion tiene plan todavía.</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {withPlan.map((piece) => {
            const strategy = parseStrategy(piece.strategy);
            const rendered = piece.variants.filter((v) => v.renderStatus === "ready").length;
            const results = piece.variants.reduce((s, v) => s + v._count.results, 0);
            return (
              <li key={piece.id}>
                <Link href={`/business/${id}/pieces/${piece.id}/creatives`}>
                  <Card className="p-4 hover:border-brand">
                    <p className="font-medium">“{piece.hook}”</p>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs">
                      <Badge>{strategy?.hooks.length ?? 0} hooks</Badge>
                      <Badge>{strategy?.ctas.length ?? 0} CTAs</Badge>
                      <Badge tone={rendered > 0 ? "success" : "neutral"}>{rendered} creativos generados</Badge>
                      <Badge tone={results > 0 ? "brand" : "neutral"}>{results} resultados registrados</Badge>
                    </div>
                  </Card>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <h2 className="mt-10 text-lg font-semibold">Guiones sin plan</h2>
      {pieces.length === 0 ? (
        <div className="mt-3">
          <EmptyState
            icon={Share2}
            title="Primero necesitas un guion"
            action={
              <LinkButton href={`/business/${id}/copywriter`} size="sm">
                Ir al Copywriter
              </LinkButton>
            }
          />
        </div>
      ) : withoutPlan.length === 0 ? (
        <p className="mt-2 text-sm text-muted">Todos tus guiones tienen plan.</p>
      ) : (
        <ul className="mt-3 divide-y divide-border">
          {withoutPlan.map((piece) => (
            <li key={piece.id} className="flex items-center justify-between gap-3 py-3">
              <span className="min-w-0 truncate font-medium">“{piece.hook}”</span>
              <LinkButton href={`/business/${id}/pieces/${piece.id}/creatives`} variant="secondary" size="sm" className="shrink-0">
                Crear plan
              </LinkButton>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
