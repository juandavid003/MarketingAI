import { callProvider, extractJson, resolveModel } from "@/lib/ai";
import { formatBusinessContext, languageInstruction, type AiBusinessContext } from "@/lib/businessContext";
import { purposeLabel, type AiCredentials, type GeneratedContentPiece } from "@/lib/contentAi";

// "El distribuidor": from one recorded script, plan how to publish it and
// squeeze it. The same body is reused with different openings (hooks) and
// closings (CTAs), so several creatives come out of one recording session.
//
// The test design is fixed here, not left to the AI, so it stays sound:
//   Phase 1 — every hook with the original CTA (C1): which opening stops the
//             scroll? Compared on views per post.
//   Phase 2 — the winning hook with every CTA: which closing gets action?
//             Compared on clicks/messages per 1,000 views.
// The AI writes the alternatives, the per-platform calendar and copy.

export type HookOption = {
  codigo: string; // H1..H4 — H1 is the script's own hook
  texto: string; // on-screen text over scene 1
  queDecir: string; // the opening line, if the owner records it
  angulo: string; // why this hook is different (curiosity, pain, result…)
  original: boolean;
};

export type CtaOption = {
  codigo: string; // C1..C3 — C1 is the script's main CTA
  texto: string; // on-screen text over the last scene + caption CTA
  angulo: string;
  original: boolean;
};

export type PlannedPost = {
  dia: number; // day of the plan, 1 = first publication
  fase: 1 | 2;
  plataforma: string;
  formato: "9:16" | "4:5";
  hook: string; // "H2" or "ganador" (phase 2)
  cta: string; // "C1"..
  momento: string; // suggested time of day
  copy: string; // caption written for this platform
  nota: string;
};

export type PlatformAdvice = { plataforma: string; formato: "9:16" | "4:5"; consejos: string[] };

export type DistributionStrategy = {
  resumen: string;
  hooks: HookOption[];
  ctas: CtaOption[];
  plataformas: PlatformAdvice[];
  calendario: PlannedPost[];
  reutilizar: string[];
  provider: string;
  model: string;
  generatedAt: string;
};

const DEFAULT_PLATFORMS = ["Instagram Reels", "TikTok", "Facebook Reels"];
const PLATFORM_NAMES: Record<string, string> = {
  instagram: "Instagram Reels",
  facebook: "Facebook Reels",
  tiktok: "TikTok",
  youtube: "YouTube Shorts",
};

export function planPlatforms(mainPlatforms: string[]): string[] {
  const names = mainPlatforms.map((p) => PLATFORM_NAMES[p] ?? p).filter(Boolean);
  return names.length > 0 ? names : DEFAULT_PLATFORMS;
}

// The script's own hook and CTA become H1 and C1, so the original creative is
// always part of the test.
export function originalHook(piece: GeneratedContentPiece): HookOption {
  const first = piece.escenas[0];
  return {
    codigo: "H1",
    texto: first?.textoPantalla || piece.hook,
    queDecir: first?.queDecir ?? "",
    angulo: "Hook original del guion",
    original: true,
  };
}

export function originalCta(piece: GeneratedContentPiece): CtaOption {
  const last = piece.escenas[piece.escenas.length - 1];
  return {
    codigo: "C1",
    texto: piece.ctas[0] || last?.textoPantalla || "",
    angulo: "CTA original del guion",
    original: true,
  };
}

export const variantCode = (hookCode: string, ctaCode: string) => `${hookCode}${ctaCode}`;

// The creatives the fixed test design needs before a winner is known:
// all hooks with C1, plus H1 with the other CTAs (so phase 2 can start right
// away if the owner wants; it is redone with the winning hook later).
export function defaultTestCodes(strategy: Pick<DistributionStrategy, "hooks" | "ctas">): string[] {
  const hookTest = strategy.hooks.map((h) => variantCode(h.codigo, "C1"));
  const ctaTest = strategy.ctas.filter((c) => c.codigo !== "C1").map((c) => variantCode("H1", c.codigo));
  return [...hookTest, ...ctaTest];
}

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function strList(value: unknown, max: number): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(str).filter(Boolean).slice(0, max);
}

function scriptSummary(piece: GeneratedContentPiece): string {
  return piece.escenas
    .map(
      (s) =>
        `Escena ${s.numero} (${s.duracionSegundos} s): muestra ${s.queMostrar}${s.queDecir ? ` / dice "${s.queDecir}"` : ""}${
          s.textoPantalla ? ` / texto en pantalla "${s.textoPantalla}"` : ""
        }`
    )
    .join("\n");
}

function buildStrategyPrompt(business: AiBusinessContext, piece: GeneratedContentPiece, platforms: string[]): string {
  const h1 = originalHook(piece);
  const c1 = originalCta(piece);
  return `Eres el distribuidor de contenido de un negocio: decides cómo publicar un video ya guionizado para sacarle el máximo provecho en redes, sin grabar videos nuevos.

${formatBusinessContext(business)}

El video (propósito: ${purposeLabel(piece.proposito)}, ~${Math.round(piece.duracionTotalSegundos)} s):
Título: ${piece.titulo}
${scriptSummary(piece)}
Descripción: ${piece.descripcion}

Cómo vamos a sacar varios creativos del mismo video:
- El cuerpo del video (escenas intermedias) es el mismo en todos.
- Cambia la APERTURA: el texto en pantalla de la escena 1 y, si el dueño la graba, una frase de apertura alternativa de 2 a 4 segundos.
- Cambia el CIERRE: el texto en pantalla de la última escena y el CTA del texto de la publicación.
- Hook original H1: "${h1.texto}"${h1.queDecir ? ` (dice: "${h1.queDecir}")` : ""}
- CTA original C1: "${c1.texto}"
- Prueba en dos fases (ya decidida, respétala):
  Fase 1: cada hook (H1, H2, H3, H4) con el CTA C1, para ver qué apertura detiene el scroll.
  Fase 2: el hook ganador con cada CTA (C1, C2, C3), para ver qué cierre genera más acción.
- Redes donde publicar: ${platforms.join(", ")}.

Tu tarea:
1. Escribe 3 hooks alternativos (H2, H3, H4), cada uno con un ángulo distinto entre sí y distinto del original (por ejemplo curiosidad, dolor o problema, resultado o beneficio, contraste, pregunta directa, error común). Deben ser coherentes con el cuerpo del video: quien vea el resto del video debe sentir que la promesa se cumple. "texto" es el texto en pantalla (máximo 8 palabras); "queDecir" la frase para decir a cámara (máximo 15 palabras).
2. Escribe 2 CTAs alternativos (C2, C3) con mecanismos distintos (por ejemplo escribir por mensaje, comentar una palabra, guardar, visitar el enlace, reservar). Usa los canales de contacto del negocio si están indicados. Máximo 10 palabras.
3. Arma un calendario: en la fase 1 publica cada hook con C1 en la MISMA red y a la MISMA franja horaria, en días distintos, para que la comparación sea justa; luego reparte en las demás redes. En la fase 2 usa "ganador" como hook. Para cada publicación escribe el "copy" adaptado a esa red (estilo, largo y hashtags propios de la red, incluyendo el CTA de esa publicación).
4. Por red: formato ("9:16" o "4:5") y consejos concretos de publicación.
5. "reutilizar": formas de seguir aprovechando el video ganador sin grabar más (historias, fijarlo en el perfil, responder comentarios con el video, etc.).

Reglas:
- No prometas resultados ni inventes cifras, estadísticas, horarios "comprobados" ni datos del algoritmo. Si sugieres un horario, preséntalo como punto de partida a validar con las métricas del propio negocio.
- Las publicaciones orgánicas no son un experimento perfecto; no lo presentes como tal.
${languageInstruction(business)}

Responde ÚNICAMENTE con un objeto JSON válido (sin texto adicional, sin markdown):
{
  "resumen": "la estrategia en 2-3 frases",
  "hooks": [ { "codigo": "H2", "texto": "...", "queDecir": "...", "angulo": "..." } ],
  "ctas": [ { "codigo": "C2", "texto": "...", "angulo": "..." } ],
  "plataformas": [ { "plataforma": "Instagram Reels", "formato": "9:16", "consejos": ["..."] } ],
  "calendario": [ { "dia": 1, "fase": 1, "plataforma": "Instagram Reels", "formato": "9:16", "hook": "H1", "cta": "C1", "momento": "...", "copy": "...", "nota": "..." } ],
  "reutilizar": ["..."]
}
El calendario debe tener entre 6 y 14 publicaciones repartidas en 2 a 3 semanas.`;
}

export function validateStrategy(
  value: unknown,
  piece: GeneratedContentPiece,
  platforms: string[]
): Omit<DistributionStrategy, "provider" | "model" | "generatedAt"> {
  if (typeof value !== "object" || value === null) {
    throw new Error("La IA devolvió una respuesta con formato inesperado.");
  }
  const v = value as Record<string, unknown>;
  const items = (x: unknown) =>
    (Array.isArray(x) ? x : []).map((i) => (typeof i === "object" && i !== null ? i : {}) as Record<string, unknown>);

  // Codes are reassigned server-side: whatever the model numbered, the
  // alternatives become H2.. and C2.. in order, after the originals.
  const altHooks: Omit<HookOption, "codigo" | "original">[] = [];
  const hookCodeMap = new Map<string, string>();
  for (const h of items(v.hooks)) {
    const texto = str(h.texto);
    if (!texto || altHooks.length >= 3) continue;
    altHooks.push({ texto, queDecir: str(h.queDecir), angulo: str(h.angulo) });
    const code = str(h.codigo).toUpperCase();
    if (code) hookCodeMap.set(code, `H${altHooks.length + 1}`);
  }
  const altCtas: Omit<CtaOption, "codigo" | "original">[] = [];
  const ctaCodeMap = new Map<string, string>();
  for (const c of items(v.ctas)) {
    const texto = str(c.texto);
    if (!texto || altCtas.length >= 2) continue;
    altCtas.push({ texto, angulo: str(c.angulo) });
    const code = str(c.codigo).toUpperCase();
    if (code) ctaCodeMap.set(code, `C${altCtas.length + 1}`);
  }
  if (altHooks.length === 0) throw new Error("La IA no propuso hooks alternativos. Intenta de nuevo.");

  const hooks: HookOption[] = [
    originalHook(piece),
    ...altHooks.map((h, i) => ({ codigo: `H${i + 2}`, ...h, original: false })),
  ];
  const ctas: CtaOption[] = [
    originalCta(piece),
    ...altCtas.map((c, i) => ({ codigo: `C${i + 2}`, ...c, original: false })),
  ];
  const hookCodes = new Set(hooks.map((h) => h.codigo));
  const ctaCodes = new Set(ctas.map((c) => c.codigo));
  const fmt = (x: unknown): "9:16" | "4:5" => (str(x) === "4:5" ? "4:5" : "9:16");

  const calendario = items(v.calendario)
    .map((p): PlannedPost | null => {
      const fase = Number(p.fase) === 2 ? 2 : 1;
      const rawHook = str(p.hook).toUpperCase();
      const hook = fase === 2 ? "ganador" : hookCodeMap.get(rawHook) ?? rawHook;
      const rawCta = str(p.cta).toUpperCase();
      const cta = ctaCodeMap.get(rawCta) ?? rawCta;
      if (fase === 1 && (!hookCodes.has(hook) || cta !== "C1")) return null;
      if (!ctaCodes.has(cta)) return null;
      const dia = Math.round(Number(p.dia));
      return {
        dia: Number.isFinite(dia) && dia > 0 ? Math.min(dia, 60) : 1,
        fase,
        plataforma: str(p.plataforma) || platforms[0],
        formato: fmt(p.formato),
        hook,
        cta,
        momento: str(p.momento),
        copy: str(p.copy),
        nota: str(p.nota),
      };
    })
    .filter((p): p is PlannedPost => p !== null)
    .sort((a, b) => a.dia - b.dia || a.fase - b.fase)
    .slice(0, 20);

  if (calendario.length === 0) {
    throw new Error("La IA no devolvió un calendario válido. Intenta de nuevo.");
  }

  const plataformas = items(v.plataformas)
    .map((p) => ({ plataforma: str(p.plataforma), formato: fmt(p.formato), consejos: strList(p.consejos, 5) }))
    .filter((p) => p.plataforma)
    .slice(0, 5);

  return {
    resumen: str(v.resumen),
    hooks,
    ctas,
    plataformas,
    calendario,
    reutilizar: strList(v.reutilizar, 6),
  };
}

export async function generateDistributionStrategy(
  ai: AiCredentials,
  business: AiBusinessContext,
  piece: GeneratedContentPiece
): Promise<DistributionStrategy> {
  const platforms = planPlatforms(business.mainPlatforms);
  const resolvedModel = resolveModel(ai.provider, ai.model);
  const raw = await callProvider(ai.provider, ai.apiKey, resolvedModel, buildStrategyPrompt(business, piece, platforms), 5000);
  return {
    ...validateStrategy(extractJson(raw), piece, platforms),
    provider: ai.provider,
    model: resolvedModel,
    generatedAt: new Date().toISOString(),
  };
}

export function parseStrategy(raw: string | null): DistributionStrategy | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as DistributionStrategy;
  } catch {
    return null;
  }
}

// Caption for a creative: the script's description with this creative's CTA.
export function variantCaption(piece: GeneratedContentPiece, ctaText: string): string {
  return [piece.descripcion, ctaText, piece.hashtags.join(" ")]
    .filter((part) => part && part.trim().length > 0)
    .join("\n\n");
}

// Roughly how long an opening line takes to say (≈2.6 words/s), for the
// "too short" check on recorded alternative hooks.
export function estimateSpeechSeconds(text: string): number {
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(2, Math.round((words / 2.6) * 10) / 10);
}
