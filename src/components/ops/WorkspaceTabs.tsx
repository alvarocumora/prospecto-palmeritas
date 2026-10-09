import { Link, useLocation } from "@tanstack/react-router";
import { useProjects } from "@/hooks/useProjects";
import { cn } from "@/lib/utils";
import { findWorkspaceEntry, type WorkspaceTab } from "@/lib/workspace";

/**
 * Sub-navegación de la pantalla canónica: las antiguas entradas sueltas del
 * menú viven aquí como pestañas. Se renderiza una sola vez en el layout
 * autenticado, encima del `<Outlet />`.
 */
export function WorkspaceTabs({
  pathname,
  filterTab,
}: {
  pathname: string;
  filterTab?: (tab: WorkspaceTab) => boolean;
}) {
  const location = useLocation();
  const { active: project } = useProjects();
  const entry = findWorkspaceEntry(pathname);
  if (pathname.startsWith("/projects/") || !entry?.tabs || entry.tabs.length < 2) return null;

  const tabs = filterTab ? entry.tabs.filter(filterTab) : entry.tabs;
  if (tabs.length < 2) return null;

  const current = location.pathname;

  return (
    <div className="sticky top-9 z-20 border-b border-border bg-bg-panel/95 backdrop-blur supports-[backdrop-filter]:bg-bg-panel/80">
      <div className="flex items-center gap-1 overflow-x-auto scrollbar-none px-3 md:px-5">
        <span className="hidden md:inline shrink-0 pr-3 mr-1 border-r border-border/60 font-mono text-[9px] uppercase tracking-[0.14em] text-text-dim">
          {entry.label}
        </span>
        {tabs.map((t) => {
          const active = t.exact
            ? current === t.to
            : current === t.to || current.startsWith(t.to + "/");
          return (
            <Link
              key={t.to}
              to={t.to}
              search={{ project: project?.id }}
              className={cn(
                "shrink-0 h-8 inline-flex items-center px-3 font-mono text-[11px] border-b-2 -mb-px transition-colors",
                active
                  ? "border-signal-cyan text-signal-cyan"
                  : "border-transparent text-text-mono hover:text-foreground",
              )}
            >
              {t.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
