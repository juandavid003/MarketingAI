"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Wand2, Sparkles, Star } from "lucide-react";
import {
  generateTakeWithAi,
  improveScenePrompt,
  type ImprovePromptState,
  type UploadTakeState,
} from "../../content-actions";
import { Button } from "@/components/ui/Button";
import { Select, Textarea, Label } from "@/components/ui/Field";

export type ProviderChoice = {
  id: string;
  label: string;
  strengths: string;
  available: boolean;
  recommended: boolean;
  reasons: string[];
};

const KIND_LABEL = {
  action: "escena con acción",
  still: "escena de producto o lugar",
  mixed: "escena mixta",
} as const;

// "¿No puedes grabarla?" — pick which AI makes the clip (the recommended one
// preselected, with why), review what it will show and what the voice says,
// optionally let the text AI (Claude/GPT) polish the description, generate.
export function AiTakeForm({
  businessId,
  pieceId,
  sceneNumber,
  defaultVisual,
  defaultNarration,
  choices,
  kind,
  upgradeHint,
  textAi,
  hasTake,
}: {
  businessId: string;
  pieceId: string;
  sceneNumber: number;
  defaultVisual: string;
  defaultNarration: string;
  choices: ProviderChoice[];
  kind: keyof typeof KIND_LABEL;
  upgradeHint: string | null;
  textAi: string | null; // "Claude" | "OpenAI" | null
  hasTake: boolean;
}) {
  const [genState, generateAction, generating] = useActionState(
    generateTakeWithAi.bind(null, businessId, pieceId, sceneNumber),
    {} as UploadTakeState
  );
  const [improveState, improveAction, improving] = useActionState(
    improveScenePrompt.bind(null, businessId, pieceId, sceneNumber),
    {} as ImprovePromptState
  );

  const usable = choices.filter((c) => c.available);
  const [providerId, setProviderId] = useState((usable.find((c) => c.recommended) ?? usable[0])?.id ?? "");
  const [visual, setVisual] = useState(defaultVisual);
  // Apply an improved description once, keeping later manual edits.
  const [applied, setApplied] = useState<string | undefined>(undefined);
  if (improveState.visual && improveState.visual !== applied) {
    setApplied(improveState.visual);
    setVisual(improveState.visual);
  }
  const selected = choices.find((c) => c.id === providerId);

  if (usable.length === 0) {
    return (
      <p className="text-xs text-muted">
        Para generar escenas con IA necesitas una key de OpenAI, Gemini o fal.ai.{" "}
        <Link href={`/business/${businessId}/settings`} className="text-brand hover:underline">
          Configúrala →
        </Link>
      </p>
    );
  }

  return (
    <details className="group rounded-md border border-dashed border-border p-3 text-sm">
      <summary className="flex cursor-pointer items-center gap-1.5 font-medium text-brand">
        <Wand2 className="size-3.5" /> {hasTake ? "Reemplazar con una toma generada con IA" : "¿No puedes grabarla? Genérala con IA"}
      </summary>
      <form action={generateAction} className="mt-3 space-y-3">
        <div className="space-y-1">
          <Label htmlFor={`provider-${sceneNumber}`}>Generar con</Label>
          <Select id={`provider-${sceneNumber}`} name="provider" value={providerId} onChange={(e) => setProviderId(e.target.value)}>
            {choices.map((c) => (
              <option key={c.id} value={c.id} disabled={!c.available}>
                {c.label}
                {c.recommended ? " — recomendada" : ""}
                {!c.available ? " (falta la key)" : ""}
              </option>
            ))}
          </Select>
          <p className="text-xs text-muted">
            Para esta {KIND_LABEL[kind]}
            {selected?.recommended ? (
              <span className="ml-1 inline-flex items-center gap-0.5 font-medium text-foreground">
                <Star className="size-3" /> es la recomendada:
              </span>
            ) : (
              ":"
            )}{" "}
            {selected?.reasons.join(" ")}
          </p>
          {upgradeHint && <p className="text-xs text-amber-700 dark:text-amber-300">{upgradeHint}</p>}
        </div>

        <div className="space-y-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Label htmlFor={`visual-${sceneNumber}`}>Qué se ve</Label>
            {textAi && (
              <Button type="submit" formAction={improveAction} size="sm" variant="secondary" disabled={improving || generating}>
                <Sparkles className="size-3.5" /> {improving ? "Mejorando..." : `Mejorar con ${textAi}`}
              </Button>
            )}
          </div>
          <Textarea
            id={`visual-${sceneNumber}`}
            name="prompt"
            rows={6}
            value={visual}
            onChange={(e) => setVisual(e.target.value)}
            required
          />
          {improveState.by && !improving && (
            <p className="text-xs text-muted">Reescrita por {improveState.by}. Revísala antes de generar.</p>
          )}
          {improveState.error && <p className="text-xs text-red-700 dark:text-red-400">{improveState.error}</p>}
        </div>

        <div className="space-y-1">
          <Label htmlFor={`narration-${sceneNumber}`}>Lo que dice la voz (vacío = sin voz)</Label>
          <Textarea id={`narration-${sceneNumber}`} name="narration" rows={2} defaultValue={defaultNarration} />
        </div>

        <p className="text-xs text-muted">
          Se genera con tu key; el costo lo cobra el proveedor a tu cuenta. Luego la revisamos y se arma como cualquier
          toma, con subtítulos y logo. Puede tardar unos minutos.
        </p>
        <Button type="submit" size="sm" disabled={generating || improving || !selected?.available}>
          <Wand2 className="size-3.5" />
          {generating ? "Enviando..." : "Generar escena"}
        </Button>
        {genState.error && <p className="text-sm text-red-700 dark:text-red-400">{genState.error}</p>}
      </form>
    </details>
  );
}
