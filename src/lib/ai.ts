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

function buildPrompt(business: CampaignBusinessInput, insightSummary: string): string {
  const productNames = business.products.map((p) => p.name).join(", ") || "sus productos/servicios";

  return `Eres un estratega de marketing experto en negocios locales. Genera una propuesta de campaña de marketing en español para el siguiente negocio, basada en la oportunidad detectada.

Negocio: ${business.name}
Industria: ${business.industry}
Qué vende: ${business.description}
Productos/servicios: ${productNames}
Audiencia objetivo: ${business.targetAudience}
Ubicación: ${business.location}
Objetivo de negocio: ${business.objective}

Oportunidad detectada: ${insightSummary}

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
  const text = json?.content?.[0]?.text;
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

export async function generateCampaign(input: {
  provider: AiProvider;
  apiKey: string;
  model: string | null;
  business: CampaignBusinessInput;
  insightSummary: string;
}): Promise<{ content: GeneratedCampaign; resolvedModel: string }> {
  const resolvedModel = resolveModel(input.provider, input.model);
  const prompt = buildPrompt(input.business, input.insightSummary);

  const rawText =
    input.provider === "anthropic"
      ? await callAnthropic(input.apiKey, resolvedModel, prompt)
      : await callOpenAI(input.apiKey, resolvedModel, prompt);

  const content = validateCampaign(extractJson(rawText));
  return { content, resolvedModel };
}
