import { callProvider, extractJson, resolveModel, type GeneratedCampaign } from "@/lib/ai";
import { formatBusinessContext, languageInstruction, type AiBusinessContext } from "@/lib/businessContext";
import type { AiCredentials } from "@/lib/contentAi";

// Manager de contenido: the business's calendar, mixing formats (reels,
// carousels, stories, posts...) across platforms. Items come from the owner,
// from the AI planner below, or from a piece's distribution plan.

export const FORMATS = [
  { value: "reel", label: "Reel / video corto", color: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200" },
  { value: "carousel", label: "Carrusel", color: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200" },
  { value: "story", label: "Historia", color: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200" },
  { value: "post", label: "Post (imagen)", color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200" },
  { value: "video", label: "Video largo", color: "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200" },
  { value: "live", label: "En vivo", color: "bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-900/40 dark:text-fuchsia-200" },
] as const;
export type ContentFormat = (typeof FORMATS)[number]["value"];

export const PLAN_STATUSES = [
  { value: "idea", label: "Idea" },
  { value: "planned", label: "Planificado" },
  { value: "producing", label: "En producción" },
  { value: "ready", label: "Listo para publicar" },
  { value: "published", label: "Publicado" },
] as const;

export const PLAN_PLATFORMS = [
  { value: "instagram", label: "Instagram" },
  { value: "facebook", label: "Facebook" },
  { value: "tiktok", label: "TikTok" },
  { value: "youtube", label: "YouTube" },
  { value: "other", label: "Otra" },
] as const;

export const formatInfo = (v: string) => FORMATS.find((f) => f.value === v) ?? FORMATS[3];
export const statusLabel = (v: string) => PLAN_STATUSES.find((s) => s.value === v)?.label ?? v;
export const platformLabel = (v: string) => PLAN_PLATFORMS.find((p) => p.value === v)?.label ?? v;

export function isFormat(v: string): v is ContentFormat {
  return FORMATS.some((f) => f.value === v);
}

// ---------------------------------------------------------------------------
// Dates: a plan item's day is stored at 12:00 UTC so it never shifts a day
// when shown in another time zone.
// ---------------------------------------------------------------------------

export function dayFromIso(iso: string): Date | null {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12));
  // Date.UTC rolls "2026-13-01" or "02-31" over into another day: reject.
  return Number.isNaN(d.getTime()) || isoDay(d) !== iso ? null : d;
}

export function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * 86_400_000);
}

// Weeks (Monday first) covering a month, as ISO days: the calendar grid.
export function monthGrid(year: number, month0: number): string[][] {
  const first = new Date(Date.UTC(year, month0, 1, 12));
  const mondayOffset = (first.getUTCDay() + 6) % 7;
  let cursor = addDays(first, -mondayOffset);
  const weeks: string[][] = [];
  do {
    const week: string[] = [];
    for (let i = 0; i < 7; i++) {
      week.push(isoDay(cursor));
      cursor = addDays(cursor, 1);
    }
    weeks.push(week);
  } while (cursor.getUTCMonth() === month0);
  return weeks;
}

export function parseMonth(raw: string | undefined, today = new Date()): { year: number; month0: number } {
  const m = raw?.match(/^(\d{4})-(\d{2})$/);
  if (m && Number(m[2]) >= 1 && Number(m[2]) <= 12) return { year: Number(m[1]), month0: Number(m[2]) - 1 };
  return { year: today.getUTCFullYear(), month0: today.getUTCMonth() };
}

export function monthKey(year: number, month0: number): string {
  const d = new Date(Date.UTC(year, month0, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function parseDetails(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// AI planner
// ---------------------------------------------------------------------------

export type PlannerInput = {
  startIso: string;
  weeks: number;
  postsPerWeek: number;
  platforms: string[]; // values from PLAN_PLATFORMS
  focus: string; // optional owner note ("lanzamiento de X", "temporada alta"...)
  campaigns: { id: string; title: string; content: GeneratedCampaign | null }[];
  pieces: { id: string; hook: string; format: string; purpose: string }[];
  alreadyPlanned: { date: string; format: string; title: string }[];
};

export type PlannedItem = {
  date: string;
  time: string | null;
  platform: string;
  format: ContentFormat;
  title: string;
  brief: string;
  copy: string;
  details: string[];
  pillar: string;
  purpose: string;
  campaignId: string | null;
  contentPieceId: string | null;
};

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function buildPlannerPrompt(business: AiBusinessContext, input: PlannerInput): string {
  const campaigns = input.campaigns
    .map(
      (c, i) =>
        `[K${i + 1}] ${c.title}${c.content ? ` — objetivo: ${c.content.objetivo}; concepto: ${c.content.concepto}; oferta: ${c.content.oferta}; CTA: ${c.content.cta}` : ""}`
    )
    .join("\n");
  const pieces = input.pieces
    .map((p, i) => `[G${i + 1}] "${p.hook}" (${p.format}, propósito ${p.purpose})`)
    .join("\n");
  const planned = input.alreadyPlanned.map((p) => `${p.date} · ${p.format} · ${p.title}`).join("\n");
  const days = input.weeks * 7;

  return `Eres el manager de contenido de un negocio. Arma un calendario de publicaciones que combine formatos (reels, carruseles, historias, posts con imagen y, si tiene sentido, video largo o en vivo) para las redes indicadas.

${formatBusinessContext(business)}

Periodo: ${days} días a partir del ${input.startIso} (día 1 = ${input.startIso}).
Ritmo: unas ${input.postsPerWeek} publicaciones por semana en total (las historias cuentan aparte y pueden ser más frecuentes).
Redes: ${input.platforms.join(", ")}.
${input.focus ? `Enfoque pedido por el dueño: ${input.focus}\n` : ""}
Campañas activas del negocio:
${campaigns || "(ninguna)"}

Guiones de video ya escritos (úsalos como reels cuando encajen, sin repetir el mismo guion más de una vez por red):
${pieces || "(ninguno)"}

Ya hay en el calendario (no dupliques):
${planned || "(nada)"}

Reglas:
- Mezcla formatos con intención: reels para alcance, carruseles para educar o comparar, historias para conversación diaria (encuestas, preguntas, detrás de cámaras), posts para anuncios u ofertas.
- Define 3 o 4 pilares de contenido y reparte las publicaciones entre ellos.
- Cada publicación: "titulo" corto, "idea" (de qué trata y cómo hacerlo), "copy" listo para publicar, y "detalle": para carrusel el texto de cada diapositiva, para historias cada pantalla, para reel los momentos clave; lista vacía si no aplica.
- Relaciona con una campaña ("campana": "K1") o un guion ("guion": "G2") solo si de verdad corresponde; si no, null.
- "plataforma" debe ser una de: ${input.platforms.join(", ")}. "formato" uno de: ${FORMATS.map((f) => f.value).join(", ")}.
- "hora" es opcional ("HH:MM"); preséntala como punto de partida, no como horario comprobado.
${languageInstruction(business)}

Responde ÚNICAMENTE con JSON válido (sin markdown):
{ "pilares": ["..."], "publicaciones": [ { "dia": 1, "hora": "18:00", "plataforma": "instagram", "formato": "carousel", "titulo": "...", "idea": "...", "copy": "...", "detalle": ["..."], "pilar": "...", "proposito": "...", "campana": null, "guion": "G1" } ] }`;
}

export function validatePlannerOutput(value: unknown, input: PlannerInput): PlannedItem[] {
  const v = (typeof value === "object" && value !== null ? value : {}) as Record<string, unknown>;
  const raw = Array.isArray(v.publicaciones) ? v.publicaciones : [];
  const start = dayFromIso(input.startIso);
  if (!start) throw new Error("Fecha de inicio inválida.");
  const days = input.weeks * 7;
  const ref = (code: unknown, prefix: string, list: { id: string }[]) => {
    const n = Number(str(code).toUpperCase().replace(prefix, ""));
    return Number.isInteger(n) && n >= 1 && n <= list.length ? list[n - 1].id : null;
  };

  const items = raw
    .map((item): PlannedItem | null => {
      const p = (typeof item === "object" && item !== null ? item : {}) as Record<string, unknown>;
      const dia = Math.round(Number(p.dia));
      const format = str(p.formato).toLowerCase();
      const platform = str(p.plataforma).toLowerCase();
      const title = str(p.titulo);
      if (!Number.isFinite(dia) || dia < 1 || dia > days || !isFormat(format) || !title) return null;
      const time = str(p.hora).match(/^([01]?\d|2[0-3]):[0-5]\d$/) ? str(p.hora).padStart(5, "0") : null;
      return {
        date: isoDay(addDays(start, dia - 1)),
        time,
        platform: input.platforms.includes(platform) ? platform : input.platforms[0],
        format,
        title: title.slice(0, 200),
        brief: str(p.idea),
        copy: str(p.copy),
        details: Array.isArray(p.detalle) ? p.detalle.map(str).filter(Boolean).slice(0, 12) : [],
        pillar: str(p.pilar),
        purpose: str(p.proposito),
        campaignId: ref(p.campana, "K", input.campaigns),
        contentPieceId: ref(p.guion, "G", input.pieces),
      };
    })
    .filter((x): x is PlannedItem => x !== null)
    .slice(0, 120);

  if (items.length === 0) throw new Error("La IA no devolvió publicaciones válidas. Intenta de nuevo.");
  return items.sort((a, b) => a.date.localeCompare(b.date));
}

export async function generateContentCalendar(
  ai: AiCredentials,
  business: AiBusinessContext,
  input: PlannerInput
): Promise<PlannedItem[]> {
  const model = resolveModel(ai.provider, ai.model);
  const raw = await callProvider(ai.provider, ai.apiKey, model, buildPlannerPrompt(business, input), 8000);
  return validatePlannerOutput(extractJson(raw), input);
}

// "N days ago" for period filters (kept out of components: render purity).
export function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 86_400_000);
}
