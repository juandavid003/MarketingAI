import { readFile, stat } from "fs/promises";
import { callProvider, extractJson } from "@/lib/ai";
import { formatBusinessContext, languageInstruction, type AiBusinessContext } from "@/lib/businessContext";
import type { TranscriptSegment } from "@/lib/whisper";
import type { Interval } from "@/lib/videoEdit";

// "Editar con IA" for an uploaded video: the owner picks which AI edits it
// (Claude Opus, OpenAI or Gemini — each on the business's own key) and the
// network it's for. The AI returns an EditPlan — which moments to keep and in
// what order (strongest line first), the on-screen hook and CTA, and the post
// text — and lib/jobs/aiVideoEdit.ts renders it with the same ffmpeg pipeline
// as assembled videos.
//
// Claude and OpenAI read the timed transcript; Gemini also watches a small
// proxy of the video, so it can pick moments by what's on screen.

export type EditProviderId = "anthropic" | "openai" | "gemini";

export const EDIT_PROVIDERS: Record<EditProviderId, { label: string; model: string; strengths: string }> = {
  anthropic: {
    label: "Claude Opus",
    model: process.env.VIDEO_EDIT_ANTHROPIC_MODEL ?? "claude-opus-5-5",
    strengths: "El mejor criterio narrativo y de copy: ganchos, orden de las frases y textos persuasivos.",
  },
  openai: {
    label: "OpenAI GPT",
    model: process.env.VIDEO_EDIT_OPENAI_MODEL ?? "gpt-5",
    strengths: "Muy buen editor de guion y copy, rápido; usa la misma key de OpenAI de la transcripción.",
  },
  gemini: {
    label: "Google Gemini",
    model: process.env.VIDEO_EDIT_GEMINI_MODEL ?? "gemini-2.5-pro",
    strengths: "Además de leer lo que se dice, mira el video: elige momentos por lo que se ve (producto, gestos, acción).",
  },
};

export const EDIT_PLATFORMS: Record<string, { label: string; minSeconds: number; maxSeconds: number; rules: string }> = {
  tiktok: {
    label: "TikTok",
    minSeconds: 12,
    maxSeconds: 35,
    rules:
      "gancho en el primer segundo (pregunta, dato sorprendente o promesa), ritmo rápido sin pausas, tono auténtico y cercano; caption de 1-2 frases que invite a comentar; 3 a 5 hashtags incluyendo de nicho",
  },
  instagram: {
    label: "Instagram Reels",
    minSeconds: 12,
    maxSeconds: 30,
    rules:
      "gancho visual y de texto en los primeros 2 segundos, ritmo ágil, cierre con CTA claro (guardar, compartir, escribir por DM); caption con la primera línea como gancho (se corta a ~125 caracteres), saltos de línea, 3 a 8 hashtags",
  },
  youtube: {
    label: "YouTube Shorts",
    minSeconds: 20,
    maxSeconds: 55,
    rules:
      "primera frase que plantee la promesa del video, contenido de valor (consejo, demostración), cierre que invite a suscribirse o al siguiente paso; \"titulo\" de máximo 70 caracteres con la palabra clave al inicio; descripción de 1-3 frases; 2 a 4 hashtags",
  },
  facebook: {
    label: "Facebook Reels",
    minSeconds: 15,
    maxSeconds: 60,
    rules:
      "pensado para verse sin sonido (los subtítulos y el texto en pantalla cuentan la historia), tono conversacional, beneficio concreto y CTA directo (escribir, llamar, visitar); caption de 1-3 párrafos cortos; 0 a 3 hashtags",
  },
};

export type EditPlan = {
  cuts: Interval[]; // in playback order (may differ from the original order)
  hook: string; // on screen during the first seconds
  cta: string; // on screen during the last seconds
  title: string; // YouTube title; "" elsewhere
  caption: string;
  hashtags: string[];
  reason: string;
};

export function buildEditPrompt(input: {
  business: AiBusinessContext;
  platform: string;
  segments: TranscriptSegment[];
  durationSeconds: number;
  instructions: string | null;
  watchesVideo: boolean;
}): string {
  const p = EDIT_PLATFORMS[input.platform];
  const lines = input.segments.map((s) => `[${s.start.toFixed(1)} - ${s.end.toFixed(1)}] ${s.text.trim()}`).join("\n");
  return `Eres un editor de video y estratega de contenido para redes sociales, experto en lograr retención y conversiones. Edita el video que grabó este negocio para publicarlo en ${p.label}.

${formatBusinessContext(input.business)}

${languageInstruction(input.business)}

Duración del video original: ${input.durationSeconds.toFixed(1)} s
${input.watchesVideo ? "Tienes el video adjunto (en baja resolución): úsalo para elegir momentos también por lo que se ve.\n" : ""}
Transcripción con tiempos en segundos:
${lines || "(sin diálogo detectado: elige por lo que se ve o por orden natural)"}

Reglas de ${p.label}: ${p.rules}.
${input.instructions?.trim() ? `\nIndicaciones del dueño del negocio (priorízalas): ${input.instructions.trim()}\n` : ""}
Cómo editar:
- Elige los fragmentos a conservar ("cortes") con inicio y fin en segundos del video original. Corta en los bordes de las frases, nunca a mitad de palabra.
- Ordénalos en el orden en que deben verse. Puedes mover la frase más fuerte al inicio como gancho, aunque en el original esté después.
- Elimina repeticiones, titubeos, arranques en falso y partes sin valor.
- Duración total entre ${p.minSeconds} y ${p.maxSeconds} s (si el video es más corto, usa lo mejor que haya).
- "hook": texto corto (máx. 8 palabras) para la pantalla en los primeros segundos. "cta": texto corto (máx. 8 palabras) para el final.
- "caption" y "hashtags": el texto de la publicación para ${p.label}. "titulo" solo para YouTube Shorts; en otras redes, cadena vacía.
- No inventes datos, precios ni promesas que no estén en el video o en el perfil del negocio.

Responde ÚNICAMENTE con JSON válido:
{"cortes": [{"inicio": 0, "fin": 0}], "hook": "", "cta": "", "titulo": "", "caption": "", "hashtags": ["#..."], "razon": "por qué este montaje funcionará en ${p.label}, en 1-2 frases"}`;
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

// The cuts drive ffmpeg directly: clamp them to the video, drop slivers and
// overlaps with an earlier cut, and cap the total so a bad answer can't
// produce a 10-minute "short".
export function validateEditPlan(value: unknown, durationSeconds: number, maxSeconds = 90): EditPlan {
  const v = (typeof value === "object" && value !== null ? value : {}) as Record<string, unknown>;
  const raw = Array.isArray(v.cortes) ? v.cortes : [];
  const cuts: Interval[] = [];
  let total = 0;
  for (const item of raw.slice(0, 20)) {
    const c = (typeof item === "object" && item !== null ? item : {}) as Record<string, unknown>;
    let s = Math.max(0, Math.min(Number(c.inicio), durationSeconds));
    let e = Math.max(0, Math.min(Number(c.fin), durationSeconds));
    if (!Number.isFinite(s) || !Number.isFinite(e) || e - s < 0.3) continue;
    // Overlapping an earlier cut would repeat footage: keep only the new part.
    for (const [ps, pe] of cuts) {
      if (s < pe && e > ps) {
        if (s >= ps) s = pe;
        else e = Math.min(e, ps);
      }
    }
    if (e - s < 0.3) continue;
    if (total + (e - s) > maxSeconds) e = s + (maxSeconds - total);
    if (e - s < 0.3) break;
    cuts.push([round3(s), round3(e)]);
    total += e - s;
  }
  if (cuts.length === 0) throw new Error("La IA no devolvió cortes válidos para este video. Intenta de nuevo.");

  const caption = str(v.caption);
  const hashtags = (Array.isArray(v.hashtags) ? v.hashtags : [])
    .map((h) => str(h).replace(/\s+/g, ""))
    .filter(Boolean)
    .map((h) => (h.startsWith("#") ? h : `#${h}`))
    .slice(0, 12);
  return {
    cuts,
    hook: str(v.hook).slice(0, 120),
    cta: str(v.cta).slice(0, 120),
    title: str(v.titulo).slice(0, 100),
    caption,
    hashtags,
    reason: str(v.razon),
  };
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

// Post text stored on the VideoVersion (what the publisher sends).
export function planCaption(plan: EditPlan): string {
  const tags = plan.hashtags.join(" ");
  return [plan.title, plan.caption, tags].filter(Boolean).join("\n\n");
}

// Clips the silence-free intervals of the whole video to one cut, so a cut
// keeps its speech but loses the pauses inside it.
export function clipKeepToCut(keep: Interval[], cut: Interval): Interval[] {
  const out: Interval[] = [];
  for (const [s, e] of keep) {
    const a = Math.max(s, cut[0]);
    const b = Math.min(e, cut[1]);
    if (b - a >= 0.2) out.push([a, b]);
  }
  return out.length > 0 ? out : [cut];
}

const MAX_GEMINI_INLINE_BYTES = 18 * 1024 * 1024;

async function callGemini(input: { apiKey: string; model: string; prompt: string; proxyPath: string | null }): Promise<string> {
  const parts: object[] = [];
  if (input.proxyPath && (await stat(input.proxyPath)).size <= MAX_GEMINI_INLINE_BYTES) {
    parts.push({ inline_data: { mime_type: "video/mp4", data: (await readFile(input.proxyPath)).toString("base64") } });
  }
  parts.push({ text: input.prompt });
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(input.model)}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": input.apiKey },
      signal: AbortSignal.timeout(300_000),
      body: JSON.stringify({
        contents: [{ role: "user", parts }],
        generationConfig: { responseMimeType: "application/json", mediaResolution: "MEDIA_RESOLUTION_LOW", maxOutputTokens: 8192 },
      }),
    }
  );
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`Gemini: ${json?.error?.message ?? res.status}`);
  const text: string = (json?.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? "").join("");
  if (!text) throw new Error("Respuesta vacía de Gemini.");
  return text;
}

export async function planVideoEdit(input: {
  provider: EditProviderId;
  apiKey: string;
  model: string;
  business: AiBusinessContext;
  platform: string;
  segments: TranscriptSegment[];
  durationSeconds: number;
  instructions: string | null;
  proxyPath: string | null; // Gemini only
}): Promise<EditPlan> {
  const watchesVideo = input.provider === "gemini" && !!input.proxyPath;
  const prompt = buildEditPrompt({ ...input, watchesVideo });
  const raw =
    input.provider === "gemini"
      ? await callGemini({ apiKey: input.apiKey, model: input.model, prompt, proxyPath: input.proxyPath })
      : await callProvider(input.provider, input.apiKey, input.model, prompt, 4000);
  return validateEditPlan(extractJson(raw), input.durationSeconds, EDIT_PLATFORMS[input.platform].maxSeconds + 15);
}
