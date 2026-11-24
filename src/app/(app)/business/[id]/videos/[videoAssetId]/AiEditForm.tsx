"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Wand2 } from "lucide-react";
import { startAiVideoEdit, type AiEditState } from "../../video-actions";
import { Button } from "@/components/ui/Button";
import { Select, Textarea, Label } from "@/components/ui/Field";

export type EditAiChoice = { id: string; label: string; strengths: string; available: boolean };
export type EditPlatformChoice = { id: string; label: string; range: string };

// "Editar con IA": choose the AI (only those with a saved key are enabled),
// the network it's for and, optionally, what to emphasize.
export function AiEditForm({
  businessId,
  videoAssetId,
  ais,
  platforms,
  defaultPlatform,
  busy,
}: {
  businessId: string;
  videoAssetId: string;
  ais: EditAiChoice[];
  platforms: EditPlatformChoice[];
  defaultPlatform: string;
  busy: boolean;
}) {
  const [state, action, pending] = useActionState(
    startAiVideoEdit.bind(null, businessId, videoAssetId),
    {} as AiEditState
  );
  const usable = ais.filter((a) => a.available);
  const [aiId, setAiId] = useState(usable[0]?.id ?? "");
  const [platformId, setPlatformId] = useState(defaultPlatform);
  const ai = ais.find((a) => a.id === aiId);
  const platform = platforms.find((p) => p.id === platformId);

  if (usable.length === 0) {
    return (
      <p className="text-sm text-muted">
        Para editar con IA necesitas una key de Anthropic (Claude), OpenAI o Gemini.{" "}
        <Link href={`/business/${businessId}/settings`} className="text-brand hover:underline">
          Configúrala →
        </Link>
      </p>
    );
  }

  return (
    <form action={action} className="space-y-3 text-sm">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="edit-provider">Editar con</Label>
          <Select id="edit-provider" name="provider" value={aiId} onChange={(e) => setAiId(e.target.value)}>
            {ais.map((a) => (
              <option key={a.id} value={a.id} disabled={!a.available}>
                {a.label}
                {!a.available ? " (falta la key)" : ""}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="edit-platform">Para publicar en</Label>
          <Select id="edit-platform" name="platform" value={platformId} onChange={(e) => setPlatformId(e.target.value)}>
            {platforms.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <p className="text-xs text-muted">
        {ai?.strengths} {platform && `Duración ideal en ${platform.label}: ${platform.range}.`}
      </p>

      <div className="space-y-1">
        <Label htmlFor="edit-instructions">Indicaciones (opcional)</Label>
        <Textarea
          id="edit-instructions"
          name="instructions"
          rows={2}
          maxLength={1000}
          placeholder="Ej.: enfócate en la promoción de 2x1, empieza con la pregunta, tono divertido"
        />
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="removeSilences" defaultChecked className="size-4" /> Quitar pausas y silencios
      </label>

      <p className="text-xs text-muted">
        La IA elige los mejores momentos (puede poner la frase más fuerte al inicio), agrega el gancho y el CTA en
        pantalla, subtítulos y tu logo, y escribe el texto de la publicación. Se crea una versión nueva; las
        anteriores se conservan. Usa tu key: el costo lo cobra el proveedor a tu cuenta.
      </p>
      <Button type="submit" size="sm" disabled={pending || busy || !ai?.available}>
        <Wand2 className="size-3.5" />
        {pending ? "Enviando..." : busy ? "Edición en curso..." : "Editar con IA"}
      </Button>
      {state.error && <p className="text-sm text-red-700 dark:text-red-400">{state.error}</p>}
    </form>
  );
}
