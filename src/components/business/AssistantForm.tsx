"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { SendHorizontal } from "lucide-react";
import type { AskState } from "@/app/(app)/business/[id]/assistant/actions";
import { MAX_QUESTION_CHARS } from "@/lib/assistant";

export function AssistantForm({
  action,
  disabled,
  suggestions,
}: {
  action: (prev: AskState, formData: FormData) => Promise<AskState>;
  disabled: boolean;
  suggestions: string[];
}) {
  const [question, setQuestion] = useState("");
  const [state, formAction, pending] = useActionState<AskState, FormData>(async (prev, formData) => {
    const result = await action(prev, formData);
    // Keep the text when the question failed, so it can be sent again.
    if (result.asked) setQuestion("");
    return result;
  }, {});
  const [asking, setAsking] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  // A new answer arrived: bring the form back into view.
  useEffect(() => {
    if (!state.asked) return;
    formRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [state.asked]);

  function ask(text: string) {
    setQuestion(text);
    // Wait for the textarea to hold the text before submitting.
    requestAnimationFrame(() => formRef.current?.requestSubmit());
  }

  return (
    <div className="mt-6">
      {pending && (
        <div className="mb-4 space-y-3">
          <div className="flex justify-end">
            <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-brand px-4 opacity-70 py-2 text-sm text-brand-foreground">
              {asking}
            </p>
          </div>
          <p className="animate-pulse text-sm text-muted">Revisando tus datos…</p>
        </div>
      )}

      {suggestions.length > 0 && !pending && (
        <div className="mb-3 flex flex-wrap gap-2">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              disabled={disabled}
              onClick={() => ask(s)}
              className="rounded-full border border-border px-3 py-1 text-xs hover:border-brand hover:text-brand disabled:opacity-50"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <form
        ref={formRef}
        action={formAction}
        onSubmit={() => setAsking(question)}
        className="flex items-end gap-2 rounded-xl border border-border bg-surface p-2 focus-within:border-brand"
      >
        <textarea
          name="question"
          rows={2}
          required
          maxLength={MAX_QUESTION_CHARS}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (question.trim()) formRef.current?.requestSubmit();
            }
          }}
          disabled={disabled}
          readOnly={pending}
          placeholder={disabled ? "Configura la IA del negocio para usar el asistente" : "Pregunta sobre tus resultados, tus leads o qué publicar…"}
          className="min-h-10 flex-1 resize-none bg-transparent px-2 py-1 text-sm outline-none"
        />
        <button
          type="submit"
          disabled={disabled || pending || !question.trim()}
          aria-label="Preguntar"
          className="rounded-lg bg-brand p-2 text-brand-foreground hover:bg-brand-hover disabled:opacity-50"
        >
          <SendHorizontal className="size-4" />
        </button>
      </form>
      {state.error && !pending && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{state.error}</p>}
    </div>
  );
}
