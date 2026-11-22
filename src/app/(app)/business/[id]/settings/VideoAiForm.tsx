"use client";

import { useActionState } from "react";
import { CheckCircle2, Circle } from "lucide-react";
import { saveVideoAiSettings } from "./video-ai-actions";
import type { AiSettingsState } from "../actions";
import { Input, Label, Select } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";

export type VideoProviderOption = {
  id: string;
  label: string;
  strengths: string;
  keyWhere: string; // where its key comes from
  available: boolean;
  defaultModel: string;
  model: string; // business override ("" = default)
  suggestedModels: { id: string; label: string }[];
};

// Which AI makes the generated scenes. Models are free text with
// suggestions: when a provider ships a new model, the owner types its id —
// no app update needed.
export function VideoAiForm({
  businessId,
  providers,
  preferred,
  hasFalKey,
}: {
  businessId: string;
  providers: VideoProviderOption[];
  preferred: string | null;
  hasFalKey: boolean;
}) {
  const [state, formAction, pending] = useActionState(saveVideoAiSettings.bind(null, businessId), {} as AiSettingsState);

  return (
    <form action={formAction} className="space-y-5">
      <ul className="space-y-3">
        {providers.map((p) => (
          <li key={p.id} className="rounded-md border border-border p-3 text-sm">
            <p className="flex items-center gap-1.5 font-medium">
              {p.available ? (
                <CheckCircle2 className="size-4 text-green-600 dark:text-green-400" />
              ) : (
                <Circle className="size-4 text-faint" />
              )}
              {p.label}
              <span className="font-normal text-muted">· {p.available ? "lista" : p.keyWhere}</span>
            </p>
            <p className="mt-1 text-muted">{p.strengths}</p>
            <div className="mt-2 space-y-1">
              <Label htmlFor={`model_${p.id}`} className="text-xs">
                Modelo (opcional)
              </Label>
              <Input
                id={`model_${p.id}`}
                name={`model_${p.id}`}
                list={`models-${p.id}`}
                defaultValue={p.model}
                placeholder={`Por defecto: ${p.defaultModel}`}
              />
              <datalist id={`models-${p.id}`}>
                {p.suggestedModels.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </datalist>
            </div>
            {p.id === "fal" && (
              <div className="mt-2 space-y-1">
                <Label htmlFor="falKey" className="text-xs">
                  fal.ai API key {hasFalKey && <span className="font-normal text-muted">(guardada; pega otra para cambiarla)</span>}
                </Label>
                <Input id="falKey" name="falKey" type="password" autoComplete="off" placeholder="Créala en fal.ai → Keys" />
              </div>
            )}
          </li>
        ))}
      </ul>

      <div className="space-y-1">
        <Label htmlFor="preferred">IA para escenas</Label>
        <Select id="preferred" name="preferred" defaultValue={preferred ?? ""}>
          <option value="">Automática: la recomendada para cada escena</option>
          {providers.map((p) => (
            <option key={p.id} value={p.id} disabled={!p.available}>
              Siempre {p.label}
              {!p.available ? " (falta la key)" : ""}
            </option>
          ))}
        </Select>
        <p className="text-xs text-muted">Igual puedes cambiarla en cada escena antes de generar.</p>
      </div>

      {state.error && <Notice tone="danger">{state.error}</Notice>}
      {state.success && <Notice tone="success">Guardado.</Notice>}
      {state.warning && <Notice tone="warning">{state.warning}</Notice>}

      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Guardando..." : "Guardar video con IA"}
      </Button>
    </form>
  );
}
