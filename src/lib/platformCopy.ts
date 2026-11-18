import { callProvider, extractJson, resolveModel } from "@/lib/ai";
import { formatBusinessContext, languageInstruction, type AiBusinessContext } from "@/lib/businessContext";
import type { AiCredentials, GeneratedContentPiece } from "@/lib/contentAi";

// Captions and hashtags written for each platform where the piece will be
// published: same message, each network's style and limits.

export type PlatformCopy = {
  plataforma: string; // instagram | facebook | tiktok | youtube
  titulo: string; // YouTube Shorts title; "" elsewhere
  caption: string;
  hashtags: string[];
  nota: string; // practical tip for that network
};

export const COPY_PLATFORMS: Record<string, { label: string; rules: string }> = {
  instagram: {
    label: "Instagram",
    rules: "caption con gancho en la primera línea (se corta a ~125 caracteres), saltos de línea, CTA claro; 3 a 8 hashtags relevantes",
  },
  facebook: {
    label: "Facebook",
    rules: "tono conversacional, 1 a 3 párrafos cortos, CTA directo; 0 a 3 hashtags",
  },
  tiktok: {
    label: "TikTok",
    rules: "caption muy corto (1-2 frases) que invite a ver hasta el final o comentar; 3 a 5 hashtags, incluye de nicho",
  },
  youtube: {
    label: "YouTube Shorts",
    rules: "\"titulo\" de máximo 70 caracteres con la palabra clave al inicio; descripción en \"caption\" de 1-3 frases; 2 a 4 hashtags",
  },
};

export function copyPlatformsFor(mainPlatforms: string[]): string[] {
  const chosen = mainPlatforms.filter((p) => p in COPY_PLATFORMS);
  return chosen.length > 0 ? chosen : ["instagram", "facebook", "tiktok"];
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

export function validatePlatformCopy(value: unknown, platforms: string[]): PlatformCopy[] {
  const v = (typeof value === "object" && value !== null ? value : {}) as Record<string, unknown>;
  const list = Array.isArray(v.redes) ? v.redes : [];
  const byPlatform = new Map<string, PlatformCopy>();
  for (const item of list) {
    const p = (typeof item === "object" && item !== null ? item : {}) as Record<string, unknown>;
    const plataforma = str(p.plataforma).toLowerCase();
    if (!platforms.includes(plataforma) || byPlatform.has(plataforma)) continue;
    const caption = str(p.caption);
    if (!caption) continue;
    byPlatform.set(plataforma, {
      plataforma,
      titulo: plataforma === "youtube" ? str(p.titulo).slice(0, 100) : "",
      caption,
      hashtags: (Array.isArray(p.hashtags) ? p.hashtags : [])
        .map((h) => str(h).replace(/\s+/g, ""))
        .filter(Boolean)
        .map((h) => (h.startsWith("#") ? h : `#${h}`))
        .slice(0, 12),
      nota: str(p.nota),
    });
  }
  const result = platforms.map((p) => byPlatform.get(p)).filter((x): x is PlatformCopy => !!x);
  if (result.length === 0) throw new Error("La IA no devolvió textos válidos. Intenta de nuevo.");
  return result;
}

export async function generatePlatformCopy(
  ai: AiCredentials,
  business: AiBusinessContext,
  piece: GeneratedContentPiece,
  platforms: string[]
): Promise<PlatformCopy[]> {
  const prompt = `Eres community manager. Escribe el texto de publicación de este video para cada red indicada, adaptado a su estilo.

${formatBusinessContext(business)}

Video: ${piece.titulo}
Hook: "${piece.hook}"
Lo que se dice: ${piece.escenas.map((e) => e.queDecir).filter(Boolean).join(" ")}
Descripción base: ${piece.descripcion}
CTA principal: ${piece.ctas[0] ?? ""}
Hashtags base: ${piece.hashtags.join(" ")}

Redes y reglas:
${platforms.map((p) => `- ${p}: ${COPY_PLATFORMS[p].rules}`).join("\n")}

${languageInstruction(business)}
No prometas resultados ni inventes datos. "nota" es un consejo práctico breve para publicar en esa red.

Responde ÚNICAMENTE con JSON válido: { "redes": [ { "plataforma": "${platforms[0]}", "titulo": "", "caption": "...", "hashtags": ["#..."], "nota": "..." } ] }`;
  const model = resolveModel(ai.provider, ai.model);
  const raw = await callProvider(ai.provider, ai.apiKey, model, prompt, 3000);
  return validatePlatformCopy(extractJson(raw), platforms);
}

export function parsePlatformCopy(raw: string | null): PlatformCopy[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? (v as PlatformCopy[]) : [];
  } catch {
    return [];
  }
}
