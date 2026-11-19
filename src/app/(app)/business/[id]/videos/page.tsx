import Link from "next/link";
import { Clapperboard } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireBusinessAccess } from "@/lib/dal";
import { Badge } from "@/components/ui/Badge";
import { LinkButton } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { currentUsage } from "@/lib/usageServer";
import { usageLimits, formatBytes, ORIGINAL_RETENTION_DAYS } from "@/lib/usage";

const STATUS: Record<string, { label: string; tone: "success" | "warning" | "danger" | "neutral" }> = {
  ready: { label: "Listo", tone: "success" },
  error: { label: "Error", tone: "danger" },
};

export default async function VideosPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { business } = await requireBusinessAccess(id);
  const [videos, usage] = await Promise.all([
    prisma.videoAsset.findMany({
      where: { businessId: id },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { versions: true } } },
    }),
    currentUsage(id),
  ]);
  const limits = usageLimits();

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <PageHeader
        eyebrow={business.name}
        title="Videos"
        description="Los videos armados desde tus guiones, los creativos del distribuidor y los que subiste para editar."
        actions={
          <LinkButton href={`/business/${id}/videos/upload`} variant="secondary" size="sm">
            Subir video para editar
          </LinkButton>
        }
      />
      <p className="mb-4 text-xs text-faint">
        Uso del mes: {usage.videoMinutes} de {limits.videoMinutesPerMonth} min de video ·{" "}
        {formatBytes(usage.storageBytes)} de {formatBytes(limits.storageBytes)} de espacio. Los originales
        subidos para editar se borran {ORIGINAL_RETENTION_DAYS} días después de estar listos; las versiones
        editadas se conservan.
      </p>
      {videos.length === 0 ? (
        <EmptyState icon={Clapperboard} title="Todavía no hay videos" />
      ) : (
        <ul className="divide-y divide-border">
          {videos.map((video) => {
            const status = STATUS[video.status] ?? { label: "Procesando", tone: "warning" as const };
            return (
              <li key={video.id}>
                <Link
                  href={`/business/${id}/videos/${video.id}`}
                  className="flex items-center justify-between gap-3 py-3 hover:text-brand"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{video.originalFilename}</span>
                    <span className="text-xs text-muted">
                      {video.variantCode ? `Creativo ${video.variantCode} · ` : video.contentPieceId ? "Armado desde guion · " : "Subido · "}
                      {video._count.versions} versiones · {video.createdAt.toLocaleDateString("es")}
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
