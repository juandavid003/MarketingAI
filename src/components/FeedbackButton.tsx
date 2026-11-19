"use client";

import { useActionState, useState } from "react";
import { MessageSquarePlus } from "lucide-react";
import { sendFeedback, type FeedbackState } from "@/app/(app)/feedback-actions";

// "Enviar comentarios" in the sidebar: pilot users tell us what's missing or
// broken without leaving the app. Read by the admin in /admin.
export function FeedbackButton({ businessId, path }: { businessId: string | null; path: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<FeedbackState, FormData>(sendFeedback, {});

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted hover:bg-black/5 hover:text-foreground dark:hover:bg-white/5"
      >
        <MessageSquarePlus className="size-4" />
        Enviar comentarios
      </button>
    );
  }

  if (state.ok) {
    return (
      <div className="rounded-md border border-border p-2 text-sm">
        <p>¡Gracias! Lo leemos todo.</p>
        <button type="button" onClick={() => setOpen(false)} className="mt-1 text-xs text-brand hover:underline">
          Cerrar
        </button>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-2 rounded-md border border-border p-2">
      <input type="hidden" name="path" value={path} />
      <input type="hidden" name="businessId" value={businessId ?? ""} />
      <select
        name="kind"
        defaultValue="idea"
        className="w-full rounded-md border border-border bg-transparent px-2 py-1 text-sm"
        aria-label="Tipo de comentario"
      >
        <option value="idea">Idea o sugerencia</option>
        <option value="problem">Algo no funciona</option>
        <option value="praise">Algo que me gustó</option>
      </select>
      <textarea
        name="message"
        rows={3}
        required
        placeholder="Cuéntanos…"
        className="w-full rounded-md border border-border bg-transparent px-2 py-1 text-sm outline-none focus:border-brand"
      />
      {state.error && <p className="text-xs text-red-600 dark:text-red-400">{state.error}</p>}
      <div className="flex items-center justify-between">
        <button type="button" onClick={() => setOpen(false)} className="text-xs text-muted hover:text-foreground">
          Cancelar
        </button>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-brand px-3 py-1 text-xs font-medium text-brand-foreground hover:bg-brand-hover disabled:opacity-60"
        >
          {pending ? "Enviando…" : "Enviar"}
        </button>
      </div>
    </form>
  );
}
