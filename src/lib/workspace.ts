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
  | "INICIO"
  | "CATASTRO & EXPLORACIÓN"
  | "TRADE & COMMODITIES"
  | "CAPITAL & DEALS"
  | "ADMINISTRACIÓN";

export const WORKSPACE_NAV: WorkspaceEntry[] = [
  {
    to: "/dashboard",
    label: "Inicio",
    icon: LayoutDashboard,
    group: "INICIO",
    module: "core",
    exact: true,
  },

  // ─────────────── CATASTRO & EXPLORACIÓN ───────────────
  {
    to: "/catastro/proyecto",
    label: "Catastro",
    icon: MapIcon,
    group: "CATASTRO & EXPLORACIÓN",
    module: "catastro",
    capability: "catastro",
    requiresProjects: true,
    badgeKey: "catastroAlerts",
    tabs: [
      { label: "Concesiones", to: "/catastro/proyecto" },
      { label: "Boletín minero", to: "/dashboard/boletin" },
      { label: "Cholqui", to: "/dashboard/cholqui" },
      { label: "Mapa nacional", to: "/catastro/mapa" },
      { label: "Watchlist", to: "/catastro/app/watchlist" },
      { label: "Oportunidades IA", to: "/dashboard/opportunities" },
      { label: "Capas GIS", to: "/dashboard/marketplace" },
    ],
  },
  {
    to: "/dashboard/projects",
    label: "Proyectos",
    icon: FolderKanban,
    group: "CATASTRO & EXPLORACIÓN",
    module: "catastro",
    capability: "projects",
    requiresProjects: true,
    tabs: [
      { label: "Proyectos", to: "/dashboard/projects" },
      { label: "Nuevo proyecto", to: "/dashboard/projects/nuevo" },
      { label: "Mission Control", to: "/dashboard/mission" },
      { label: "Mapa táctico", to: "/dashboard/map" },
      { label: "Campañas", to: "/dashboard/campaigns" },
    ],
  },
  {
    to: "/dashboard/geophysics",
    label: "Exploración",
    icon: Activity,
    group: "CATASTRO & EXPLORACIÓN",
    module: "catastro",
    hideForInvestor: true,
    tabs: [
      { label: "Geofísica", to: "/dashboard/geophysics", capability: "geophysics" },
      { label: "Sondajes", to: "/dashboard/drilling", capability: "drilling" },
      { label: "Sección 3D", to: "/dashboard/section", capability: "drilling" },
      { label: "Visor 3D", to: "/dashboard/geology3d", capability: "drilling" },
      { label: "Drones", to: "/dashboard/drones", capability: "geophysics" },
      { label: "Muestreo", to: "/dashboard/sampling", capability: "sampling" },
      { label: "QA/QC", to: "/dashboard/qaqc", capability: "qaqc" },
      { label: "Targets", to: "/dashboard/targets", capability: "targets" },
      { label: "Estimación", to: "/dashboard/estimation", capability: "estimation" },
      { label: "Inventario", to: "/dashboard/inventory", capability: "inventory" },
    ],
  },
  {
    to: "/dashboard/ni43101",
    label: "Reportes & 43-101",
    icon: FileText,
    group: "CATASTRO & EXPLORACIÓN",
    module: "catastro",
    hideForInvestor: true,
    capability: "reports",
    tabs: [
      { label: "Reporting Hub", to: "/dashboard/reports" },
      { label: "Informe 43-101", to: "/dashboard/ni43101" },
      { label: "Vista interactiva", to: "/dashboard/project-report" },
      { label: "Cholqui live", to: "/dashboard/cholqui" },
      { label: "QPs · Firmas", to: "/dashboard/qps" },
      { label: "Validación de datos", to: "/dashboard/validation", capability: "audit" },
    ],
  },
  {
    to: "/dashboard/satellite-intel",
    label: "Inteligencia satelital",
    icon: Satellite,
    group: "CATASTRO & EXPLORACIÓN",
    module: "catastro",
    hideForInvestor: true,
    capability: "targets",
    tabs: [
      { label: "Inteligencia sat.", to: "/dashboard/satellite-intel" },
      { label: "Satelital 3D", to: "/dashboard/sat3d" },
      { label: "Revalidación MAG", to: "/dashboard/mag-revalidations" },
    ],
  },

  // ─────────────── TRADE & COMMODITIES ───────────────
  {
    to: "/dashboard/trades",
    label: "Mesa de operaciones",
    icon: Handshake,
    group: "TRADE & COMMODITIES",
    module: "commodities",
    tabs: [
      { label: "Operaciones", to: "/dashboard/trades" },
      { label: "Tablero", to: "/dashboard/trade-board" },
    ],
  },
  {
    to: "/dashboard/commodity-lots",
    label: "Marketplace",
    icon: Package,
    group: "TRADE & COMMODITIES",
    module: "commodities",
    hideForInvestor: true,
    tabs: [
      { label: "Lotes", to: "/dashboard/commodity-lots" },
      { label: "Vitrina pública", to: "/marketplace" },
    ],
  },
  {
    to: "/dashboard/sourcing",
    label: "Requerimientos",
    icon: PackageSearch,
    group: "TRADE & COMMODITIES",
    module: "commodities",
    tabs: [
      { label: "Sourcing", to: "/dashboard/sourcing" },
      { label: "RFQ compradores", to: "/dashboard/rfqs" },
      { label: "Mis cotizaciones", to: "/dashboard/my-inquiries" },
    ],
  },
  {
    to: "/dashboard/clientes",
    label: "Clientes & Proveedores",
    icon: Users,
    group: "TRADE & COMMODITIES",
    module: "commodities",
    tabs: [
      { label: "Clientes y asociados", to: "/dashboard/clientes" },
      { label: "Bandeja de proveedores", to: "/dashboard/proveedores" },
      { label: "Hub proveedor", to: "/dashboard/proveedor" },
      { label: "Mi panel proveedor", to: "/panel" },
    ],
  },
  {
    to: "/dashboard/documentos",
    label: "Documentos & Firmas",
    icon: FileSignature,
    group: "TRADE & COMMODITIES",
    module: "commodities",
    tabs: [
      { label: "Plantillas", to: "/dashboard/documentos" },
      { label: "Mis firmas", to: "/dashboard/firmas" },
    ],
  },
  {
    to: "/dashboard/cobranza",
    label: "Finanzas & Logística",
    icon: Wallet,
    group: "TRADE & COMMODITIES",
    module: "commodities",
    tabs: [
      { label: "Cobranza", to: "/dashboard/cobranza" },
      { label: "Anticipos", to: "/dashboard/anticipos", hideForInvestor: true },
      { label: "Envíos", to: "/dashboard/envios" },
      { label: "Precios metales", to: "/dashboard/precios" },
    ],
  },

  // ─────────────── CAPITAL & DEALS ───────────────
  // Un solo spine de inversión: descubrir → data room → oferta → portafolio.
  {
    to: "/dashboard/deals",
    label: "Deal Flow",
    icon: Briefcase,
    group: "CAPITAL & DEALS",
    module: "capital",
    tabs: [
      { label: "Deal flow", to: "/dashboard/deals" },
      { label: "Expediente maestro", to: "/dashboard/expediente", hideForInvestor: true },
      { label: "Mi portafolio", to: "/dashboard/investments" },
      { label: "Vender proyecto", to: "/dashboard/listings", hideForInvestor: true },

      { label: "Ofertas recibidas", to: "/dashboard/offerings", hideForInvestor: true },
    ],
  },

  {
    to: "/dashboard/acquisitions",
    label: "Pipeline de Adquisición",
    icon: Compass,
    group: "CAPITAL & DEALS",
    module: "capital",
    hideForInvestor: true,
  },

  {
    to: "/dashboard/agua",
    label: "Water Assets",
    icon: Droplets,
    group: "CAPITAL & DEALS",
    module: "capital",
  },

  // ─────────────── ADMINISTRACIÓN (transversal) ───────────────
  {
    to: "/dashboard/analytics",
    label: "Analítica",
    icon: BarChart3,
    group: "ADMINISTRACIÓN",
    module: "core",
  },
  {
    to: "/dashboard/approvals",
    label: "Aprobaciones",
    icon: ClipboardCheck,
    group: "ADMINISTRACIÓN",
    module: "core",
    hideForInvestor: true,
    capability: "approvals",
  },
  {
    to: "/dashboard/finance",
    label: "Costos",
    icon: DollarSign,
    group: "ADMINISTRACIÓN",
    module: "core",
    hideForInvestor: true,
    capability: "finance",
  },
  {
    to: "/dashboard/hse",
    label: "HSE",
    icon: ShieldAlert,
    group: "ADMINISTRACIÓN",
    module: "core",
    hideForInvestor: true,
    capability: "hse",
  },
  {
    to: "/dashboard/team",
    label: "Equipo",
    icon: Users,
    group: "ADMINISTRACIÓN",
    module: "core",
    hideForInvestor: true,
    capability: "team",
  },
  {
    to: "/dashboard/audit",
    label: "Auditoría",
    icon: ClipboardList,
    group: "ADMINISTRACIÓN",
    module: "core",
    hideForInvestor: true,
    capability: "audit",
  },
  // «Marketplace de capas» vive como pestaña «Capas GIS» dentro de Catastro.

  {
    to: "/dashboard/plan",
    label: "Plan y uso",
    icon: Sparkles,
    group: "ADMINISTRACIÓN",
    module: "core",
  },
  {
    to: "/dashboard/api",
    label: "API · Llaves",
    icon: KeyRound,
    group: "ADMINISTRACIÓN",
    module: "core",
  },
  {
    to: "/dashboard/profile",
    label: "Mi perfil",
    icon: UserCircle,
    group: "ADMINISTRACIÓN",
    module: "core",
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
  let best: WorkspaceEntry | null = null;
  let bestLen = -1;
  for (const entry of WORKSPACE_NAV) {
    const candidates = entry.tabs?.map((t) => t.to) ?? [entry.to];
    for (const c of candidates) {
      const match = pathname === c || pathname.startsWith(c + "/");
      if (match && c.length > bestLen) {
        best = entry;
        bestLen = c.length;
      }
    }
  }
  return best;
}
