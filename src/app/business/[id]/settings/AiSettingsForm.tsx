"use client";

import { useActionState } from "react";
import { saveAiSettings, type AiSettingsState } from "../actions";

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
        <label htmlFor="apiKey" className="block text-sm font-medium">
          API key
        </label>
        <input
          id="apiKey"
          name="apiKey"
          type="password"
          autoComplete="off"
          required
          placeholder="sk-..."
          className="w-full rounded-md border border-neutral-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-black dark:border-neutral-700 dark:focus:border-white"
        />
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          Se guarda cifrada. Nunca se vuelve a mostrar en pantalla ni se comparte con nadie más que tu propia cuenta.
        </p>
      </div>

      <div className="space-y-1">
        <label htmlFor="model" className="block text-sm font-medium">
          Modelo (opcional)
        </label>
        <input
          id="model"
          name="model"
          type="text"
          placeholder="Por defecto: claude-sonnet-5 / gpt-5-mini"
          className="w-full rounded-md border border-neutral-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-black dark:border-neutral-700 dark:focus:border-white"
        />
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          Déjalo vacío para usar el modelo por defecto de cada proveedor.
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

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
      >
        {pending ? "Guardando..." : "Guardar"}
      </button>
    </form>
  );
}
