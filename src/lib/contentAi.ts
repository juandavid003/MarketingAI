import { callProvider, extractJson, resolveModel, type AiProvider } from "@/lib/ai";
import { formatBusinessContext, languageInstruction, type AiBusinessContext } from "@/lib/businessContext";

// AI generators for the content pipeline (Modules B → D → E):
//   competitor posts → ideas → ContentPiece (script) → scene takes → review.
//
// Industry-agnostic: no prompt branches on industry. Everything specific
// comes from the business context and the real data passed in.

export type AiCredentials = { provider: AiProvider; apiKey: string; model: string | null };

export const PURPOSES = [
  { value: "awareness", label: "Reconocimiento de marca" },
  { value: "engagement", label: "Interacción" },
  { value: "leads", label: "Generar clientes potenciales" },
  { value: "conversion", label: "Conversión / venta" },
  { value: "loyalty", label: "Fidelización" },
] as const;
export type Purpose = (typeof PURPOSES)[number]["value"];

export function purposeLabel(value: string): string {
  return PURPOSES.find((p) => p.value === value)?.label ?? value;
}

function normalizePurpose(value: unknown): Purpose {
  return PURPOSES.some((p) => p.value === value) ? (value as Purpose) : "engagement";
}

const PURPOSE_LIST = PURPOSES.map((p) => `"${p.value}" (${p.label})`).join(", ");

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value.trim() : fallback;
}

function num(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : fallback;
}

function strList(value: unknown, max: number): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => str(v))
    .filter((v) => v.length > 0)
    .slice(0, max);
}

// ---------------------------------------------------------------------------
// Content piece: the generic script format
// ---------------------------------------------------------------------------

export type PieceScene = {
  numero: number;
  duracionSegundos: number;
  queMostrar: string; // what the camera sees
  queDecir: string; // exact words to say ("" if the scene has no speech)
  textoPantalla: string; // on-screen text ("" if none)
  comoGrabar: string; // framing, angle, light, movement — practical phone tips
};

export type GeneratedContentPiece = {
  titulo: string;
  proposito: Purpose;
  formato: string;
  duracionTotalSegundos: number;
  hook: string;
  escenas: PieceScene[];
  descripcion: string;
  hashtags: string[];
  ctas: string[];
};

export type PieceBrief = {
  // What this piece is about, in plain words (campaign piece, competitor
  // idea, or the owner's own request).
  brief: string;
  hook?: string;
  format?: string;
  purpose?: string;
  cta?: string;
  // Real competitor posts that inspired it — used as reference, never copied.
  references?: { competitor: string; caption: string; metrics: string }[];
};

function buildPiecePrompt(business: AiBusinessContext, input: PieceBrief): string {
  const refs =
    input.references && input.references.length > 0
      ? `\nPublicaciones reales de la competencia que inspiran esta pieza (úsalas como referencia de qué funciona; NO copies su texto ni su idea literal, adáptala a este negocio y diferénciate):\n${input.references
          .map((r, i) => `${i + 1}. ${r.competitor} — ${r.metrics}\n   "${r.caption.slice(0, 500)}"`)
          .join("\n")}\n`
      : "";

  return `Eres un estratega de contenido y guionista de video corto para redes sociales. Crea una pieza de contenido completa y lista para grabar con el celular, para el negocio de abajo.

${formatBusinessContext(business)}

Encargo: ${input.brief}
${input.hook ? `Hook sugerido (puedes mejorarlo): "${input.hook}"\n` : ""}${input.format ? `Formato sugerido: ${input.format}\n` : ""}${input.purpose ? `Propósito: ${input.purpose}\n` : ""}${input.cta ? `CTA sugerido: ${input.cta}\n` : ""}${refs}
${languageInstruction(business)}

Reglas:
- Divide el video en escenas cortas: cada escena es UNA toma que el dueño grabará por separado.
- "queDecir" es el texto exacto a decir a cámara o en voz en off, natural y breve (que se pueda decir en la duración de la escena). Usa "" si en esa escena no se habla.
- "queMostrar" describe lo que se ve. "comoGrabar" da instrucciones prácticas: encuadre, ángulo, luz, movimiento, vertical u horizontal.
- La primera escena contiene el hook; la última, el CTA.
- "descripcion" es el texto de la publicación (caption), sin los hashtags.
- Los CTAs deben ser concretos y usar los canales de contacto del negocio si están indicados.
- "proposito" debe ser uno de: ${PURPOSE_LIST}.

Responde ÚNICAMENTE con un objeto JSON válido (sin texto adicional, sin markdown) con esta forma exacta:
{
  "titulo": "nombre corto interno de la pieza",
  "proposito": "leads",
  "formato": "ej. Reel 9:16, TikTok, Short",
  "duracionTotalSegundos": 30,
  "hook": "frase de apertura que detiene el scroll",
  "escenas": [
    { "numero": 1, "duracionSegundos": 4, "queMostrar": "...", "queDecir": "...", "textoPantalla": "...", "comoGrabar": "..." }
  ],
  "descripcion": "caption de la publicación",
  "hashtags": ["#ejemplo"],
  "ctas": ["llamado a la acción principal", "alternativo"]
}
Incluye entre 3 y 7 escenas, entre 5 y 12 hashtags relevantes y entre 1 y 3 CTAs.`;
}

function validatePiece(value: unknown): GeneratedContentPiece {
  if (typeof value !== "object" || value === null) {
    throw new Error("La IA devolvió una respuesta con formato inesperado.");
  }
  const v = value as Record<string, unknown>;
  const hook = str(v.hook);
  if (!hook) throw new Error('La IA no incluyó el "hook".');
  if (!Array.isArray(v.escenas) || v.escenas.length === 0) {
    throw new Error("La IA no incluyó las escenas del guion.");
  }

  const escenas: PieceScene[] = v.escenas.slice(0, 10).map((item, index) => {
    const e = (typeof item === "object" && item !== null ? item : {}) as Record<string, unknown>;
    return {
      numero: index + 1, // renumbered: scene numbers key the uploaded takes
      duracionSegundos: Math.min(60, num(e.duracionSegundos, 5)),
      queMostrar: str(e.queMostrar),
      queDecir: str(e.queDecir),
      textoPantalla: str(e.textoPantalla),
      comoGrabar: str(e.comoGrabar),
    };
  });

  const hashtags = strList(v.hashtags, 15).map((h) => (h.startsWith("#") ? h : `#${h}`).replace(/\s+/g, ""));

  return {
    titulo: str(v.titulo) || hook.slice(0, 60),
    proposito: normalizePurpose(v.proposito),
    formato: str(v.formato) || "Reel 9:16",
    duracionTotalSegundos: num(
      v.duracionTotalSegundos,
      escenas.reduce((sum, e) => sum + e.duracionSegundos, 0)
    ),
    hook,
    escenas,
    descripcion: str(v.descripcion),
    hashtags,
    ctas: strList(v.ctas, 3),
  };
}

export async function generateContentPiece(
  ai: AiCredentials,
  business: AiBusinessContext,
  input: PieceBrief
): Promise<{ content: GeneratedContentPiece; resolvedModel: string }> {
  const resolvedModel = resolveModel(ai.provider, ai.model);
  const raw = await callProvider(ai.provider, ai.apiKey, resolvedModel, buildPiecePrompt(business, input), 4000);
  return { content: validatePiece(extractJson(raw)), resolvedModel };
}

// The full text to publish with the final video.
export function pieceCaption(piece: GeneratedContentPiece): string {
  return [piece.descripcion, piece.ctas[0], piece.hashtags.join(" ")]
    .filter((part) => part && part.trim().length > 0)
    .join("\n\n");
}

// ---------------------------------------------------------------------------
// Competitor ideas, grounded in real posts
// ---------------------------------------------------------------------------

export type CompetitorPostInput = {
  id: string; // CompetitorPost.id
  competitor: string;
  source: "instagram_api" | "manual";
  mediaType: string | null;
  caption: string;
  likes: number | null;
  comments: number | null;
  postedAt: Date | null;
  notes: string | null;
};

export type GeneratedCompetitorIdeas = {
  patrones: { tipo: string; descripcion: string; evidencia: string[] }[];
  oportunidades: string[];
  ideas: {
    titulo: string;
    porQue: string;
    proposito: Purpose;
    formato: string;
    hook: string;
    concepto: string;
    cta: string;
    referencias: string[]; // CompetitorPost ids
  }[];
};

function describeMetrics(p: { likes: number | null; comments: number | null; source: string }): string {
  const parts = [
    p.likes != null ? `${p.likes} me gusta` : null,
    p.comments != null ? `${p.comments} comentarios` : null,
  ].filter(Boolean);
  const origin = p.source === "manual" ? "registrado por el dueño" : "datos públicos de Instagram";
  return `${parts.length > 0 ? parts.join(", ") : "sin métricas"} (${origin})`;
}

export function postMetricsSummary(p: { likes: number | null; comments: number | null; source: string }): string {
  return describeMetrics(p);
}

function buildIdeasPrompt(business: AiBusinessContext, posts: CompetitorPostInput[]): string {
  const lines = posts
    .map((p, i) => {
      const when = p.postedAt ? p.postedAt.toISOString().slice(0, 10) : "fecha desconocida";
      return `[P${i + 1}] ${p.competitor} · ${p.mediaType ?? "formato desconocido"} · ${when} · ${describeMetrics(p)}
Texto: "${p.caption.slice(0, 600) || "(sin texto)"}"${p.notes ? `\nNota del dueño: ${p.notes}` : ""}`;
    })
    .join("\n\n");

  return `Eres un analista de contenido para redes sociales. Analiza publicaciones REALES de competidores de este negocio y propón ideas de video basadas en lo que les está funcionando.

${formatBusinessContext(business)}

Publicaciones de la competencia (ordenadas de mayor a menor interacción):
${lines}

${languageInstruction(business)}

Reglas estrictas:
- Basa cada patrón y cada idea SOLO en las publicaciones de arriba; cita sus identificadores ([P1], [P2]...) en "evidencia" y "referencias".
- No inventes métricas, seguidores, tendencias ni publicaciones que no estén en la lista.
- Las ideas deben adaptarse a este negocio y diferenciarse; nunca copiar el contenido del competidor.
- "tipo" de patrón: "hook", "tema", "formato", "cta" o "pregunta de la audiencia".
- "oportunidades": vacíos de contenido o maneras de diferenciarse que se desprenden de lo observado (máximo 4).
- "proposito" debe ser uno de: ${PURPOSE_LIST}.

Responde ÚNICAMENTE con un objeto JSON válido (sin texto adicional, sin markdown):
{
  "patrones": [ { "tipo": "hook", "descripcion": "...", "evidencia": ["P1", "P3"] } ],
  "oportunidades": ["..."],
  "ideas": [
    { "titulo": "...", "porQue": "por qué debería funcionar, citando lo observado", "proposito": "leads", "formato": "Reel 9:16", "hook": "...", "concepto": "de qué trata el video", "cta": "...", "referencias": ["P1"] }
  ]
}
Incluye entre 2 y 6 patrones y entre 3 y 6 ideas.`;
}

function validateIdeas(value: unknown, posts: CompetitorPostInput[]): GeneratedCompetitorIdeas {
  if (typeof value !== "object" || value === null) {
    throw new Error("La IA devolvió una respuesta con formato inesperado.");
  }
  const v = value as Record<string, unknown>;
  // Map the model's P1..Pn labels back to real ids, discarding anything it
  // made up — a pattern or idea with no valid evidence is dropped entirely.
  const toIds = (refs: unknown): string[] =>
    [...new Set(strList(refs, 10))]
      .map((ref) => {
        const n = Number(ref.replace(/[^0-9]/g, ""));
        return Number.isInteger(n) && n >= 1 && n <= posts.length ? posts[n - 1].id : null;
      })
      .filter((id): id is string => id !== null);

  const patrones = (Array.isArray(v.patrones) ? v.patrones : [])
    .map((item) => {
      const p = (typeof item === "object" && item !== null ? item : {}) as Record<string, unknown>;
      return { tipo: str(p.tipo) || "tema", descripcion: str(p.descripcion), evidencia: toIds(p.evidencia) };
    })
    .filter((p) => p.descripcion && p.evidencia.length > 0)
    .slice(0, 6);

  const ideas = (Array.isArray(v.ideas) ? v.ideas : [])
    .map((item) => {
      const i = (typeof item === "object" && item !== null ? item : {}) as Record<string, unknown>;
      return {
        titulo: str(i.titulo),
        porQue: str(i.porQue),
        proposito: normalizePurpose(i.proposito),
        formato: str(i.formato) || "Reel 9:16",
        hook: str(i.hook),
        concepto: str(i.concepto),
        cta: str(i.cta),
        referencias: toIds(i.referencias),
      };
    })
    .filter((i) => i.titulo && i.hook && i.referencias.length > 0)
    .slice(0, 6);

  if (ideas.length === 0) {
    throw new Error("La IA no devolvió ideas respaldadas por las publicaciones analizadas. Intenta de nuevo.");
  }
  return { patrones, oportunidades: strList(v.oportunidades, 4), ideas };
}

export async function generateCompetitorIdeas(
  ai: AiCredentials,
  business: AiBusinessContext,
  posts: CompetitorPostInput[]
): Promise<{ content: GeneratedCompetitorIdeas; resolvedModel: string }> {
  const resolvedModel = resolveModel(ai.provider, ai.model);
  const raw = await callProvider(ai.provider, ai.apiKey, resolvedModel, buildIdeasPrompt(business, posts), 4000);
  return { content: validateIdeas(extractJson(raw), posts), resolvedModel };
}

// ---------------------------------------------------------------------------
// Take review: "conviene volver a grabar esta escena porque…"
// ---------------------------------------------------------------------------

export type TakeReviewAi = { veredicto: "ok" | "regrabar"; motivos: string[]; consejo: string };

export async function reviewTakeWithAi(
  ai: AiCredentials,
  business: AiBusinessContext,
  input: {
    scene: PieceScene;
    transcriptText: string;
    takeSeconds: number;
    speechSeconds: number;
  }
): Promise<TakeReviewAi> {
  const prompt = `Eres un editor de video que revisa la toma de una escena antes de armar un video corto para redes.

${formatBusinessContext(business)}

Lo que pedía el guion para esta escena:
- Qué decir: "${input.scene.queDecir || "(sin diálogo)"}"
- Qué mostrar: ${input.scene.queMostrar}
- Duración prevista: ${input.scene.duracionSegundos} s

Lo que se grabó (medido):
- Duración de la toma: ${input.takeSeconds.toFixed(1)} s; con voz: ${input.speechSeconds.toFixed(1)} s
- Transcripción automática: "${input.transcriptText || "(no se detectó voz)"}"

Solo puedes juzgar el audio (lo dicho y su duración); no ves la imagen. Decide si conviene volver a grabar: por ejemplo si falta una parte importante del mensaje, se dijo algo distinto que cambia el sentido, la toma quedó cortada, o es mucho más larga de lo previsto. Pequeñas diferencias de palabras NO son motivo para regrabar.

${languageInstruction(business)}

Responde ÚNICAMENTE con JSON válido: { "veredicto": "ok" | "regrabar", "motivos": ["..."], "consejo": "qué hacer en la próxima toma, o cadena vacía" }`;

  const resolvedModel = resolveModel(ai.provider, ai.model);
  const raw = await callProvider(ai.provider, ai.apiKey, resolvedModel, prompt, 600);
  const v = extractJson(raw) as Record<string, unknown>;
  return {
    veredicto: v?.veredicto === "regrabar" ? "regrabar" : "ok",
    motivos: strList(v?.motivos, 4),
    consejo: str(v?.consejo),
  };
}
