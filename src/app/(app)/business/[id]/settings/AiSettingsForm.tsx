"use client";

import { useActionState } from "react";
import { saveAiSettings, saveGeminiKey, type AiSettingsState } from "../actions";
import { Input, Label } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";

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
        <Notice tone="danger">
          {state.error}
        </Notice>
      )}
      {state.success && (
        <Notice tone="success">
          Guardado correctamente.
        </Notice>
      )}

      {state.warning && (
        <Notice tone="warning">
          {state.warning}
        </Notice>
      )}

      <Button type="submit" disabled={pending}>
        {pending ? "Verificando..." : "Guardar"}
      </Button>
    </form>
  );
}

// Separate form: the Gemini key (visual review of takes) is optional and
// independent from the text provider.
export function GeminiKeyForm({ businessId }: { businessId: string }) {
  const [state, formAction, pending] = useActionState(saveGeminiKey.bind(null, businessId), initialState);
  return (
    <form action={formAction} className="space-y-2">
      <Label htmlFor="geminiApiKey">Google Gemini key para revisar la imagen de tus tomas (opcional)</Label>
      <Input id="geminiApiKey" name="geminiApiKey" type="password" autoComplete="off" placeholder="AIza..." required />
      <p className="text-xs text-muted">
        Con esta key, Gemini mira cada toma (encuadre, luz, enfoque, movimiento y si se ve lo que pide el guion) y te
        avisa si conviene regrabarla. Las tomas se envían a Google con tu propia key; el costo lo cobra Google a tu
        cuenta y te mostramos el estimado por toma. Créala gratis en Google AI Studio.
      </p>
      {state.error && <p className="text-sm text-red-700 dark:text-red-400">{state.error}</p>}
      {state.success && <p className="text-sm text-green-700 dark:text-green-400">Key verificada y guardada.</p>}
      {state.warning && <p className="text-sm text-amber-700 dark:text-amber-300">{state.warning}</p>}
      <Button type="submit" size="sm" variant="secondary" disabled={pending}>
        {pending ? "Verificando..." : "Guardar key de Gemini"}
      </Button>
    </form>
  );
}
