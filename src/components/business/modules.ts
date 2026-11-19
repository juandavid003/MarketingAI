import {
  LayoutDashboard,
  Lightbulb,
  PenLine,
  Share2,
  CalendarDays,
  Clapperboard,
  Link2,
  UserRoundCheck,
  BarChart3,
  Building2,
  Plug,
  Bot,
  Send,
  UsersRound,
  type LucideIcon,
} from "lucide-react";

// The app is organized in modules, always inside the business selected in
// the sidebar. Each module owns a route under /business/[id]/<path>; `owns`
// lists the other first segments that belong to it (detail pages).

export type ModuleDef = {
  key: string;
  label: string;
  path: string; // "" = the business overview
  icon: LucideIcon;
  description: string;
  owns?: string[];
  ownerOnly?: boolean; // hidden for managers (lib/access.ts)
};

export const OVERVIEW: ModuleDef = {
  key: "overview",
  label: "Resumen",
  path: "",
  icon: LayoutDashboard,
  description: "Estado del negocio y próximos pasos.",
};

export const MODULE_GROUPS: { label: string; modules: ModuleDef[] }[] = [
  {
    label: "Crear",
    modules: [
      {
        key: "ideas",
        label: "Generador de ideas",
        path: "ideas",
        icon: Lightbulb,
        description: "Oportunidades de tus datos, ideas basadas en la competencia y campañas desde un objetivo.",
        owns: ["competitors", "campaigns"],
      },
      {
        key: "copywriter",
        label: "Copywriter",
        path: "copywriter",
        icon: PenLine,
        description: "Guiones con hook, escenas, descripción y CTAs; grabas por escenas y armamos el video.",
        owns: ["pieces"],
      },
      {
        key: "distribution",
        label: "Distribuidor de estrategia",
        path: "distribution",
        icon: Share2,
        description: "Un video, varios creativos: hooks y CTAs alternativos y un plan para probarlos.",
      },
      {
        key: "calendar",
        label: "Manager de contenido",
        path: "calendar",
        icon: CalendarDays,
        description: "Calendario que combina reels, carruseles, historias y posts de todas tus campañas.",
      },
      {
        key: "publishing",
        label: "Publicaciones",
        path: "publishing",
        icon: Send,
        description: "Publica o programa en Facebook e Instagram; recordatorio y paquete para TikTok y YouTube.",
      },
      {
        key: "videos",
        label: "Videos",
        path: "videos",
        icon: Clapperboard,
        description: "Biblioteca de videos armados y editados, listos para descargar o publicar.",
      },
    ],
  },
  {
    label: "Medir",
    modules: [
      {
        key: "links",
        label: "Enlaces y códigos",
        path: "links",
        icon: Link2,
        description: "Enlaces rastreables con QR y códigos promocionales para saber qué trae clientes.",
      },
      {
        key: "leads",
        label: "Leads",
        path: "leads",
        icon: UserRoundCheck,
        description: "Clientes potenciales con su origen, estado y valor.",
      },
      {
        key: "results",
        label: "Resultados",
        path: "results",
        icon: BarChart3,
        description: "Resultados de negocio separados de las métricas de las redes.",
      },
    ],
  },
  {
    label: "Negocio",
    modules: [
      { key: "profile", label: "Perfil", path: "profile", icon: Building2, description: "Lo que la IA sabe de tu negocio." },
      { key: "connections", label: "Conexiones", path: "connections", icon: Plug, description: "Facebook e Instagram.", ownerOnly: true },
      { key: "settings", label: "Inteligencia artificial", path: "settings", icon: Bot, description: "Tu proveedor y API keys.", ownerOnly: true },
      { key: "team", label: "Equipo", path: "team", icon: UsersRound, description: "Invita a tu encargado de redes.", ownerOnly: true },
    ],
  },
];

const ALL_MODULES = [OVERVIEW, ...MODULE_GROUPS.flatMap((g) => g.modules)];

// Which module a pathname belongs to. /pieces/<id>/creatives is the
// distributor's; the rest of /pieces is the copywriter's.
export function activeModuleKey(pathname: string): string | null {
  const m = pathname.match(/^\/business\/[^/]+(?:\/(.*))?$/);
  if (!m) return null;
  const rest = (m[1] ?? "").split("/").filter(Boolean);
  if (rest.length === 0) return "overview";
  if (rest[0] === "pieces" && rest[2] === "creatives") return "distribution";
  const found = ALL_MODULES.find((mod) => mod.path === rest[0] || mod.owns?.includes(rest[0]));
  return found?.key ?? null;
}

export function moduleHref(businessId: string, key: string | null): string {
  const mod = ALL_MODULES.find((m) => m.key === key) ?? OVERVIEW;
  return mod.path ? `/business/${businessId}/${mod.path}` : `/business/${businessId}`;
}
