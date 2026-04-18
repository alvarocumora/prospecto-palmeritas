import { createFileRoute, Outlet, redirect, Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { useProjects } from "@/hooks/useProjects";
import {
  Mountain, LayoutDashboard, Map as MapIcon, Activity, Drill,
  TestTube2, FolderKanban, LogOut, ChevronDown, Plus, Loader2,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw redirect({ to: "/auth" });
    }
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { user, profile, loading, signOut } = useAuth();
  const { projects, active, setActiveId, loading: projectsLoading } = useProjects();
  const navigate = useNavigate();
  const [switcherOpen, setSwitcherOpen] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-gold" />
      </div>
    );
  }

  if (!user) return null; // beforeLoad will redirect

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      {/* Sidebar */}
      <aside className="hidden md:flex flex-col w-56 border-r border-border bg-bg-secondary">
        <div className="px-4 h-14 flex items-center border-b border-border">
          <Link to="/"><Logo size={18} textClassName="text-xs" /></Link>
        </div>

        {/* Project switcher */}
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
          {switcherOpen && (
            <div className="absolute left-3 right-3 top-full mt-1 z-50 rounded border border-border bg-background shadow-lg max-h-72 overflow-y-auto">
              {projects.length === 0 && (
                <div className="px-3 py-2 text-[11px] font-mono text-muted-foreground">
                  Aún no tienes proyectos
                </div>
              )}
              {projects.map((p) => (
                <button
                  key={p.id}
                  type="button"
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

        <nav className="flex-1 p-2 space-y-0.5">
          <NavItem to="/dashboard" icon={<LayoutDashboard className="w-3.5 h-3.5" />} label="Resumen" exact />
          <NavItem to="/dashboard/projects" icon={<FolderKanban className="w-3.5 h-3.5" />} label="Proyectos" />
          <NavItem to="/dashboard/catastro" icon={<MapIcon className="w-3.5 h-3.5" />} label="Catastro" />
          <NavItem to="/dashboard/geophysics" icon={<Activity className="w-3.5 h-3.5" />} label="Geofísica" />
          <NavItem to="/dashboard/drilling" icon={<Drill className="w-3.5 h-3.5" />} label="Sondajes" />
          <NavItem to="/dashboard/sampling" icon={<TestTube2 className="w-3.5 h-3.5" />} label="Muestreo" />
          <div className="pt-4 mt-4 border-t border-border">
            <Link
              to="/dashboard/palmeras"
              className="flex items-center gap-2 px-2 py-1.5 rounded text-[11px] font-mono text-muted-foreground hover:text-gold hover:bg-accent transition-colors"
            >
              <Mountain className="w-3.5 h-3.5" /> Demo · Palmeras
            </Link>
          </div>
        </nav>

        {/* User */}
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

      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 h-12 border-b border-border bg-background/95 backdrop-blur flex items-center justify-between px-3">
        <Link to="/"><Logo size={16} textClassName="text-xs" /></Link>
        <button
          type="button"
          onClick={async () => { await signOut(); navigate({ to: "/" }); }}
          className="text-[10px] font-mono text-muted-foreground"
        >
          Salir
        </button>
      </div>

      {/* Main content */}
      <main className="flex-1 min-w-0 md:ml-0 mt-12 md:mt-0">
        <Outlet />
        <MobileBottomNav />
      </main>
    </div>
  );
}

function NavItem({ to, icon, label, exact }: { to: string; icon: React.ReactNode; label: string; exact?: boolean }) {
  const location = useLocation();
  const active = exact ? location.pathname === to : location.pathname.startsWith(to);
  return (
    <Link
      to={to}
      className={`flex items-center gap-2 px-2 py-1.5 rounded text-xs font-mono transition-colors ${
        active ? "bg-gold/10 text-gold" : "text-foreground hover:bg-accent"
      }`}
    >
      {icon}
      <span>{label}</span>
    </Link>
  );
}

function MobileBottomNav() {
  const items = [
    { to: "/dashboard", icon: LayoutDashboard, label: "Inicio" },
    { to: "/dashboard/projects", icon: FolderKanban, label: "Proyectos" },
    { to: "/dashboard/geophysics", icon: Activity, label: "Geofísica" },
    { to: "/dashboard/catastro", icon: MapIcon, label: "Catastro" },
    { to: "/dashboard/drilling", icon: Drill, label: "Sondajes" },
  ];
  const location = useLocation();
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 h-14 border-t border-border bg-background/95 backdrop-blur flex items-stretch">
      {items.map((it) => {
        const Icon = it.icon;
        const active = location.pathname === it.to;
        return (
          <Link
            key={it.to}
            to={it.to}
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
