import { projectWorkspaceLegacyPath } from "@/lib/projects/workspace";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  BadgeCheck,
  BarChart3,
  Banknote,
  Boxes,
  Briefcase,
  Calendar,
  ClipboardCheck,
  ClipboardList,
  Compass,
  Crown,
  Database,
  DollarSign,
  Drill,
  Droplets,
  FileSignature,
  FileText,
  FolderKanban,
  Handshake,
  KanbanSquare,
  KeyRound,
  LayoutDashboard,
  LayoutGrid,
  LineChart,
  Magnet,
  Map as MapIcon,
  Package,
  PackageSearch,
  Plane,
  Satellite,
  Scissors,
  ShieldAlert,
  ShieldCheck,
  Ship,
  Sparkles,
  Target,
  TestTube2,
  UserCircle,
  Users,
  Wallet,
} from "lucide-react";
import type { ModuleKey } from "@/hooks/useMyModules";
import type { MODULE_ROLES } from "@/hooks/useProjectRole";

type ProjectCapability = keyof typeof MODULE_ROLES;

/**
 * SISTEMA MAESTRO — navegación unificada.
 *
 * Tres espacios de trabajo (catastro / commodities / capital) + Administración.
 * Cada entrada del rail es una PANTALLA CANÓNICA; sus sub-vistas viven como
 * pestañas dentro de la propia pantalla (ver `WorkspaceTabs`), no como ítems
 * sueltos del menú. Esta es la única fuente de verdad de la navegación interna.
 */

export type WorkspaceTab = {
  label: string;
  to: string;
  /** Coincidencia exacta de pathname (por defecto: prefijo). */
  exact?: boolean;
  capability?: ProjectCapability;
  hideForInvestor?: boolean;
};

export type WorkspaceEntry = {
  /** Ruta canónica: destino del ítem del rail y primera pestaña. */
  to: string;
  label: string;
  icon: LucideIcon;
  group: WorkspaceGroup;
  module: ModuleKey | "core";
  tabs?: WorkspaceTab[];
  capability?: ProjectCapability;
  hideForInvestor?: boolean;
  requiresProjects?: boolean;
  exact?: boolean;
  superAdminOnly?: boolean;
  badgeKey?: "catastroAlerts";
};

export type WorkspaceGroup =
  | "GENERAL"
  | "CATASTRO & TERRITORIO"
  | "TERMINAL DE ACTIVOS & GEOCIENCIA"
  | "CAPITAL & NEGOCIOS"
  | "ADMINISTRACIÓN";

export const WORKSPACE_NAV: WorkspaceEntry[] = [
  {
    to: "/dashboard",
    label: "Inicio",
    icon: LayoutDashboard,
    group: "GENERAL",
    module: "core",
    exact: true,
  },

  // ─────────────── CATASTRO & TERRITORIO ───────────────
  {
    to: "/catastro/mapa",
    label: "Catastro",
    icon: MapIcon,
    group: "CATASTRO & TERRITORIO",
    module: "catastro",
    capability: "catastro",
    requiresProjects: true,
    badgeKey: "catastroAlerts",
    tabs: [
      { label: "Catastro maestro", to: "/catastro/mapa" },
      { label: "Conciliación", to: "/dashboard/catastro" },
      { label: "Boletín minero", to: "/dashboard/boletin" },
      { label: "Watchlist", to: "/catastro/app/watchlist" },
      { label: "Oportunidades IA", to: "/dashboard/opportunities" },
      { label: "Capas GIS", to: "/dashboard/marketplace" },
    ],
  },
  {
    to: "/dashboard/projects",
    label: "Activos & proyectos",
    icon: FolderKanban,
    group: "TERMINAL DE ACTIVOS & GEOCIENCIA",
    module: "catastro",
    capability: "projects",
    requiresProjects: true,
    tabs: [
      { label: "Proyectos", to: "/dashboard/projects", exact: true },
      { label: "Terminal 2D/3D", to: "/terminal" },
      { label: "Nuevo proyecto", to: "/dashboard/projects/nuevo" },
    ],
  },
  {
    to: "/dashboard/geophysics",
    label: "Exploración & Reportes",
    icon: Activity,
    group: "TERMINAL DE ACTIVOS & GEOCIENCIA",
    module: "catastro",
    hideForInvestor: true,
    tabs: [
      { label: "Geofísica", to: "/dashboard/geophysics", capability: "geophysics" },
      { label: "Sondajes", to: "/dashboard/drilling", capability: "drilling" },
      { label: "Muestreo", to: "/dashboard/sampling", capability: "sampling" },
      { label: "QA/QC", to: "/dashboard/qaqc", capability: "qaqc" },
      { label: "Satelital", to: "/dashboard/satellite-intel", capability: "targets" },
      { label: "Targets", to: "/dashboard/targets", capability: "targets" },
      { label: "Estimación", to: "/dashboard/estimation", capability: "estimation" },
      { label: "Reportes & 43-101", to: "/dashboard/reports", capability: "reports" },
      { label: "QPs · Firmas", to: "/dashboard/qps", capability: "reports" },
    ],
  },

  // ─────────────── CAPITAL & NEGOCIOS ───────────────
  {
    to: "/dashboard/trades",
    label: "Mesa de operaciones",
    icon: Handshake,
    group: "CAPITAL & NEGOCIOS",
    module: "commodities",
    tabs: [
      { label: "Operaciones", to: "/dashboard/trades" },
      { label: "Tablero", to: "/dashboard/trade-board" },
      { label: "Lotes", to: "/dashboard/commodity-lots", hideForInvestor: true },
      { label: "Sourcing", to: "/dashboard/sourcing" },
      { label: "RFQ compradores", to: "/dashboard/rfqs" },
      { label: "Mis cotizaciones", to: "/dashboard/my-inquiries" },
    ],
  },
  {
    to: "/dashboard/clientes",
    label: "Clientes & Contratos",
    icon: Users,
    group: "CAPITAL & NEGOCIOS",
    module: "commodities",
    tabs: [
      { label: "Clientes", to: "/dashboard/clientes" },
      { label: "Proveedores", to: "/dashboard/proveedores" },
      { label: "Plantillas", to: "/dashboard/documentos" },
      { label: "Firmas", to: "/dashboard/firmas" },
    ],
  },
  {
    to: "/dashboard/cobranza",
    label: "Finanzas & Logística",
    icon: Wallet,
    group: "CAPITAL & NEGOCIOS",
    module: "commodities",
    tabs: [
      { label: "Cobranza", to: "/dashboard/cobranza" },
      { label: "Anticipos", to: "/dashboard/anticipos", hideForInvestor: true },
      { label: "Envíos", to: "/dashboard/envios" },
      { label: "Precios metales", to: "/dashboard/precios" },
    ],
  },

  // ─────────────── CAPITAL & NEGOCIOS ───────────────
  {
    to: "/dashboard/deals",
    label: "Deal Flow",
    icon: Briefcase,
    group: "CAPITAL & NEGOCIOS",
    module: "capital",
    tabs: [
      { label: "Deal flow", to: "/dashboard/deals" },
      { label: "Pipeline", to: "/dashboard/pipeline", hideForInvestor: true },
      { label: "Mi portafolio", to: "/dashboard/investments" },
      { label: "Expediente", to: "/dashboard/expediente", hideForInvestor: true },
      { label: "Vender proyecto", to: "/dashboard/listings", hideForInvestor: true },
      { label: "Ofertas y participaciones", to: "/dashboard/offerings" },
    ],
  },
  {
    to: "/dashboard/colateral-leads",
    label: "Inversión con colateral",
    icon: KanbanSquare,
    group: "CAPITAL & NEGOCIOS",
    module: "capital",
    hideForInvestor: true,
    tabs: [
      { label: "Solicitudes", to: "/dashboard/colateral-leads" },
      { label: "Documentos legales", to: "/dashboard/colateral-documentos" },
      { label: "Water Assets", to: "/dashboard/agua" },
    ],
  },

  // ─────────────── ADMINISTRACIÓN (transversal) ───────────────
  {
    to: "/dashboard/analytics",
    label: "Gestión",
    icon: BarChart3,
    group: "ADMINISTRACIÓN",
    module: "core",
    tabs: [
      { label: "Analítica", to: "/dashboard/analytics" },
      {
        label: "Aprobaciones",
        to: "/dashboard/approvals",
        capability: "approvals",
        hideForInvestor: true,
      },
      { label: "Costos", to: "/dashboard/finance", capability: "finance", hideForInvestor: true },
      { label: "HSE", to: "/dashboard/hse", capability: "hse", hideForInvestor: true },
      { label: "Equipo", to: "/dashboard/team", capability: "team", hideForInvestor: true },
      { label: "Auditoría", to: "/dashboard/audit", capability: "audit", hideForInvestor: true },
    ],
  },
  {
    to: "/dashboard/profile",
    label: "Cuenta",
    icon: UserCircle,
    group: "ADMINISTRACIÓN",
    module: "core",
    tabs: [
      { label: "Mi perfil", to: "/dashboard/profile" },
      { label: "Plan y uso", to: "/dashboard/plan" },
      { label: "API · Llaves", to: "/dashboard/api" },
    ],
  },
  {
    to: "/dashboard/admin",
    label: "Admin",
    icon: Crown,
    group: "ADMINISTRACIÓN",
    module: "core",
    superAdminOnly: true,
  },
];

/** Iconos usados solo para tipado/exports auxiliares (evita imports muertos). */
export const WORKSPACE_ICONS = {
  ClipboardCheck,
  ClipboardList,
  DollarSign,
  Droplets,
  FileSignature,
  FileText,
  KeyRound,
  Package,
  PackageSearch,
  Satellite,
  ShieldAlert,
  Sparkles,
  Drill,
  TestTube2,
  ShieldCheck,
  Target,
  Boxes,
  Compass,
  Calendar,
  Plane,
  Scissors,
  Magnet,
  Database,
  BadgeCheck,
  Banknote,
  LineChart,
  Ship,
  LayoutGrid,
};

/** Devuelve la entrada canónica (y sus pestañas) para un pathname dado. */
export function findWorkspaceEntry(pathname: string): WorkspaceEntry | null {
  pathname = projectWorkspaceLegacyPath(pathname);
  let best: WorkspaceEntry | null = null;
  let bestLen = -1;
  for (const entry of WORKSPACE_NAV) {
    const candidates = [{ to: entry.to, exact: entry.exact }, ...(entry.tabs ?? [])];
    for (const candidate of candidates) {
      const match = candidate.exact
        ? pathname === candidate.to
        : pathname === candidate.to || pathname.startsWith(candidate.to + "/");
      if (match && candidate.to.length > bestLen) {
        best = entry;
        bestLen = candidate.to.length;
      }
    }
  }
  return best;
}
