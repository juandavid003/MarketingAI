import { CheckCircle2, AlertTriangle, Loader2, Eye } from "lucide-react";
import { fileUrl } from "@/lib/storage";
import { parseReview } from "@/lib/takeReview";
import { isTakeStalled } from "@/lib/jobs/processTake";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { retryTake } from "../../content-actions";

// One uploaded take: preview, processing state and the review verdict
// ("conviene volver a grabar … porque …"), with what was actually checked.
export function TakeDetails({
  businessId,
  pieceId,
  take,
  label,
}: {
  businessId: string;
  pieceId: string;
  take: {
    id: string;
    originalPath: string;
    status: string;
    errorMessage: string | null;
    review: string | null;
    updatedAt: Date;
  };
  label: string;
}) {
  const review = parseReview(take.review);
  const stalled = isTakeStalled(take);
  const busy = ["uploaded", "processing"].includes(take.status) && !stalled;

  return (
    <div className="flex flex-wrap items-start gap-3">
      <video src={fileUrl(take.originalPath)} controls preload="metadata" className="w-28 rounded-md border border-border" />
      <div className="min-w-0 flex-1 space-y-1.5 text-sm">
        {busy && (
          <Badge tone="warning">
            <Loader2 className="size-3 animate-spin" /> Revisando la toma...
          </Badge>
        )}
        {take.status === "error" && <p className="text-red-700 dark:text-red-400">No se pudo procesar: {take.errorMessage}</p>}
        {stalled && <p className="text-muted">La revisión se interrumpió.</p>}
        {(take.status === "error" || stalled) && (
          <form action={retryTake.bind(null, businessId, pieceId, take.id)}>
            <Button type="submit" size="sm" variant="secondary">
              Reintentar
            </Button>
          </form>
        )}
        {take.status === "ready" && review?.verdict === "ok" && (
          <p className="flex items-center gap-1.5 font-medium text-green-700 dark:text-green-400">
            <CheckCircle2 className="size-4" /> Toma lista
          </p>
        )}
        {take.status === "ready" && review?.verdict === "rerecord" && (
          <div className="rounded-md bg-amber-50 p-3 dark:bg-amber-950/50">
            <p className="flex items-center gap-1.5 font-medium text-amber-800 dark:text-amber-300">
              <AlertTriangle className="size-4" /> Conviene volver a grabar {label}
            </p>
            <ul className="mt-1 list-disc pl-5 text-amber-900 dark:text-amber-200">
              {review.reasons.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </div>
        )}
        {review?.tip && <p className="text-muted">Consejo: {review.tip}</p>}
        {review?.notes.map((n, i) => (
          <p key={i} className="text-muted">
            {n}
          </p>
        ))}
        {review && (
          <p className="flex flex-wrap items-center gap-1 text-xs text-faint">
            {review.visual && <Eye className="size-3.5" />}
            {review.visual
              ? `Revisamos imagen y audio (Gemini, ≈ US$${review.visual.costUsd.toFixed(4)})${
                  review.checkedBy === "rules+audio_ai" ? " y lo dicho frente al guion." : "."
                }`
              : review.checkedBy === "rules+audio_ai"
                ? "Revisamos el audio y lo dicho frente al guion. Para revisar también la imagen, agrega una key de Gemini en IA."
                : "Revisión básica de duración y voz (agrega tu key de OpenAI para revisar lo dicho y poner subtítulos)."}
          </p>
        )}
      </div>
    </div>
  );
}
