"use client";

import { useActionState } from "react";
import { saveAiSettings, type AiSettingsState } from "../actions";
import { Input, Label } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";

const initialState: AiSettingsState = {};

export default function AiSettingsForm({ businessId }: { businessId: string }) {
  const [state, formAction, pending] = useActionState(
    saveAiSettings.bind(null, businessId),
    initialState
  );

  return (
    <form action={formAction} className="space-y-5">
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Proveedor de IA</legend>
        <label className="flex items-center gap-2 text-sm">
          <input type="radio" name="provider" value="anthropic" defaultChecked required />
          Anthropic (Claude)
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="radio" name="provider" value="openai" required />
          OpenAI (GPT)
        </label>
      </fieldset>

      <div className="space-y-1">
        <Label htmlFor="apiKey">API key</Label>
        <Input id="apiKey" name="apiKey" type="password" autoComplete="off" required placeholder="sk-..." />
        <p className="text-xs text-muted">
          Se guarda cifrada. Nunca se vuelve a mostrar en pantalla ni se comparte con nadie más
          que tu propia cuenta.
        </p>
      </div>

      <div className="space-y-1">
        <Label htmlFor="model">Modelo (opcional)</Label>
        <Input id="model" name="model" type="text" placeholder="Por defecto: claude-sonnet-5 / gpt-5-mini" />
        <p className="text-xs text-muted">Déjalo vacío para usar el modelo por defecto de cada proveedor.</p>
      </div>

      <div className="space-y-1 border-t border-border pt-5">
        <Label htmlFor="openaiTranscriptionKey">OpenAI key para transcripción de video (opcional)</Label>
        <Input
          id="openaiTranscriptionKey"
          name="openaiTranscriptionKey"
          type="password"
          autoComplete="off"
          placeholder="sk-..."
        />
        <p className="text-xs text-muted">
          Necesaria solo para editar videos con IA (transcripción con Whisper). Independiente del
          proveedor elegido arriba para generar texto.
        </p>
      </div>

      <div className="space-y-1 border-t border-border pt-5">
        <Label htmlFor="openaiImageKey">OpenAI key para generar imágenes (opcional)</Label>
        <Input id="openaiImageKey" name="openaiImageKey" type="password" autoComplete="off" placeholder="sk-..." />
        <p className="text-xs text-muted">
          Necesaria para generar imágenes de campaña (GPT Image). Si ya elegiste OpenAI como
          proveedor arriba, no hace falta repetirla — se reutiliza automáticamente.
        </p>
      </div>

      {state.error && (
        <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="rounded-md bg-green-50 px-4 py-3 text-sm text-green-700 dark:bg-green-950 dark:text-green-300">
          Guardado correctamente.
        </p>
      )}

      <Button type="submit" disabled={pending}>
        {pending ? "Guardando..." : "Guardar"}
      </Button>
    </form>
  );
}
