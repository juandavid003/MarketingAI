import type { PieceScene } from "@/lib/contentAi";
import type { KeySource } from "./types";

// Which AI to use, and why — shown next to every choice so the owner can
// pick another one knowingly. These are editorial rules from how each
// option works (real motion vs. a still with camera movement, native sound
// or not), not measured performance: nothing here claims a number.

export type SceneKind = "action" | "still" | "mixed";

// Spanish scripts: what the camera sees decides if a still can carry it.
const ACTION =
  /\b(persona|personas|gente|client[ea]s?|manos?|cocinand|preparand|sirviend|camin|corr|bail|habl|ríe|riendo|sonr|entrand|abriendo|mostrando cómo|aplicand|cortand|mezcland|vertiend|moviend|equipo|trabajand)/i;
const STILL =
  /\b(producto|plato|bebida|logo|fachada|local|vitrina|estante|empaque|botella|detalle|primer plano|close|foto|mesa servida|menú|letrero|vista|paisaje|interior)/i;

export function classifyScene(scene: Pick<PieceScene, "queMostrar" | "comoGrabar">): SceneKind {
  const text = `${scene.queMostrar} ${scene.comoGrabar}`;
  const action = ACTION.test(text);
  const still = STILL.test(text);
  if (action && !still) return "action";
  if (still && !action) return "still";
  return "mixed";
}

export type Ranked = { id: string; score: number; reasons: string[]; available: boolean };

export type Recommendation = {
  kind: SceneKind;
  ranking: Ranked[]; // best first, available or not
  best: string | null; // best the business can use now
  bestOverall: string;
  upgradeHint: string | null; // when a provider they lack would do better
};

const BASE: Record<string, number> = { gemini: 3, fal: 3, openai: 2 };
const NAME: Record<string, string> = { gemini: "Gemini Omni", fal: "Kling (fal.ai)", openai: "OpenAI imagen + movimiento" };

export function recommendProvider(input: {
  scene: Pick<PieceScene, "queMostrar" | "comoGrabar">;
  platforms: string[]; // Business.mainPlatforms
  available: string[]; // provider ids the business has keys for
  providerIds: string[]; // registry order, for ties
}): Recommendation {
  const kind = classifyScene(input.scene);
  const shortVertical = input.platforms.some((p) => ["instagram", "tiktok", "youtube"].includes(p)) || input.platforms.length === 0;

  const ranking: Ranked[] = input.providerIds.map((id) => {
    let score = BASE[id] ?? 1;
    const reasons: string[] = [];
    if (id === "openai") {
      if (kind === "action") {
        score -= 2;
        reasons.push("La escena tiene acción: una foto con movimiento de cámara no la muestra.");
      } else if (kind === "still") {
        score += 2;
        reasons.push("Escena de producto o lugar: la imagen sale nítida y fiel, y cuesta menos que un video.");
      } else {
        reasons.push("Funciona si la escena se entiende con una sola imagen.");
      }
    } else {
      if (kind === "action") {
        score += id === "fal" ? 1.5 : 1;
        reasons.push(id === "fal" ? "Kling cuida mejor el movimiento de personas y manos." : "Muestra movimiento real.");
      } else if (kind === "still") {
        reasons.push("Da movimiento real, aunque para un producto quieto una imagen basta.");
      } else {
        reasons.push("Movimiento real para lo que pasa en la escena.");
      }
      if (id === "gemini" && shortVertical) {
        score += 0.5;
        reasons.push("Trae sonido ambiente propio, que en Reels, TikTok y Shorts se nota.");
      }
    }
    return { id, score, reasons, available: input.available.includes(id) };
  });

  const order = (id: string) => input.providerIds.indexOf(id);
  ranking.sort((a, b) => b.score - a.score || order(a.id) - order(b.id));
  const best = ranking.find((r) => r.available)?.id ?? null;
  const bestOverall = ranking[0].id;
  const upgradeHint =
    best !== bestOverall && ranking[0].score - (ranking.find((r) => r.id === best)?.score ?? 0) >= 1
      ? `Para esta escena daría mejor resultado ${NAME[bestOverall] ?? bestOverall}: agrega su key en Negocio → Inteligencia artificial.`
      : null;
  return { kind, ranking, best, bestOverall, upgradeHint };
}

// The recommended combination per job, shown in Settings with what the
// business already has. `needs` = which key makes it work.
export type StackKeys = { anthropic: boolean; openai: boolean } & Record<Exclude<KeySource, "openai">, boolean>;

export const RECOMMENDED_STACK: {
  job: string;
  pick: string;
  why: string;
  needs: (keyof StackKeys)[]; // any of these
}[] = [
  {
    job: "Guiones, hooks y textos por red",
    pick: "Claude (Anthropic)",
    why: "Sigue bien el tono de marca y las instrucciones largas del guion. OpenAI (GPT) también sirve.",
    needs: ["anthropic", "openai"],
  },
  {
    job: "Subtítulos y revisión de lo que dices",
    pick: "OpenAI (Whisper)",
    why: "Transcribe tus tomas con tiempos exactos para los subtítulos. No hay alternativa en Claude.",
    needs: ["openai"],
  },
  {
    job: "Revisión visual de tomas",
    pick: "Google Gemini",
    why: "Es el único que mira el video: encuadre, luz, foco, si se ve lo que pide el guion.",
    needs: ["gemini"],
  },
  {
    job: "Escenas IA con acción o personas",
    pick: "Kling (fal.ai) o Gemini Omni",
    why: "Movimiento real. Gemini además genera el sonido; Kling cuida más las manos y las personas.",
    needs: ["fal", "gemini"],
  },
  {
    job: "Escenas IA de producto, platos o lugar",
    pick: "OpenAI imagen + movimiento",
    why: "Imagen nítida y fiel con movimiento de cámara y voz IA, por el costo de una imagen.",
    needs: ["openai"],
  },
];

// Same output for every network; what changes is how it's cut and written.
export const PLATFORM_TIPS: { platform: string; format: string; tip: string }[] = [
  { platform: "Instagram Reels", format: "9:16", tip: "Hook en los primeros 2 s y subtítulos siempre: muchos lo ven sin sonido." },
  { platform: "TikTok", format: "9:16", tip: "El sonido pesa: voz o ambiente real antes que música genérica; escenas con movimiento." },
  { platform: "YouTube Shorts", format: "9:16", tip: "Menos de 60 s, título claro; la primera escena tiene que explicar de qué va." },
  { platform: "Facebook", format: "4:5 en el feed, 9:16 en Reels", tip: "Audiencia mayor: más texto en pantalla y una llamada a la acción directa." },
];

export function stackStatus(keys: StackKeys) {
  return RECOMMENDED_STACK.map((row) => ({ ...row, ready: row.needs.some((k) => keys[k]) }));
}
