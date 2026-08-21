export type AiProvider = "anthropic" | "openai";

export type GeneratedCampaign = {
  objetivo: string;
  audiencia: string;
  concepto: string;
  contenido: { hook: string; formato: string }[];
  oferta: string;
  cta: string;
};

type CampaignBusinessInput = {
  name: string;
  industry: string;
  description: string;
  targetAudience: string;
  location: string;
  objective: string;
  products: { name: string }[];
};

const DEFAULT_MODELS: Record<AiProvider, string> = {
  anthropic: "claude-sonnet-5",
  openai: "gpt-5-mini",
};

function resolveModel(provider: AiProvider, override: string | null): string {
  return override?.trim() || DEFAULT_MODELS[provider];
}

function buildPrompt(
  business: CampaignBusinessInput,
  insightSummary: string,
  briefKind: "insight" | "goal"
): string {
  const productNames = business.products.map((p) => p.name).join(", ") || "sus productos/servicios";
  const briefLabel = briefKind === "goal" ? "Lo que el dueño del negocio quiere lograr" : "Oportunidad detectada";
  const basisPhrase =
    briefKind === "goal"
      ? "basada en lo que el dueño del negocio te pide directamente."
      : "basada en la oportunidad detectada.";

  return `Eres un estratega de marketing experto en negocios locales. Genera una propuesta de campaña de marketing en español para el siguiente negocio, ${basisPhrase}

Negocio: ${business.name}
Industria: ${business.industry}
Qué vende: ${business.description}
Productos/servicios: ${productNames}
Audiencia objetivo: ${business.targetAudience}
Ubicación: ${business.location}
Objetivo de negocio: ${business.objective}

${briefLabel}: ${insightSummary}

Responde ÚNICAMENTE con un objeto JSON válido (sin texto adicional, sin markdown, sin comentarios) con esta forma exacta:
{
  "objetivo": "el objetivo concreto de esta campaña",
  "audiencia": "descripción breve del público objetivo de esta campaña específica",
  "concepto": "la gran idea o hook central de la campaña, en una frase",
  "contenido": [
    { "hook": "texto del gancho inicial", "formato": "ej. Reel, Post, Historia" }
  ],
  "oferta": "oferta u oferta especial recomendada",
  "cta": "llamado a la acción concreto"
}
Incluye entre 3 y 4 elementos en "contenido".`;
}

async function callAnthropic(apiKey: string, model: string, prompt: string): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 1500,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(`Anthropic API error: ${json?.error?.message ?? JSON.stringify(json)}`);
  }
  // Some models prepend a "thinking" content block before the actual "text"
  // block, so the response text isn't reliably at content[0].
  const blocks: Array<{ type?: string; text?: string }> = Array.isArray(json?.content) ? json.content : [];
  const text = blocks.find((block) => block.type === "text")?.text;
  if (typeof text !== "string" || text.length === 0) {
    throw new Error("Respuesta vacía de Anthropic.");
  }
  return text;
}

async function callOpenAI(apiKey: string, model: string, prompt: string): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 1500,
    }),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(`OpenAI API error: ${json?.error?.message ?? JSON.stringify(json)}`);
  }
  const text = json?.choices?.[0]?.message?.content;
  if (typeof text !== "string" || text.length === 0) {
    throw new Error("Respuesta vacía de OpenAI.");
  }
  return text;
}

function extractJson(text: string): unknown {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start !== -1 && end !== -1 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1));
    }
    throw new Error("No se pudo interpretar la respuesta de la IA como JSON.");
  }
}

function validateCampaign(value: unknown): GeneratedCampaign {
  if (typeof value !== "object" || value === null) {
    throw new Error("La IA devolvió una respuesta con formato inesperado.");
  }
  const v = value as Record<string, unknown>;
  const required = ["objetivo", "audiencia", "concepto", "oferta", "cta"];
  for (const field of required) {
    if (typeof v[field] !== "string" || (v[field] as string).length === 0) {
      throw new Error(`La IA no incluyó el campo "${field}" en su respuesta.`);
    }
  }
  if (!Array.isArray(v.contenido) || v.contenido.length === 0) {
    throw new Error('La IA no incluyó el campo "contenido" en su respuesta.');
  }
  const contenido = v.contenido.map((item) => {
    if (typeof item !== "object" || item === null) {
      throw new Error('Un elemento de "contenido" tiene formato inesperado.');
    }
    const c = item as Record<string, unknown>;
    return {
      hook: typeof c.hook === "string" ? c.hook : "",
      formato: typeof c.formato === "string" ? c.formato : "Post",
    };
  });

  return {
    objetivo: v.objetivo as string,
    audiencia: v.audiencia as string,
    concepto: v.concepto as string,
    contenido,
    oferta: v.oferta as string,
    cta: v.cta as string,
  };
}

async function callProvider(provider: AiProvider, apiKey: string, model: string, prompt: string): Promise<string> {
  return provider === "anthropic"
    ? callAnthropic(apiKey, model, prompt)
    : callOpenAI(apiKey, model, prompt);
}

export async function generateCampaign(input: {
  provider: AiProvider;
  apiKey: string;
  model: string | null;
  business: CampaignBusinessInput;
  insightSummary: string;
  briefKind?: "insight" | "goal";
}): Promise<{ content: GeneratedCampaign; resolvedModel: string }> {
  const resolvedModel = resolveModel(input.provider, input.model);
  const prompt = buildPrompt(input.business, input.insightSummary, input.briefKind ?? "insight");
  const rawText = await callProvider(input.provider, input.apiKey, resolvedModel, prompt);
  const content = validateCampaign(extractJson(rawText));
  return { content, resolvedModel };
}

export type GeneratedStoryboard = {
  duracionTotal: string;
  escenas: {
    numero: number;
    duracionSegundos: number;
    visual: string;
    textoPantalla: string;
    vozEnOff: string;
  }[];
};

function buildStoryboardPrompt(input: {
  business: CampaignBusinessInput;
  concepto: string;
  oferta: string;
  cta: string;
  hook: string;
  formato: string;
}): string {
  return `Eres un guionista experto en contenido de video corto para redes sociales (Reels, TikTok, Stories). Crea un storyboard/guion detallado en español para la siguiente pieza de contenido, parte de una campaña de marketing.

Negocio: ${input.business.name}
Industria: ${input.business.industry}
Concepto de campaña: ${input.concepto}
Oferta: ${input.oferta}
CTA de campaña: ${input.cta}

Pieza de contenido a guionizar:
Formato: ${input.formato}
Hook/gancho inicial: "${input.hook}"

Responde ÚNICAMENTE con un objeto JSON válido (sin texto adicional, sin markdown, sin comentarios) con esta forma exacta:
{
  "duracionTotal": "ej. 30-45 segundos",
  "escenas": [
    {
      "numero": 1,
      "duracionSegundos": 5,
      "visual": "descripción de lo que se ve en cámara/pantalla",
      "textoPantalla": "texto que aparece en pantalla, o cadena vacía si no aplica",
      "vozEnOff": "guion hablado o narración de esta escena, o cadena vacía si no aplica"
    }
  ]
}
Incluye entre 4 y 7 escenas que cubran, en orden: el gancho inicial, el desarrollo/contexto, la oferta, y el CTA final.`;
}

function validateStoryboard(value: unknown): GeneratedStoryboard {
  if (typeof value !== "object" || value === null) {
    throw new Error("La IA devolvió una respuesta con formato inesperado.");
  }
  const v = value as Record<string, unknown>;
  if (typeof v.duracionTotal !== "string" || v.duracionTotal.length === 0) {
    throw new Error('La IA no incluyó el campo "duracionTotal" en su respuesta.');
  }
  if (!Array.isArray(v.escenas) || v.escenas.length === 0) {
    throw new Error('La IA no incluyó el campo "escenas" en su respuesta.');
  }
  const escenas = v.escenas.map((item, index) => {
    if (typeof item !== "object" || item === null) {
      throw new Error('Un elemento de "escenas" tiene formato inesperado.');
    }
    const e = item as Record<string, unknown>;
    return {
      numero: typeof e.numero === "number" ? e.numero : index + 1,
      duracionSegundos: typeof e.duracionSegundos === "number" ? e.duracionSegundos : 5,
      visual: typeof e.visual === "string" ? e.visual : "",
      textoPantalla: typeof e.textoPantalla === "string" ? e.textoPantalla : "",
      vozEnOff: typeof e.vozEnOff === "string" ? e.vozEnOff : "",
    };
  });

  return { duracionTotal: v.duracionTotal, escenas };
}

export async function generateStoryboard(input: {
  provider: AiProvider;
  apiKey: string;
  model: string | null;
  business: CampaignBusinessInput;
  concepto: string;
  oferta: string;
  cta: string;
  hook: string;
  formato: string;
}): Promise<{ content: GeneratedStoryboard; resolvedModel: string }> {
  const resolvedModel = resolveModel(input.provider, input.model);
  const prompt = buildStoryboardPrompt(input);
  const rawText = await callProvider(input.provider, input.apiKey, resolvedModel, prompt);
  const content = validateStoryboard(extractJson(rawText));
  return { content, resolvedModel };
}

export type VideoAnalysis = {
  startSeconds: number;
  endSeconds: number;
  reason: string;
  hook: string;
  cta: string;
};

function buildVideoAnalysisPrompt(input: {
  business: CampaignBusinessInput;
  transcriptSegments: { start: number; end: number; text: string }[];
  totalDurationSeconds: number;
}): string {
  const transcriptLines = input.transcriptSegments
    .map((seg) => `[${seg.start.toFixed(1)}s - ${seg.end.toFixed(1)}s] ${seg.text}`)
    .join("\n");

  return `Eres un editor de video experto en contenido corto para redes sociales (Reels, TikTok). Te doy la transcripción completa de un video grabado por un negocio, con marcas de tiempo en segundos.

Negocio: ${input.business.name}
Industria: ${input.business.industry}

Duración total del video: ${input.totalDurationSeconds.toFixed(1)} segundos

Transcripción con tiempos:
${transcriptLines || "(sin diálogo detectado)"}

Elige el mejor fragmento continuo de este video para convertirlo en un clip corto vertical, y sugiere un hook y un CTA en español para acompañarlo.

Responde ÚNICAMENTE con un objeto JSON válido (sin texto adicional, sin markdown) con esta forma exacta:
{
  "startSeconds": 0,
  "endSeconds": 0,
  "reason": "por qué elegiste este fragmento",
  "hook": "texto corto y llamativo para mostrar en pantalla al inicio del clip",
  "cta": "llamado a la acción para cerrar el clip"
}
El fragmento debe durar entre 15 y 45 segundos, y startSeconds/endSeconds deben estar dentro de [0, ${input.totalDurationSeconds.toFixed(1)}].`;
}

function validateVideoAnalysis(value: unknown, totalDurationSeconds: number): VideoAnalysis {
  if (typeof value !== "object" || value === null) {
    throw new Error("La IA devolvió una respuesta con formato inesperado.");
  }
  const v = value as Record<string, unknown>;
  const required = ["reason", "hook", "cta"];
  for (const field of required) {
    if (typeof v[field] !== "string" || (v[field] as string).length === 0) {
      throw new Error(`La IA no incluyó el campo "${field}" en su respuesta.`);
    }
  }
  if (typeof v.startSeconds !== "number" || typeof v.endSeconds !== "number") {
    throw new Error("La IA no incluyó los tiempos de inicio/fin del fragmento.");
  }

  // Defensive clamping: these numbers drive ffmpeg trimming directly, so a
  // malformed or out-of-range response shouldn't be able to break rendering.
  let start = Math.max(0, Math.min(v.startSeconds, totalDurationSeconds));
  let end = Math.max(0, Math.min(v.endSeconds, totalDurationSeconds));
  if (end <= start) {
    start = 0;
    end = Math.min(30, totalDurationSeconds);
  }

  return {
    startSeconds: start,
    endSeconds: end,
    reason: v.reason as string,
    hook: v.hook as string,
    cta: v.cta as string,
  };
}

export async function analyzeVideoTranscript(input: {
  provider: AiProvider;
  apiKey: string;
  model: string | null;
  business: CampaignBusinessInput;
  transcriptSegments: { start: number; end: number; text: string }[];
  totalDurationSeconds: number;
}): Promise<{ content: VideoAnalysis; resolvedModel: string }> {
  const resolvedModel = resolveModel(input.provider, input.model);
  const prompt = buildVideoAnalysisPrompt(input);
  const rawText = await callProvider(input.provider, input.apiKey, resolvedModel, prompt);
  const content = validateVideoAnalysis(extractJson(rawText), input.totalDurationSeconds);
  return { content, resolvedModel };
}
