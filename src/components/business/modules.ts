import {
  LayoutDashboard,
  Lightbulb,
  Clapperboard,
  CalendarDays,
  BarChart3,
  Sparkles,
  Building2,
  type LucideIcon,
} from "lucide-react";

// The app is organized in a few modules, always inside the business selected
// in the sidebar. A module groups related pages as tabs, so the sidebar stays
// short and each job has one home:
//
//   Ideas       → ideas, competencia            (what to make)
//   Contenido   → guiones, creativos, videos    (make it)
//   Calendario  → calendario, publicaciones     (when and where it goes out)
//   Resultados  → resultados, leads, enlaces    (what it brought)
//   Asistente                                   (ask about all of it)
//   Negocio     → perfil, IA, conexiones, equipo
//
// Each tab owns a route under /business/[id]/<path>; `owns` lists the other
// first segments that belong to it (detail pages). URLs never changed when
// modules were regrouped, so old links keep working.

export type TabDef = {
  key: string;
  label: string;
  path: string; // "" = the business overview
  owns?: string[];
  ownerOnly?: boolean; // hidden for managers (lib/access.ts)
};

export type ModuleDef = {
  key: string;
  label: string;
  icon: LucideIcon;
  description: string;
  tabs: TabDef[];
};

export const OVERVIEW: ModuleDef = {
  key: "overview",
  label: "Resumen",
  icon: LayoutDashboard,
  description: "Estado del negocio y próximos pasos.",
  tabs: [{ key: "overview", label: "Resumen", path: "" }],
};

export const MODULE_GROUPS: { label: string; modules: ModuleDef[] }[] = [
  {
    label: "Crear",
    modules: [
      {
        key: "ideas",
        label: "Ideas",
        icon: Lightbulb,
        description: "Campañas desde un objetivo, fechas que vienen, oportunidades en tus datos y lo que le funciona a tu competencia.",
        tabs: [
          { key: "ideas", label: "Ideas y campañas", path: "ideas", owns: ["campaigns"] },
          { key: "competitors", label: "Competencia", path: "competitors" },
        ],
      },
      {
        key: "content",
        label: "Contenido",
        icon: Clapperboard,
        description: "Guiones por escenas, grabados o generados con IA, armados en video y multiplicados en creativos.",
        tabs: [
          { key: "copywriter", label: "Guiones", path: "copywriter", owns: ["pieces"] },
          { key: "distribution", label: "Creativos", path: "distribution" },
          { key: "videos", label: "Videos", path: "videos" },
        ],
      },
      {
        key: "calendar",
        label: "Calendario",
        icon: CalendarDays,
        description: "Qué sale cada día en cada red, y la cola de publicaciones a Facebook e Instagram.",
        tabs: [
          { key: "calendar", label: "Calendario", path: "calendar" },
          { key: "publishing", label: "Publicaciones", path: "publishing" },
        ],
      },
    ],
  },
  {
    label: "Medir",
    modules: [
      {
        key: "results",
        label: "Resultados",
        icon: BarChart3,
        description: "Clientes y ventas separados de las métricas de las redes, con los leads y enlaces que los trajeron.",
        tabs: [
          { key: "results", label: "Resultados", path: "results" },
          { key: "leads", label: "Leads", path: "leads" },
          { key: "links", label: "Enlaces y códigos", path: "links" },
        ],
      },
      {
        key: "assistant",
        label: "Asistente",
        icon: Sparkles,
        description: "Pregunta qué funciona y qué hacer; responde con tus datos y cita cada cifra.",
        tabs: [{ key: "assistant", label: "Asistente", path: "assistant" }],
      },
    ],
  },
  {
    label: "Negocio",
    modules: [
      {
        key: "business",
        label: "Negocio",
        icon: Building2,
        description: "Perfil, IA, conexiones y equipo.",
        tabs: [
          { key: "profile", label: "Perfil", path: "profile" },
          { key: "settings", label: "Inteligencia artificial", path: "settings", ownerOnly: true },
          { key: "connections", label: "Conexiones", path: "connections", ownerOnly: true },
          { key: "team", label: "Equipo", path: "team", ownerOnly: true },
        ],
      },
    ],
  },
];

const ALL_MODULES = [OVERVIEW, ...MODULE_GROUPS.flatMap((g) => g.modules)];

export function visibleTabs(mod: ModuleDef, role: "owner" | "manager" | undefined): TabDef[] {
  return mod.tabs.filter((t) => !t.ownerOnly || role === "owner");
}

// Which module and tab a pathname belongs to. /pieces/<id>/creatives is the
// Creativos tab; the rest of /pieces is Guiones.
export function activeLocation(pathname: string): { module: ModuleDef; tab: TabDef } | null {
  const m = pathname.match(/^\/business\/[^/]+(?:\/(.*))?$/);
  if (!m) return null;
  const rest = (m[1] ?? "").split("/").filter(Boolean);
  const segment = rest.length === 0 ? "" : rest[0] === "pieces" && rest[2] === "creatives" ? "distribution" : rest[0];
  for (const mod of ALL_MODULES) {
    const tab = mod.tabs.find((t) => t.path === segment || t.owns?.includes(segment));
    if (tab) return { module: mod, tab };
  }
  return null;
}

export function tabHref(businessId: string, tab: TabDef): string {
  return tab.path ? `/business/${businessId}/${tab.path}` : `/business/${businessId}`;
}

// A module's landing page is its first tab the role can see.
export function moduleHref(businessId: string, mod: ModuleDef, role?: "owner" | "manager"): string {
  return tabHref(businessId, visibleTabs(mod, role)[0] ?? mod.tabs[0]);
}

// Same tab in another business (used by the business switcher); falls back
// to the module's first tab, then to the overview.
export function sameTabHref(businessId: string, tab: TabDef | null, role?: "owner" | "manager"): string {
  if (!tab || (tab.ownerOnly && role !== "owner")) return `/business/${businessId}`;
  return tabHref(businessId, tab);
}
