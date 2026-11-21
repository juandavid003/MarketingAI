import { VideoGenError, type KeyCheck } from "./types";

// Small fetch helpers shared by the providers.

export async function readError(res: Response, who: string): Promise<VideoGenError> {
  let detail = "";
  try {
    const json = (await res.json()) as { error?: { message?: string } | string; detail?: unknown; message?: string };
    const e = json.error;
    detail =
      (typeof e === "string" ? e : e?.message) ??
      json.message ??
      (typeof json.detail === "string" ? json.detail : json.detail ? JSON.stringify(json.detail) : "");
  } catch {
    // non-JSON body
  }
  if (res.status === 401 || res.status === 403) {
    return new VideoGenError(`${who} rechazó la API key. Revisa que esté activa y tenga saldo.`);
  }
  if (res.status === 429) return new VideoGenError(`${who} está limitando las solicitudes (cuota o saldo). Intenta más tarde.`);
  return new VideoGenError(`${who} respondió ${res.status}${detail ? `: ${String(detail).slice(0, 240)}` : ""}`);
}

export async function download(url: string, headers: Record<string, string>, signal?: AbortSignal): Promise<Buffer> {
  const res = await fetch(url, { headers, signal, cache: "no-store" });
  if (!res.ok) throw new VideoGenError(`No se pudo descargar el video generado (${res.status}).`);
  return Buffer.from(await res.arrayBuffer());
}

export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(t);
      reject(new VideoGenError("La generación tardó demasiado y se canceló."));
    });
  });
}

export async function checkWith(url: string, headers: Record<string, string>, who: string): Promise<KeyCheck> {
  let res: Response;
  try {
    res = await fetch(url, { headers, signal: AbortSignal.timeout(10_000), cache: "no-store" });
  } catch {
    return { status: "unknown", message: `No pudimos contactar a ${who} para verificar la key; la guardamos igual.` };
  }
  if (res.ok) return { status: "ok" };
  if (res.status === 401 || res.status === 403) {
    return { status: "invalid", message: `${who} rechazó la API key. Revisa que la copiaste completa.` };
  }
  return { status: "unknown", message: `${who} respondió ${res.status}; guardamos la key sin verificar.` };
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(n)));
}
