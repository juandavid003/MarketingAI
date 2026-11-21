"use client";

import { useActionState } from "react";
import { Wand2 } from "lucide-react";
import { generateTakeWithAi, type UploadTakeState } from "../../content-actions";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Field";

const initialState: UploadTakeState = {};

// "¿No puedes grabar esta escena?" — the prompt is prefilled from the script
// and editable; what's in the box is exactly what goes to the provider.
export function AiTakeForm({
  businessId,
  pieceId,
  sceneNumber,
  defaultPrompt,
  providerLabel,
  hasTake,
}: {
  businessId: string;
  pieceId: string;
  sceneNumber: number;
  defaultPrompt: string;
  providerLabel: string;
  hasTake: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    generateTakeWithAi.bind(null, businessId, pieceId, sceneNumber),
    initialState
  );

  return (
    <details className="group rounded-md border border-dashed border-border p-3 text-sm">
      <summary className="flex cursor-pointer items-center gap-1.5 font-medium text-brand">
        <Wand2 className="size-3.5" /> {hasTake ? "Reemplazar con una toma generada con IA" : "¿No puedes grabarla? Genérala con IA"}
      </summary>
      <form action={formAction} className="mt-3 space-y-2">
        <Textarea name="prompt" rows={6} defaultValue={defaultPrompt} required aria-label={`Descripción para generar la escena ${sceneNumber}`} />
        <p className="text-xs text-muted">
          Se genera con {providerLabel} usando tu key; el costo lo cobra el proveedor a tu cuenta. Luego la revisamos y
          se arma como cualquier toma. Puede tardar varios minutos.
        </p>
        <Button type="submit" size="sm" disabled={pending}>
          <Wand2 className="size-3.5" />
          {pending ? "Enviando..." : "Generar escena"}
        </Button>
        {state.error && <p className="text-sm text-red-700 dark:text-red-400">{state.error}</p>}
      </form>
    </details>
  );
}
