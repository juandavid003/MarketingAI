import { execFile } from "child_process";
import { promisify } from "util";
import { readFile, stat } from "fs/promises";
import { ffmpegPath } from "@/lib/video";
import type { PieceScene } from "@/lib/contentAi";

// Visual review of a scene take with Google Gemini (the "Gemini spike"):
// the model watches a small proxy of the take and says whether the framing,
// light, focus, movement and content match what the scene asked for.
//
// Client-owned key (Business.geminiApiKeyEncrypted). We send a low-res proxy
// (480p, 5 fps, mono audio, max 90 s) inline and ask for low media
// resolution, which is enough to judge framing/light and keeps the cost per
// take small. Every review records its token usage so the spike can measure
// the real cost per take.

const execFileAsync = promisify(execFile);

export const GEMINI_VIDEO_MODEL = process.env.GEMINI_VIDEO_MODEL ?? "gemini-2.5-flash";
// Reference prices in USD per 1M tokens, used only for the on-screen
// estimate (Google bills the client's own account). Override if they change.
const PRICE_IN = Number(process.env.GEMINI_PRICE_INPUT_PER_M ?? "0.30");
const PRICE_OUT = Number(process.env.GEMINI_PRICE_OUTPUT_PER_M ?? "2.50");
const MAX_INLINE_BYTES = 18 * 1024 * 1024; // inline requests are capped at 20 MB

export type VisualIssue = { tipo: string; detalle: string };

export type VisualReview = {
  verdict: "ok" | "rerecord";
  issues: VisualIssue[];
  tip: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
};

export async function makeReviewProxy(inputPath: string, outputPath: string): Promise<void> {
  await execFileAsync(
    ffmpegPath(),
    [
      "-y",
      "-i",
      inputPath,
      "-t",
      "90",
      "-vf",
      "scale=-2:480,fps=5",
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "30",
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      "-b:a",
      "48k",
      "-ac",
      "1",
      "-threads",
      "2",
      outputPath,
    ],
    { maxBuffer: 1024 * 1024 * 16 }
  );
}

function buildPrompt(scene: PieceScene, language: string): string {
  return `Eres un director de fotografía que revisa la toma de UNA escena de un video corto para redes sociales, grabada con celular por el dueño de un negocio (no es profesional).

Lo que pedía el guion para esta escena:
- Qué debe verse: ${scene.queMostrar || "(sin indicación)"}
- Cómo grabarla: ${scene.comoGrabar || "(sin indicación)"}
- Qué se dice: ${scene.queDecir ? `"${scene.queDecir}"` : "(sin diálogo)"}
- Texto que irá en pantalla arriba: ${scene.textoPantalla ? `"${scene.textoPantalla}"` : "(ninguno)"}

Mira el video y decide si conviene volver a grabarla. Revisa solo lo que ves y oyes:
- encuadre (sujeto cortado, demasiado lejos, mucho espacio vacío, zona superior tapada por el texto),
- luz (muy oscura, contraluz, quemada),
- enfoque o nitidez,
- movimiento (temblor fuerte, giros bruscos),
- contenido (no se ve lo que pide el guion),
- audio (ruido fuerte, voz que no se entiende),
- orientación (horizontal cuando el video final es vertical: es aceptable si lo importante queda en el centro).
Sé práctico: pide regrabar solo si el problema se notará en el video final. Detalles menores no son motivo.
Escribe los textos en ${language}.

Responde ÚNICAMENTE con JSON: {"veredicto": "ok" | "regrabar", "problemas": [{"tipo": "encuadre|luz|enfoque|movimiento|contenido|audio|orientacion", "detalle": "qué pasa y en qué segundo, si aplica"}], "consejo": "qué hacer en la próxima toma, o cadena vacía"}`;
}

export async function reviewTakeVisually(input: {
  apiKey: string;
  proxyPath: string;
  scene: PieceScene;
  language: string;
}): Promise<VisualReview> {
  const size = (await stat(input.proxyPath)).size;
  if (size > MAX_INLINE_BYTES) throw new Error("La toma es demasiado larga para la revisión visual.");
  const data = (await readFile(input.proxyPath)).toString("base64");

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_VIDEO_MODEL)}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": input.apiKey },
      signal: AbortSignal.timeout(120_000),
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ inline_data: { mime_type: "video/mp4", data } }, { text: buildPrompt(input.scene, input.language) }],
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
          mediaResolution: "MEDIA_RESOLUTION_LOW",
          maxOutputTokens: 2048,
        },
      }),
    }
  );
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(`Gemini: ${json?.error?.message ?? res.status}`);
  }

  const text: string = (json?.candidates?.[0]?.content?.parts ?? [])
    .map((p: { text?: string }) => p.text ?? "")
    .join("");
  const usage = json?.usageMetadata ?? {};
  const inputTokens = Number(usage.promptTokenCount ?? 0);
  // Thinking tokens are billed as output.
  const outputTokens = Number(usage.candidatesTokenCount ?? 0) + Number(usage.thoughtsTokenCount ?? 0);
  return {
    ...parseVisualVerdict(text),
    model: GEMINI_VIDEO_MODEL,
    inputTokens,
    outputTokens,
    costUsd: (inputTokens * PRICE_IN + outputTokens * PRICE_OUT) / 1_000_000,
  };
}

export function parseVisualVerdict(text: string): Pick<VisualReview, "verdict" | "issues" | "tip"> {
  let v: Record<string, unknown> = {};
  try {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    v = JSON.parse(start >= 0 ? text.slice(start, end + 1) : text);
  } catch {
    throw new Error("Gemini devolvió una respuesta que no se pudo leer.");
  }
  const issues = (Array.isArray(v.problemas) ? v.problemas : [])
    .map((p) => (typeof p === "object" && p !== null ? (p as Record<string, unknown>) : {}))
    .map((p) => ({ tipo: String(p.tipo ?? "").trim() || "otro", detalle: String(p.detalle ?? "").trim() }))
    .filter((p) => p.detalle)
    .slice(0, 6);
  return {
    verdict: v.veredicto === "regrabar" ? "rerecord" : "ok",
    issues,
    tip: typeof v.consejo === "string" ? v.consejo.trim() : "",
  };
}

export const VISUAL_ISSUE_LABEL: Record<string, string> = {
  encuadre: "Encuadre",
  luz: "Luz",
  enfoque: "Enfoque",
  movimiento: "Movimiento",
  contenido: "Contenido",
  audio: "Audio",
  orientacion: "Orientación",
};
