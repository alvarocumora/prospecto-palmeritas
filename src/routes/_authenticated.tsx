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
  BadgeCheck,
  Database,
  BarChart3,
  Satellite,
  // MapPin removed: field-map consolidated into /dashboard/map
  Scissors,
} from "lucide-react";

import { useIsSuperAdmin } from "@/hooks/useIsSuperAdmin";
import { useUnreadCatastroAlerts } from "@/hooks/useUnreadCatastroAlerts";
import { CommandRail, type RailItem } from "@/components/ops/CommandRail";
import { TopBar } from "@/components/ops/TopBar";
import { StatusBar } from "@/components/ops/StatusBar";
import { MobileBottomNav } from "@/components/ops/MobileBottomNav";
import { Logo } from "@/components/Logo";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated")({
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { user, profile, loading, signOut } = useAuth();
  const { projects, loading: projectsLoading, active } = useProjects();
  const role = useProjectRole();
  const { isAdmin: isSuperAdmin } = useIsSuperAdmin();
  const { total: catastroAlerts } = useUnreadCatastroAlerts(active?.id ?? null);
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

  // Solo empuja al onboarding de proyectos si el usuario aterriza en la home
  // del dashboard SIN proyectos. El resto de rutas (documentos, marketplace,
  // catastro, admin, perfil, etc.) son navegables sin proyecto activo — no
  // tiene sentido bloquearlas.
  useEffect(() => {
    if (!mounted) return;
    if (loading || projectsLoading) return;
    if (!user) return;
    if (projects.length === 0 && location.pathname === "/dashboard") {
      navigate({ to: "/dashboard/projects" });
    }
  }, [mounted, loading, projectsLoading, user, projects.length, location.pathname, navigate]);

  // Close drawer on route change
  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  if (!mounted || loading) return null;
  if (!user) return null;

  const items: RailItem[] = [
    {
      to: "/dashboard",
      icon: <LayoutDashboard className="w-3.5 h-3.5" />,
      label: "Mission Control",
      group: "OPERATIONS",
      exact: true,
    },
    {
      to: "/dashboard/map",
      icon: <Compass className="w-3.5 h-3.5" />,
      label: "Centro Op.",
      group: "OPERATIONS",
    },
    {
      to: "/dashboard/campaigns",
      icon: <Calendar className="w-3.5 h-3.5" />,
      label: "Campañas",
      group: "OPERATIONS",
    },
    canAccess(role, "projects") && {
      to: "/dashboard/projects",
      icon: <FolderKanban className="w-3.5 h-3.5" />,
      label: "Proyectos",
      group: "OPERATIONS",
    },

    canAccess(role, "catastro") && {
      to: "/dashboard/catastro",
      icon: <MapIcon className="w-3.5 h-3.5" />,
      label: "Catastro",
      group: "CADASTRE",
    },
    canAccess(role, "catastro") && {
      to: "/dashboard/boletin",
      icon: <FileText className="w-3.5 h-3.5" />,
      label: "Boletín Minero",
      group: "CADASTRE",
      badge: catastroAlerts,
    },

    canAccess(role, "geophysics") && {
      to: "/dashboard/geophysics",
      icon: <Activity className="w-3.5 h-3.5" />,
      label: "Geofísica",
      group: "FIELD",
    },
    canAccess(role, "geophysics") && {
      to: "/dashboard/drones",
      icon: <Plane className="w-3.5 h-3.5" />,
      label: "Drones",
      group: "FIELD",
    },
    canAccess(role, "drilling") && {
      to: "/dashboard/drilling",
      icon: <Drill className="w-3.5 h-3.5" />,
      label: "Sondajes",
      group: "FIELD",
    },
    canAccess(role, "drilling") && {
      to: "/dashboard/section",
      icon: <Scissors className="w-3.5 h-3.5" />,
      label: "Sección 3D",
      group: "FIELD",
    },
    canAccess(role, "sampling") && {
      to: "/dashboard/sampling",
      icon: <TestTube2 className="w-3.5 h-3.5" />,
      label: "Muestreo",
      group: "FIELD",
    },

    canAccess(role, "qaqc") && {
      to: "/dashboard/qaqc",
      icon: <ShieldCheck className="w-3.5 h-3.5" />,
      label: "QA/QC",
      group: "ANALYSIS",
    },
    canAccess(role, "targets") && {
      to: "/dashboard/targets",
      icon: <Target className="w-3.5 h-3.5" />,
      label: "Targets",
      group: "ANALYSIS",
    },
    canAccess(role, "targets") && {
      to: "/dashboard/satellite-intel",
      icon: <Satellite className="w-3.5 h-3.5" />,
      label: "Inteligencia Sat.",
      group: "ANALYSIS",
    },
    canAccess(role, "estimation") && {
      to: "/dashboard/estimation",
      icon: <BarChart3 className="w-3.5 h-3.5" />,
      label: "Estimación Recursos",
      group: "ANALYSIS",
    },
    canAccess(role, "inventory") && {
      to: "/dashboard/inventory",
      icon: <Boxes className="w-3.5 h-3.5" />,
      label: "Inventario",
      group: "ANALYSIS",
    },
    canAccess(role, "reports") && {
      to: "/dashboard/reports",
      icon: <FileText className="w-3.5 h-3.5" />,
      label: "Reportes",
      group: "ANALYSIS",
    },
    canAccess(role, "reports") && {
      to: "/dashboard/ni43101",
      icon: <FileText className="w-3.5 h-3.5" />,
      label: "Informe 43-101",
      group: "ANALYSIS",
    },
    canAccess(role, "reports") && {
      to: "/dashboard/qps",
      icon: <BadgeCheck className="w-3.5 h-3.5" />,
      label: "QPs · Firmas",
      group: "ANALYSIS",
    },

    canAccess(role, "approvals") && {
      to: "/dashboard/approvals",
      icon: <ClipboardCheck className="w-3.5 h-3.5" />,
      label: "Aprobaciones",
      group: "GOVERNANCE",
    },
    canAccess(role, "finance") && {
      to: "/dashboard/finance",
      icon: <DollarSign className="w-3.5 h-3.5" />,
      label: "Costos",
      group: "GOVERNANCE",
    },
    canAccess(role, "hse") && {
      to: "/dashboard/hse",
      icon: <ShieldAlert className="w-3.5 h-3.5" />,
      label: "HSE",
      group: "GOVERNANCE",
    },
    canAccess(role, "team") && {
      to: "/dashboard/team",
      icon: <Users className="w-3.5 h-3.5" />,
      label: "Equipo",
      group: "GOVERNANCE",
    },
    canAccess(role, "audit") && {
      to: "/dashboard/audit",
      icon: <ClipboardList className="w-3.5 h-3.5" />,
      label: "Auditoría",
      group: "GOVERNANCE",
    },
    canAccess(role, "audit") && {
      to: "/dashboard/validation",
      icon: <Database className="w-3.5 h-3.5" />,
      label: "Validación Datos",
      group: "GOVERNANCE",
    },
    canAccess(role, "marketplace") && {
      to: "/dashboard/marketplace",
      icon: <LayersIcon className="w-3.5 h-3.5" />,
      label: "Marketplace Capas",
      group: "GOVERNANCE",
    },
    {
      to: "/dashboard/deals",
      icon: <Briefcase className="w-3.5 h-3.5" />,
      label: "Marketplace Deals",
      group: "GOVERNANCE",
    },

    {
      to: "/dashboard/profile",
      icon: <UserCircle className="w-3.5 h-3.5" />,
      label: "Mi Perfil",
      group: "ACCOUNT",
    },
    isSuperAdmin && {
      to: "/dashboard/admin",
      icon: <Crown className="w-3.5 h-3.5" />,
      label: "Admin",
      group: "ACCOUNT",
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
