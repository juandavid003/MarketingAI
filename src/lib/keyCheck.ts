// Checks an API key (and optionally a model id) right when the owner saves
// it, with a free, read-only request — so a typo shows up in Settings, not
// as a failed video job later. "unknown" = the provider could not be reached
// (network, 5xx): the key is saved anyway, with a warning.

export type KeyCheck = { status: "ok" | "invalid" | "unknown"; message?: string };

const TIMEOUT_MS = 10_000;

async function get(url: string, headers: Record<string, string>): Promise<Response | null> {
  try {
    return await fetch(url, { headers, signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store" });
  } catch {
    return null;
  }
}

function interpret(res: Response | null, what: string, model?: string | null): KeyCheck {
  if (!res) return { status: "unknown", message: `No pudimos contactar a ${what} para verificar la key.` };
  if (res.ok) return { status: "ok" };
  if (res.status === 401 || res.status === 403) {
    return { status: "invalid", message: `${what} rechazó la API key. Revisa que la copiaste completa y que está activa.` };
  }
  if (res.status === 404 && model) {
    return { status: "invalid", message: `${what} no reconoce el modelo "${model}". Déjalo vacío para usar el predeterminado.` };
  }
  if (res.status === 400) return { status: "invalid", message: `${what} rechazó la API key.` };
  return { status: "unknown", message: `${what} respondió con un error (${res.status}); guardamos la key sin verificar.` };
}

export async function checkAnthropicKey(apiKey: string, model?: string | null): Promise<KeyCheck> {
  const headers = { "x-api-key": apiKey, "anthropic-version": "2023-06-01" };
  const base = "https://api.anthropic.com/v1/models";
  const res = await get(model ? `${base}/${encodeURIComponent(model)}` : `${base}?limit=1`, headers);
  return interpret(res, "Anthropic", model);
}

export async function checkOpenAiKey(apiKey: string, model?: string | null): Promise<KeyCheck> {
  const headers = { Authorization: `Bearer ${apiKey}` };
  const base = "https://api.openai.com/v1/models";
  const res = await get(model ? `${base}/${encodeURIComponent(model)}` : base, headers);
  return interpret(res, "OpenAI", model);
}

export async function checkGeminiKey(apiKey: string): Promise<KeyCheck> {
  const res = await get("https://generativelanguage.googleapis.com/v1beta/models?pageSize=1", { "x-goog-api-key": apiKey });
  return interpret(res, "Google (Gemini)");
}
