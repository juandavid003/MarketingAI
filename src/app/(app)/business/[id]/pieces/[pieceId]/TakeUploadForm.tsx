"use client";

import { useActionState } from "react";
import { Upload } from "lucide-react";
import { uploadSceneTake, type UploadTakeState } from "../../content-actions";
import { Button } from "@/components/ui/Button";

const initialState: UploadTakeState = {};

export function TakeUploadForm({
  businessId,
  pieceId,
  sceneNumber,
  slot = "main",
  hasTake,
}: {
  businessId: string;
  pieceId: string;
  sceneNumber: number;
  slot?: string;
  hasTake: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    uploadSceneTake.bind(null, businessId, pieceId, sceneNumber, slot),
    initialState
  );

  return (
    <form action={formAction} className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <input
          name="video"
          type="file"
          accept="video/*"
          required
          aria-label={`Video de la escena ${sceneNumber}`}
          className="block min-w-0 flex-1 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-black/5 file:px-3 file:py-1.5 file:text-sm file:font-medium dark:file:bg-white/10"
        />
        <Button type="submit" size="sm" variant={hasTake ? "secondary" : "primary"} disabled={pending}>
          <Upload className="size-3.5" />
          {pending ? "Subiendo..." : hasTake ? "Reemplazar toma" : "Subir toma"}
        </Button>
      </div>
      {pending && (
        <p className="text-xs text-muted">No cierres esta pestaña hasta que termine la subida.</p>
      )}
      {state.error && <p className="text-sm text-red-700 dark:text-red-400">{state.error}</p>}
    </form>
  );
}
