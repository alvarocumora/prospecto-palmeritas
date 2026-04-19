import { createFileRoute, Outlet, Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useProjects } from "@/hooks/useProjects";
import { useProjectRole, canAccess, type ProjectRole } from "@/hooks/useProjectRole";
import {
  Mountain, LayoutDashboard, Map as MapIcon, Activity, Drill,
  TestTube2, FolderKanban, LogOut, ChevronDown, Plus,
  Users, ClipboardList, Layers as LayersIcon, UserCircle, Crown, Compass, Plane, Calendar,
} from "lucide-react";
import { Logo } from "@/components/Logo";

import { GeoAssistant } from "@/components/GeoAssistant";
import { OnlineStatusBadge } from "@/components/OnlineStatusBadge";
import { useIsSuperAdmin } from "@/hooks/useIsSuperAdmin";

export const Route = createFileRoute("/_authenticated")({
  // Auth check is client-only — Supabase session lives in localStorage and is not
  // available during SSR. Running the redirect on the server bounces every refresh
  // to /auth and breaks hydration. The component-level guard handles it on the client.
  component: AuthenticatedLayout,
});

const ROLE_LABELS: Record<ProjectRole, string> = {
  owner: "Propietario", admin: "Admin", geologist: "Geólogo", viewer: "Lector",
};
const ROLE_COLORS: Record<ProjectRole, string> = {
  owner: "bg-gold/15 text-gold border-gold/30",
  admin: "bg-info/15 text-info border-info/30",
  geologist: "bg-teal/15 text-teal border-teal/30",
  viewer: "bg-muted text-muted-foreground border-border",
};

function AuthenticatedLayout() {
  const { user, profile, loading, signOut } = useAuth();
  const { projects, active, setActiveId, loading: projectsLoading } = useProjects();
  const role = useProjectRole();
  const { isAdmin: isSuperAdmin } = useIsSuperAdmin();
  const navigate = useNavigate();
  const location = useLocation();
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  // Client-only redirect to /auth when no session
  useEffect(() => {
    if (!mounted || loading) return;
    if (!user) navigate({ to: "/auth" });
  }, [mounted, loading, user, navigate]);

  useEffect(() => {
    if (!mounted) return;
    if (loading || projectsLoading) return;
    if (!user) return;
    if (projects.length === 0 && location.pathname !== "/dashboard/projects") {
      navigate({ to: "/dashboard/projects" });
    }
  }, [mounted, loading, projectsLoading, user, projects.length, location.pathname, navigate]);

  if (!mounted || loading) return null;
  if (!user) return null;

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      <aside className="hidden md:flex flex-col w-56 border-r border-border bg-bg-secondary">
        <div className="px-4 h-14 flex items-center justify-between border-b border-border">
          <Link to="/"><Logo size={18} textClassName="text-xs" /></Link>
          <OnlineStatusBadge />
        </div>

        <div className="p-3 border-b border-border relative">
          <div className="text-[10px] uppercase font-mono text-muted-foreground mb-1">Proyecto activo</div>
          <button
            type="button"
            onClick={() => setSwitcherOpen((v) => !v)}
            className="w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded border border-border bg-background hover:bg-accent transition-colors text-left"
          >
            <span className="truncate text-xs font-mono">
              {projectsLoading ? "Cargando…" : active?.name ?? "Sin proyectos"}
            </span>
            <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0" />
          </button>
          {role && (
            <div className={`mt-1.5 inline-flex items-center text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border ${ROLE_COLORS[role]}`}>
              {ROLE_LABELS[role]}
            </div>
          )}
          {switcherOpen && (
            <div className="absolute left-3 right-3 top-full mt-1 z-50 rounded border border-border bg-background shadow-lg max-h-72 overflow-y-auto">
              {projects.length === 0 && (
                <div className="px-3 py-2 text-[11px] font-mono text-muted-foreground">Aún no tienes proyectos</div>
              )}
              {projects.map((p) => (
                <button
                  key={p.id} type="button"
                  onClick={() => { setActiveId(p.id); setSwitcherOpen(false); }}
                  className={`w-full text-left px-3 py-2 text-xs font-mono hover:bg-accent transition-colors border-b border-border/50 last:border-b-0 ${
                    p.id === active?.id ? "bg-gold/10 text-gold" : "text-foreground"
                  }`}
                >
                  <div className="font-semibold truncate">{p.name}</div>
                  <div className="text-[10px] text-muted-foreground">{p.code} · {p.role}</div>
                </button>
              ))}
              <button
                type="button"
                onClick={() => { setSwitcherOpen(false); navigate({ to: "/dashboard/projects" }); }}
                className="w-full text-left px-3 py-2 text-xs font-mono text-gold hover:bg-accent inline-flex items-center gap-1.5 border-t border-border"
              >
                <Plus className="w-3 h-3" /> Nuevo proyecto
              </button>
            </div>
          )}
        </div>

        <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
          <NavItem to="/dashboard" icon={<LayoutDashboard className="w-3.5 h-3.5" />} label="Resumen" exact module="overview" role={role} />
          <NavItem to="/dashboard/map" icon={<Compass className="w-3.5 h-3.5" />} label="Centro Op." module="overview" role={role} />
          <NavItem to="/dashboard/campaigns" icon={<Calendar className="w-3.5 h-3.5" />} label="Campañas" module="overview" role={role} />
          {canAccess(role, "projects") && (
            <NavItem to="/dashboard/projects" icon={<FolderKanban className="w-3.5 h-3.5" />} label="Proyectos" module="projects" role={role} />
          )}
          <NavItem to="/dashboard/catastro" icon={<MapIcon className="w-3.5 h-3.5" />} label="Catastro" module="catastro" role={role} />
          <NavItem to="/dashboard/geophysics" icon={<Activity className="w-3.5 h-3.5" />} label="Geofísica" module="geophysics" role={role} />
          <NavItem to="/dashboard/drones" icon={<Plane className="w-3.5 h-3.5" />} label="Drones" module="geophysics" role={role} />
          <NavItem to="/dashboard/drilling" icon={<Drill className="w-3.5 h-3.5" />} label="Sondajes" module="drilling" role={role} />
          <NavItem to="/dashboard/sampling" icon={<TestTube2 className="w-3.5 h-3.5" />} label="Muestreo" module="sampling" role={role} />

          <div className="pt-3 mt-3 border-t border-border" />
          {canAccess(role, "team") && (
            <NavItem to="/dashboard/team" icon={<Users className="w-3.5 h-3.5" />} label="Equipo" module="team" role={role} />
          )}
          {canAccess(role, "audit") && (
            <NavItem to="/dashboard/audit" icon={<ClipboardList className="w-3.5 h-3.5" />} label="Auditoría" module="audit" role={role} />
          )}
          {canAccess(role, "marketplace") && (
            <NavItem to="/dashboard/marketplace" icon={<LayersIcon className="w-3.5 h-3.5" />} label="Marketplace" module="marketplace" role={role} />
          )}
          <NavItem to="/dashboard/profile" icon={<UserCircle className="w-3.5 h-3.5" />} label="Mi Perfil" module="profile" role={role} />

          {isSuperAdmin && (
            <Link
              to="/dashboard/admin"
              className={`flex items-center gap-2 px-2 py-1.5 rounded text-xs font-mono transition-colors ${
                location.pathname.startsWith("/dashboard/admin") ? "bg-gold/10 text-gold" : "text-gold hover:bg-accent"
              }`}
            >
              <Crown className="w-3.5 h-3.5" /> Admin Plataforma
            </Link>
          )}

          {canAccess(role, "palmeras") && (
            <div className="pt-4 mt-4 border-t border-border">
              <Link
                to="/dashboard/palmeras"
                className="flex items-center gap-2 px-2 py-1.5 rounded text-[11px] font-mono text-muted-foreground hover:text-gold hover:bg-accent transition-colors"
              >
                <Mountain className="w-3.5 h-3.5" /> Demo · Palmeras
              </Link>
            </div>
          )}
        </nav>

        <div className="p-3 border-t border-border">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-gold/20 text-gold inline-flex items-center justify-center text-[11px] font-mono font-bold">
              {(profile?.display_name ?? user.email ?? "?")[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-mono truncate">{profile?.display_name ?? "Usuario"}</div>
              <div className="text-[10px] text-muted-foreground truncate">{user.email}</div>
            </div>
            <button
              type="button"
              onClick={async () => { await signOut(); navigate({ to: "/" }); }}
              className="p-1.5 text-muted-foreground hover:text-destructive transition-colors"
              title="Cerrar sesión"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </aside>

      <div className="md:hidden fixed top-0 left-0 right-0 z-40 h-12 border-b border-border bg-background/95 backdrop-blur flex items-center justify-between px-3">
        <Link to="/"><Logo size={16} textClassName="text-xs" /></Link>
        <div className="flex items-center gap-3">
          <OnlineStatusBadge />
          <button
            type="button"
            onClick={async () => { await signOut(); navigate({ to: "/" }); }}
            className="text-[10px] font-mono text-muted-foreground"
          >Salir</button>
        </div>
      </div>

      <main className="flex-1 min-w-0 md:ml-0 mt-12 md:mt-0">
        <Outlet />
        <MobileBottomNav role={role} />
      </main>

      <GeoAssistant />
    </div>
  );
}

function NavItem({
  to, icon, label, exact, module, role,
}: {
  to: string; icon: React.ReactNode; label: string; exact?: boolean;
  module: string; role: ProjectRole | null;
}) {
  const location = useLocation();
  const active = exact ? location.pathname === to : location.pathname.startsWith(to);
  const allowed = canAccess(role, module);
  if (!allowed) return null;
  return (
    <Link
      to={to}
      className={`flex items-center gap-2 px-2 py-1.5 rounded text-xs font-mono transition-colors ${
        active ? "bg-gold/10 text-gold" : "text-foreground hover:bg-accent"
      }`}
    >
      {icon}<span>{label}</span>
    </Link>
  );
}

function MobileBottomNav({ role }: { role: ProjectRole | null }) {
  const items = [
    { to: "/dashboard", icon: LayoutDashboard, label: "Inicio", module: "overview" },
    { to: "/dashboard/projects", icon: FolderKanban, label: "Proyectos", module: "projects" },
    { to: "/dashboard/geophysics", icon: Activity, label: "Geofísica", module: "geophysics" },
    { to: "/dashboard/drilling", icon: Drill, label: "Sondajes", module: "drilling" },
    { to: "/dashboard/team", icon: Users, label: "Equipo", module: "team" },
  ].filter((it) => canAccess(role, it.module));
  const location = useLocation();
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 h-14 border-t border-border bg-background/95 backdrop-blur flex items-stretch">
      {items.map((it) => {
        const Icon = it.icon;
        const active = location.pathname === it.to;
        return (
          <Link
            key={it.to} to={it.to}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 text-[9px] font-mono ${
              active ? "text-gold" : "text-muted-foreground"
            }`}
          >
            <Icon className="w-4 h-4" />
            <span>{it.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
