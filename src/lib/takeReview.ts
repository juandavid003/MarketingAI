import type { PieceScene } from "@/lib/contentAi";

// The verdict shown next to each uploaded take. "rerecord" means: tell the
// owner to record this scene again, and why. checkedBy says how much we
// actually know — the audio-only AI check never claims to have seen the image.
export type TakeReview = {
  verdict: "ok" | "rerecord";
  reasons: string[]; // why to re-record (empty when ok)
  notes: string[]; // minor observations, never blocking
  tip: string;
  checkedBy: "rules" | "rules+audio_ai";
};

// Deterministic checks that need no AI: missing voice, far too short/long.
export function ruleBasedReview(input: {
  scene: PieceScene;
  hasAudio: boolean;
  takeSeconds: number;
  keptSeconds: number;
  speechSeconds: number;
}): TakeReview {
  const reasons: string[] = [];
  const notes: string[] = [];
  const expected = input.scene.duracionSegundos;
  const expectsSpeech = input.scene.queDecir.trim().length > 0;

  if (expectsSpeech && (!input.hasAudio || input.speechSeconds < 0.5)) {
    reasons.push(
      input.hasAudio
        ? "No se detectó voz y esta escena lleva diálogo. Revisa que el micrófono no esté tapado y habla más cerca del celular."
        : "El video no tiene audio y esta escena lleva diálogo."
    );
  }
  if (input.keptSeconds < expected * 0.4 && expected >= 3) {
    reasons.push(
      `La toma útil dura ${input.keptSeconds.toFixed(1)} s y el guion prevé unos ${expected} s: probablemente quedó cortada.`
    );
  } else if (input.keptSeconds > expected * 2.5 && input.keptSeconds - expected > 8) {
    notes.push(
      `La toma útil dura ${input.keptSeconds.toFixed(1)} s, bastante más de los ${expected} s previstos. El video final será más largo.`
    );
  }
  if (input.takeSeconds - input.keptSeconds > 1) {
    notes.push(`Se quitaron ${(input.takeSeconds - input.keptSeconds).toFixed(1)} s de silencios.`);
  }

  return {
    verdict: reasons.length > 0 ? "rerecord" : "ok",
    reasons,
    notes,
    tip: "",
    checkedBy: "rules",
  };
}

export function parseReview(raw: string | null): TakeReview | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as TakeReview;
  } catch {
    return null;
  }
}
