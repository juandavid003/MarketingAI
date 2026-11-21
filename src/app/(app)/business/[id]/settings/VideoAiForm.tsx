"use client";

import { useActionState, useState } from "react";
import { saveVideoAiSettings } from "./video-ai-actions";
import type { AiSettingsState } from "../actions";
import { Input, Label, Select } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";

export type VideoProviderOption = {
  id: string;
  label: string;
  keyLabel: string;
  keyPlaceholder: string;
  keyHelp: string;
  defaultModel: string;
  suggestedModels: { id: string; label: string }[];
};

const initialState: AiSettingsState = {};

// Provider, key and model for generated scenes. The model is free text with
// suggestions: when a provider ships a new model, the owner types its id —
// no app update needed.
export function VideoAiForm({
  businessId,
  providers,
  current,
  hasGeminiKey,
}: {
  businessId: string;
  providers: VideoProviderOption[];
  current: { provider: string | null; model: string | null; hasKey: boolean };
  hasGeminiKey: boolean;
}) {
  const [state, formAction, pending] = useActionState(saveVideoAiSettings.bind(null, businessId), initialState);
  const [providerId, setProviderId] = useState(current.provider ?? providers[0]?.id ?? "");
  const provider = providers.find((p) => p.id === providerId) ?? providers[0];
  const keyOptional =
    (provider.id === "gemini" && hasGeminiKey) || (current.provider === provider.id && current.hasKey);

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-1">
        <Label htmlFor="videoProvider">Proveedor de video</Label>
        <Select id="videoProvider" name="provider" value={providerId} onChange={(e) => setProviderId(e.target.value)}>
          {providers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </Select>
      </div>

      <div className="space-y-1">
        <Label htmlFor="videoApiKey">
          {provider.keyLabel} {keyOptional && <span className="font-normal text-muted">(opcional)</span>}
        </Label>
        <Input
          id="videoApiKey"
          name="apiKey"
          type="password"
          autoComplete="off"
          placeholder={keyOptional ? "Déjalo vacío para mantener la key actual" : provider.keyPlaceholder}
          required={!keyOptional}
        />
        <p className="text-xs text-muted">{provider.keyHelp}</p>
      </div>

      <div className="space-y-1">
        <Label htmlFor="videoModel">Modelo (opcional)</Label>
        <Input
          id="videoModel"
          name="model"
          list={`video-models-${provider.id}`}
          defaultValue={current.provider === provider.id ? (current.model ?? "") : ""}
          key={provider.id}
          placeholder={`Por defecto: ${provider.defaultModel}`}
        />
        <datalist id={`video-models-${provider.id}`}>
          {provider.suggestedModels.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </datalist>
        <p className="text-xs text-muted">
          Si el proveedor lanza un modelo nuevo, escribe aquí su nombre exacto. Vacío = el recomendado.
        </p>
      </div>

      {state.error && <Notice tone="danger">{state.error}</Notice>}
      {state.success && <Notice tone="success">Guardado.</Notice>}
      {state.warning && <Notice tone="warning">{state.warning}</Notice>}

      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Verificando..." : "Guardar video con IA"}
      </Button>
    </form>
  );
}
