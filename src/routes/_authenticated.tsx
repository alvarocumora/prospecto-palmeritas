import { createFileRoute, Outlet, Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useProjects } from "@/hooks/useProjects";
import { useProjectRole, canAccess } from "@/hooks/useProjectRole";
import {
  // Mountain removed: palmeras demo no longer in sidebar
  LayoutDashboard,
  Map as MapIcon,
  Activity,
  Drill,
  TestTube2,
  FolderKanban,
  LogOut,
  Users,
  ClipboardList,
  Layers as LayersIcon,
  UserCircle,
  Crown,
  Sparkles,
  Compass,
  Plane,
  Calendar,
  ShieldCheck,
  ClipboardCheck,
  Target,
  Boxes,
  DollarSign,
  ShieldAlert,
  FileText,
  X,
  Briefcase,
  Handshake,
  Ship,
  TrendingUp,
  Package,
  PackageSearch,
  MessageSquare,
  FileSignature,
  Banknote,
  Magnet,
  KeyRound,
  LineChart,
  BadgeCheck,
  Wallet,
  LayoutGrid,
  Database,
  BarChart3,
  Satellite,
  // MapPin removed: field-map consolidated into /dashboard/map
  Scissors,
} from "lucide-react";

import { useIsSuperAdmin } from "@/hooks/useIsSuperAdmin";
import { useUnreadCatastroAlerts } from "@/hooks/useUnreadCatastroAlerts";
import { useMyModules, useSelectedModule } from "@/hooks/useMyModules";
import { CommandRail, type RailItem } from "@/components/ops/CommandRail";
import { ModuleSwitcher } from "@/components/ops/ModuleSwitcher";
import { TopBar } from "@/components/ops/TopBar";
import { StatusBar } from "@/components/ops/StatusBar";
import { MobileBottomNav } from "@/components/ops/MobileBottomNav";
import { Logo } from "@/components/Logo";
import { moduleForRoute } from "@/lib/modules";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated")({
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { user, profile, loading, signOut } = useAuth();
  const { projects, active } = useProjects();
  const role = useProjectRole();
  const { isAdmin: isSuperAdmin } = useIsSuperAdmin();
  const { total: catastroAlerts } = useUnreadCatastroAlerts(active?.id ?? null);
  const { data: myModules } = useMyModules();
  const [selectedModule, setSelectedModule] = useSelectedModule(myModules?.modules);
  const locale: "es" | "en" = (profile as any)?.language === "en" ? "en" : "es";
  const navigate = useNavigate();
  const location = useLocation();
  const [mounted, setMounted] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || loading) return;
    if (!user) navigate({ to: "/auth" });
  }, [mounted, loading, user, navigate]);

  // El INICIO ya no exige proyecto: es el Centro de Negocios (cross-proyecto)
  // y maneja su propio empty state. Los inversionistas sin proyectos aterrizan
  // ahí directamente; no se les empuja a /dashboard/projects.

  // Close drawer on route change
  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  if (!mounted || loading) return null;
  if (!user) return null;

  // Navegación deals-first: el negocio (venta de proyectos, inversión y
  // materias primas) va primero para TODOS los roles; la operación y las
  // herramientas técnicas de exploración quedan detrás, gateadas por rol.
  const accountType = (profile?.account_type ?? null) as
    | "investor"
    | "mining_owner"
    | "geocapitals_team"
    | null;
  const isInvestor = accountType === "investor";
  // Inversionista sin proyectos: no ve operación/exploración/gobernanza.
  const showOps = !isInvestor || projects.length > 0;

  const items: RailItem[] = [
    // ---- NEGOCIO (deals mineros: el corazón de la plataforma) ----
    {
      to: "/dashboard",
      icon: <LayoutDashboard className="w-3.5 h-3.5" />,
      label: "Inicio",
      group: "NEGOCIO",
      exact: true,
    },
    {
      to: "/dashboard/deals",
      icon: <Briefcase className="w-3.5 h-3.5" />,
      label: "Deals de Proyectos",
      group: "NEGOCIO",
    },
    {
      to: "/dashboard/investments",
      icon: <TrendingUp className="w-3.5 h-3.5" />,
      label: "Inversiones",
      group: "NEGOCIO",
    },
    !isInvestor && {
      to: "/dashboard/listings",
      icon: <FolderKanban className="w-3.5 h-3.5" />,
      label: "Vender Proyecto",
      group: "NEGOCIO",
    },
    !isInvestor && {
      to: "/dashboard/commodity-lots",
      icon: <Package className="w-3.5 h-3.5" />,
      label: "Materias Primas",
      group: "NEGOCIO",
    },
    !isInvestor && {
      to: "/dashboard/sourcing",
      icon: <PackageSearch className="w-3.5 h-3.5" />,
      label: "Requerimientos",
      group: "NEGOCIO",
    },
    {
      to: "/dashboard/my-inquiries",
      icon: <MessageSquare className="w-3.5 h-3.5" />,
      label: "Cotizaciones",
      group: "NEGOCIO",
    },
    {
      to: "/dashboard/clientes",
      icon: <Users className="w-3.5 h-3.5" />,
      label: "Clientes y Asociados",
      group: "NEGOCIO",
    },
    {
      to: "/dashboard/analytics",
      icon: <BarChart3 className="w-3.5 h-3.5" />,
      label: "Analítica",
      group: "NEGOCIO",
    },
    {
      to: "/dashboard/trades",
      icon: <Handshake className="w-3.5 h-3.5" />,
      label: "Mesa de operaciones",
      group: "NEGOCIO",
    },
    {
      to: "/dashboard/trade-board",
      icon: <LayoutGrid className="w-3.5 h-3.5" />,
      label: "Tablero de trades",
      group: "NEGOCIO",
    },
    {
      to: "/dashboard/cobranza",
      icon: <Wallet className="w-3.5 h-3.5" />,
      label: "Cobranza",
      group: "NEGOCIO",
    },
    {
      to: "/dashboard/envios",
      icon: <Ship className="w-3.5 h-3.5" />,
      label: "Envíos",
      group: "NEGOCIO",
    },
    !isInvestor && {
      to: "/dashboard/anticipos",
      icon: <Banknote className="w-3.5 h-3.5" />,
      label: "Anticipos",
      group: "NEGOCIO",
    },
    {
      to: "/dashboard/precios",
      icon: <LineChart className="w-3.5 h-3.5" />,
      label: "Precios Metales",
      group: "NEGOCIO",
    },
    {
      to: "/dashboard/documentos",
      icon: <FileSignature className="w-3.5 h-3.5" />,
      label: "Documentos · Firma",
      group: "NEGOCIO",
    },
    {
      to: "/dashboard/firmas",
      icon: <BadgeCheck className="w-3.5 h-3.5" />,
      label: "Mis firmas",
      group: "NEGOCIO",
    },

    // ---- OPERACIÓN (gestión del activo minero) ----
    showOps &&
      canAccess(role, "projects") && {
        to: "/dashboard/projects",
        icon: <FolderKanban className="w-3.5 h-3.5" />,
        label: "Proyectos",
        group: "OPERACIÓN",
      },
    showOps && {
      to: "/dashboard/mission",
      icon: <LayoutDashboard className="w-3.5 h-3.5" />,
      label: "Mission Control",
      group: "OPERACIÓN",
    },
    showOps && {
      to: "/dashboard/project-report",
      icon: <FileText className="w-3.5 h-3.5" />,
      label: "Reporte del Proyecto",
      group: "OPERACIÓN",
    },
    showOps && {
      to: "/dashboard/map",
      icon: <Compass className="w-3.5 h-3.5" />,
      label: "Mapa Táctico",
      group: "OPERACIÓN",
    },
    showOps && {
      to: "/dashboard/campaigns",
      icon: <Calendar className="w-3.5 h-3.5" />,
      label: "Campañas",
      group: "OPERACIÓN",
    },
    showOps &&
      canAccess(role, "catastro") && {
        to: "/dashboard/catastro",
        icon: <MapIcon className="w-3.5 h-3.5" />,
        label: "Catastro",
        group: "OPERACIÓN",
      },
    showOps &&
      canAccess(role, "catastro") && {
        to: "/dashboard/boletin",
        icon: <FileText className="w-3.5 h-3.5" />,
        label: "Boletín Minero",
        group: "OPERACIÓN",
        badge: catastroAlerts,
      },

    // ---- EXPLORACIÓN (herramientas técnicas — segundo plano) ----
    !isInvestor &&
      canAccess(role, "geophysics") && {
        to: "/dashboard/geophysics",
        icon: <Activity className="w-3.5 h-3.5" />,
        label: "Geofísica",
        group: "EXPLORACIÓN",
      },
    !isInvestor &&
      canAccess(role, "geophysics") && {
        to: "/dashboard/mag-revalidations",
        icon: <Magnet className="w-3.5 h-3.5" />,
        label: "Revalidación MAG",
        group: "EXPLORACIÓN",
      },
    !isInvestor &&
      canAccess(role, "geophysics") && {
        to: "/dashboard/drones",
        icon: <Plane className="w-3.5 h-3.5" />,
        label: "Drones",
        group: "EXPLORACIÓN",
      },
    !isInvestor &&
      canAccess(role, "drilling") && {
        to: "/dashboard/drilling",
        icon: <Drill className="w-3.5 h-3.5" />,
        label: "Sondajes",
        group: "EXPLORACIÓN",
      },
    !isInvestor &&
      canAccess(role, "drilling") && {
        to: "/dashboard/section",
        icon: <Scissors className="w-3.5 h-3.5" />,
        label: "Sección 3D",
        group: "EXPLORACIÓN",
      },
    !isInvestor &&
      canAccess(role, "sampling") && {
        to: "/dashboard/sampling",
        icon: <TestTube2 className="w-3.5 h-3.5" />,
        label: "Muestreo",
        group: "EXPLORACIÓN",
      },
    !isInvestor &&
      canAccess(role, "qaqc") && {
        to: "/dashboard/qaqc",
        icon: <ShieldCheck className="w-3.5 h-3.5" />,
        label: "QA/QC",
        group: "EXPLORACIÓN",
      },
    !isInvestor &&
      canAccess(role, "targets") && {
        to: "/dashboard/targets",
        icon: <Target className="w-3.5 h-3.5" />,
        label: "Targets",
        group: "EXPLORACIÓN",
      },
    !isInvestor &&
      canAccess(role, "targets") && {
        to: "/dashboard/satellite-intel",
        icon: <Satellite className="w-3.5 h-3.5" />,
        label: "Inteligencia Sat.",
        group: "EXPLORACIÓN",
      },
    !isInvestor &&
      canAccess(role, "estimation") && {
        to: "/dashboard/estimation",
        icon: <BarChart3 className="w-3.5 h-3.5" />,
        label: "Estimación Recursos",
        group: "EXPLORACIÓN",
      },
    !isInvestor &&
      canAccess(role, "inventory") && {
        to: "/dashboard/inventory",
        icon: <Boxes className="w-3.5 h-3.5" />,
        label: "Inventario",
        group: "EXPLORACIÓN",
      },
    !isInvestor &&
      canAccess(role, "reports") && {
        to: "/dashboard/reports",
        icon: <FileText className="w-3.5 h-3.5" />,
        label: "Reportes",
        group: "EXPLORACIÓN",
      },
    !isInvestor &&
      canAccess(role, "reports") && {
        to: "/dashboard/ni43101",
        icon: <FileText className="w-3.5 h-3.5" />,
        label: "Informe 43-101",
        group: "EXPLORACIÓN",
      },
    !isInvestor &&
      canAccess(role, "reports") && {
        to: "/dashboard/qps",
        icon: <BadgeCheck className="w-3.5 h-3.5" />,
        label: "QPs · Firmas",
        group: "EXPLORACIÓN",
      },

    // ---- GOBERNANZA ----
    !isInvestor &&
      canAccess(role, "approvals") && {
        to: "/dashboard/approvals",
        icon: <ClipboardCheck className="w-3.5 h-3.5" />,
        label: "Aprobaciones",
        group: "GOBERNANZA",
      },
    !isInvestor &&
      canAccess(role, "finance") && {
        to: "/dashboard/finance",
        icon: <DollarSign className="w-3.5 h-3.5" />,
        label: "Costos",
        group: "GOBERNANZA",
      },
    !isInvestor &&
      canAccess(role, "hse") && {
        to: "/dashboard/hse",
        icon: <ShieldAlert className="w-3.5 h-3.5" />,
        label: "HSE",
        group: "GOBERNANZA",
      },
    !isInvestor &&
      canAccess(role, "team") && {
        to: "/dashboard/team",
        icon: <Users className="w-3.5 h-3.5" />,
        label: "Equipo",
        group: "GOBERNANZA",
      },
    !isInvestor &&
      canAccess(role, "audit") && {
        to: "/dashboard/audit",
        icon: <ClipboardList className="w-3.5 h-3.5" />,
        label: "Auditoría",
        group: "GOBERNANZA",
      },
    !isInvestor &&
      canAccess(role, "audit") && {
        to: "/dashboard/validation",
        icon: <Database className="w-3.5 h-3.5" />,
        label: "Validación Datos",
        group: "GOBERNANZA",
      },
    !isInvestor &&
      canAccess(role, "marketplace") && {
        to: "/dashboard/marketplace",
        icon: <LayersIcon className="w-3.5 h-3.5" />,
        label: "Marketplace Capas",
        group: "GOBERNANZA",
      },

    // ---- CUENTA ----
    {
      to: "/dashboard/plan",
      icon: <Sparkles className="w-3.5 h-3.5" />,
      label: "Plan y uso",
      group: "CUENTA",
    },
    {
      to: "/dashboard/api",
      icon: <KeyRound className="w-3.5 h-3.5" />,
      label: "API · Llaves",
      group: "CUENTA",
    },
    {
      to: "/dashboard/profile",
      icon: <UserCircle className="w-3.5 h-3.5" />,
      label: "Mi Perfil",
      group: "CUENTA",
    },
    isSuperAdmin && {
      to: "/dashboard/admin",
      icon: <Crown className="w-3.5 h-3.5" />,
      label: "Admin",
      group: "CUENTA",
    },
  ].filter(Boolean) as RailItem[];

  return (
    <div className="min-h-[100dvh] bg-background text-foreground ops-grid">
      <TopBar onMenuClick={() => setDrawerOpen(true)} />
      <CommandRail items={items} brand={null} />

      {/* Mobile drawer */}
      <MobileDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        items={items}
        userName={profile?.display_name ?? user.email ?? ""}
        onSignOut={async () => {
          await signOut();
          navigate({ to: "/" });
        }}
      />

      <main
        className={cn("relative pt-9 pb-20 md:pb-8 md:pl-14 min-h-[100dvh]")}
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 4.5rem)" }}
      >
        {/* key por ruta: cada vista entra con un fade-up sutil */}
        <div key={location.pathname} className="animate-fade-up">
          <Outlet />
        </div>
      </main>

      <StatusBar />
      <MobileBottomNav onMoreClick={() => setDrawerOpen(true)} catastroAlerts={catastroAlerts} />
    </div>
  );
}

function MobileDrawer({
  open,
  onClose,
  items,
  userName,
  onSignOut,
}: {
  open: boolean;
  onClose: () => void;
  items: RailItem[];
  userName: string;
  onSignOut: () => void;
}) {
  const groups = items.reduce<Record<string, RailItem[]>>((acc, it) => {
    const g = it.group ?? "—";
    (acc[g] ??= []).push(it);
    return acc;
  }, {});
  const location = useLocation();
  if (!open) return null;
  return (
    <div className="md:hidden fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />
      <aside className="relative w-72 max-w-[85%] h-full bg-bg-panel border-r border-border flex flex-col animate-fade-up">
        <div className="h-10 flex items-center justify-between px-3 border-b border-border">
          <Logo size={14} textClassName="text-[11px]" />
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-text-dim hover:text-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto py-2">
          {Object.entries(groups).map(([group, list]) => (
            <div key={group} className="mb-2">
              {group !== "—" && (
                <div className="px-3 pt-1 pb-1 text-[9px] font-mono uppercase tracking-[0.12em] text-text-dim">
                  {group}
                </div>
              )}
              {list.map((it) => {
                const active = it.exact
                  ? location.pathname === it.to
                  : location.pathname === it.to || location.pathname.startsWith(it.to + "/");
                return (
                  <Link
                    key={it.to}
                    to={it.to}
                    onClick={onClose}
                    className={cn(
                      "flex items-center gap-2.5 h-9 mx-1 px-3 rounded-[2px] font-mono text-[12px] transition-colors",
                      active
                        ? "bg-bg-elevated text-signal-cyan border-l-2 border-signal-cyan"
                        : "text-text-mono hover:bg-bg-elevated",
                    )}
                  >
                    {it.icon}
                    <span className="flex-1 truncate">{it.label}</span>
                    {it.badge && it.badge > 0 ? (
                      <span className="inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-[2px] bg-signal-amber/20 text-signal-amber text-[9px] font-bold tabular-nums border border-signal-amber/40">
                        {it.badge > 99 ? "99+" : it.badge}
                      </span>
                    ) : null}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="border-t border-border p-3 flex items-center gap-2">
          <div className="w-7 h-7 rounded-[2px] bg-signal-cyan/15 text-signal-cyan inline-flex items-center justify-center text-[11px] font-mono font-bold border border-signal-cyan/30">
            {(userName || "?")[0].toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[11px] font-mono truncate">{userName}</div>
          </div>
          <button type="button" onClick={onSignOut} className="text-text-dim hover:text-signal-red">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </aside>
    </div>
  );
}
