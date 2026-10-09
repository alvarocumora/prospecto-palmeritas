import { createFileRoute, Outlet, Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useProjects } from "@/hooks/useProjects";
import { LogOut, X } from "lucide-react";

import { useUnreadCatastroAlerts } from "@/hooks/useUnreadCatastroAlerts";
import { useMyModules, useSelectedModule } from "@/hooks/useMyModules";
import { useWorkspaceAccess } from "@/hooks/useWorkspaceAccess";
import { ModuleAccessGate } from "@/components/access/ModuleAccessGate";
import { ROLE_LABEL } from "@/lib/access/workspaceAccess";
import { CommandRail, type RailItem } from "@/components/ops/CommandRail";
import { ModuleSwitcher } from "@/components/ops/ModuleSwitcher";
import { TopBar } from "@/components/ops/TopBar";
import { StatusBar } from "@/components/ops/StatusBar";
import { MobileBottomNav } from "@/components/ops/MobileBottomNav";
import { Logo } from "@/components/Logo";
import { moduleForRoute } from "@/lib/modules";
import { WORKSPACE_NAV } from "@/lib/workspace";
import { WorkspaceTabs } from "@/components/ops/WorkspaceTabs";
import { projectIdFromSearch, workspaceProjectId } from "@/lib/projects/navigation";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated")({
  validateSearch: (search: Record<string, unknown>): { project?: string } => ({
    project: projectIdFromSearch(search.project),
  }),
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { user, profile, loading, signOut } = useAuth();
  const { active, projects, setActiveId, loading: projectsLoading } = useProjects();
  const access = useWorkspaceAccess();
  const { total: catastroAlerts } = useUnreadCatastroAlerts(active?.id ?? null);
  const { data: myModules } = useMyModules();
  const [selectedModule, setSelectedModule] = useSelectedModule(myModules?.modules);
  const locale: "es" | "en" =
    (profile as { language?: string } | null)?.language === "en" ? "en" : "es";
  const navigate = useNavigate();
  const location = useLocation();
  const { project } = Route.useSearch();
  const requestedProject = workspaceProjectId(location.pathname, project);
  const requestedMember = projects.find((item) => item.id === requestedProject);
  const [mounted, setMounted] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || loading) return;
    if (!user) navigate({ to: "/auth" });
  }, [mounted, loading, user, navigate]);

  useEffect(() => {
    if (!projectsLoading && requestedMember && active?.id !== requestedProject) {
      setActiveId(requestedMember.id);
    }
  }, [active?.id, projectsLoading, requestedMember, requestedProject, setActiveId]);

  // El INICIO ya no exige proyecto: es el Centro de Negocios (cross-proyecto)
  // y maneja su propio empty state. Los inversionistas sin proyectos aterrizan
  // ahí directamente; no se les empuja a /dashboard/projects.

  // Close drawer on route change
  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  // Gate de ruta (control de acceso maestro): si el usuario navegó a una
  // pantalla que su rol/plan no permite, lo devolvemos al Inicio con aviso.
  // (Debe ir antes de cualquier return temprano.)
  useEffect(() => {
    if (!access.ready) return;
    const decision = access.canPath(location.pathname);
    if (decision.allowed) return;
    if (decision.reason.kind === "plan") {
      navigate({ to: "/dashboard", search: { locked: decision.reason.module } as never });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, access.ready]);

  if (!mounted || loading) return null;
  if (!user) return null;

  // Navegación deals-first: el negocio (venta de proyectos, inversión y
  // materias primas) va primero para TODOS los roles; la operación y las
  // herramientas técnicas de exploración quedan detrás, gateadas por rol.
  const items: RailItem[] = WORKSPACE_NAV.filter((e) => access.canEntry(e).allowed).map((e) => {
    const Icon = e.icon;
    return {
      to: e.to,
      label: e.label,
      group: e.group,
      exact: e.exact,
      icon: <Icon className="w-3.5 h-3.5" />,
      badge: e.badgeKey === "catastroAlerts" ? catastroAlerts : undefined,
    } as RailItem;
  });

  // Filtro por espacio de trabajo seleccionado en el ModuleSwitcher.
  const allowedItems = items.filter((it) => {
    const mod = moduleForRoute(it.to);
    if (mod === "core") return true;
    if (selectedModule !== "all" && mod !== selectedModule) return false;
    return true;
  });

  return (
    <div data-theme="im-light" className="min-h-[100dvh] bg-surface text-content">
      <TopBar onMenuClick={() => setDrawerOpen(true)} />
      <CommandRail
        items={allowedItems}
        brand={null}
        topSlot={
          myModules && myModules.modules.length > 0 ? (
            <ModuleSwitcher
              modules={myModules.modules}
              selected={selectedModule}
              onSelect={setSelectedModule}
              locale={locale}
            />
          ) : null
        }
      />

      {/* Mobile drawer */}
      <MobileDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        items={items}
        userName={profile?.display_name ?? user.email ?? ""}
        roleLabel={access.role ? ROLE_LABEL[access.role] : null}
        onSignOut={async () => {
          await signOut();
          navigate({ to: "/" });
        }}
      />

      <main
        className={cn("relative pt-9 pb-20 md:pb-8 md:pl-14 min-h-[100dvh]")}
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 4.5rem)" }}
      >
        {/* La shell permanece montada al cambiar de módulo. */}
        <WorkspaceTabs pathname={location.pathname} filterTab={access.canTab} />
        <div>
          <ModuleAccessGate pathname={location.pathname}>
            {requestedProject && (projectsLoading || active?.id !== requestedProject) ? (
              <div className="p-6 text-sm">
                {projectsLoading || requestedMember ? (
                  "Activando proyecto…"
                ) : (
                  <>
                    <p>Este proyecto no está disponible en tu workspace.</p>
                    <Link to="/dashboard/projects" search={{ project: undefined }}>
                      Volver a proyectos
                    </Link>
                  </>
                )}
              </div>
            ) : (
              <Outlet />
            )}
          </ModuleAccessGate>
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
  roleLabel,
  onSignOut,
}: {
  open: boolean;
  onClose: () => void;
  items: RailItem[];
  userName: string;
  roleLabel?: string | null;
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
            {roleLabel && (
              <div className="text-[9px] font-mono uppercase tracking-[0.12em] text-text-dim">
                Rol: {roleLabel}
              </div>
            )}
          </div>

          <button type="button" onClick={onSignOut} className="text-text-dim hover:text-signal-red">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </aside>
    </div>
  );
}
