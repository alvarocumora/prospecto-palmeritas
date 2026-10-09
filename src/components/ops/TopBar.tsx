import { useState, useEffect, useRef } from "react";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { ChevronDown, Plus, Command, LogOut, UserCircle, Menu } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useProjects } from "@/hooks/useProjects";
import { Logo } from "@/components/Logo";
import { OnlineStatusBadge } from "@/components/OnlineStatusBadge";
import { GlobalGeoCopilot } from "@/components/ops/GlobalGeoCopilot";
import { workspaceProjectId } from "@/lib/projects/navigation";
import { findWorkspaceEntry } from "@/lib/workspace";
import { cn } from "@/lib/utils";

function breadcrumb(path: string): string {
  const entry = findWorkspaceEntry(path);
  const tab = entry?.tabs
    ?.filter((item) => item.exact ? path === item.to : path === item.to || path.startsWith(item.to + "/"))
    .sort((a, b) => b.to.length - a.to.length)[0];
  return tab?.label ?? entry?.label ?? "Workspace";
}

export function TopBar({ onMenuClick }: { onMenuClick?: () => void }) {
  const { user, profile, signOut } = useAuth();
  const { projects, active, setActiveId, loading } = useProjects();
  const [openProj, setOpenProj] = useState(false);
  const [openUser, setOpenUser] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const projRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (openProj && projRef.current && !projRef.current.contains(e.target as Node))
        setOpenProj(false);
      if (openUser && userRef.current && !userRef.current.contains(e.target as Node))
        setOpenUser(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [openProj, openUser]);

  const initial = (profile?.display_name ?? user?.email ?? "?")[0]?.toUpperCase() ?? "?";

  return (
    <header
      className="fixed top-0 left-0 right-0 z-40 h-9 border-b border-border bg-bg-panel/95 backdrop-blur flex items-center select-none"
      role="banner"
    >
      {/* Brand zone */}
      <div className="flex items-center gap-2 h-full pl-2 pr-3 border-r border-border/60">
        {onMenuClick && (
          <button
            type="button"
            onClick={onMenuClick}
            className="md:hidden inline-flex items-center justify-center w-7 h-7 rounded-[2px] text-text-mono hover:bg-bg-elevated"
            aria-label="Menú"
          >
            <Menu className="w-4 h-4" />
          </button>
        )}
        <Link to="/dashboard" className="inline-flex items-center gap-1.5 shrink-0">
          <Logo size={14} textClassName="text-[11px] tracking-[0.12em]" />
        </Link>
      </div>

      {/* Project + breadcrumb zone */}
      <div className="flex items-center gap-2 h-full px-3 min-w-0">
        <div ref={projRef} className="relative shrink-0">
          <button
            type="button"
            onClick={() => setOpenProj((v) => !v)}
            className={cn(
              "flex items-center gap-1.5 h-7 px-2 rounded-[2px] border bg-bg-elevated transition-colors font-mono text-[11px]",
              openProj
                ? "border-signal-cyan text-signal-cyan"
                : "border-border hover:border-border-hot",
            )}
            aria-haspopup="listbox"
            aria-expanded={openProj}
          >
            <span className="hidden sm:inline text-text-dim text-[9px] uppercase tracking-wider">
              Project
            </span>
            <span className="text-foreground tabular-nums truncate max-w-[90px] sm:max-w-[140px]">
              {loading ? "…" : (active?.code ?? "—")}
            </span>
            <ChevronDown
              className={cn("w-3 h-3 text-text-dim transition-transform", openProj && "rotate-180")}
            />
          </button>
          {openProj && (
            <div className="absolute left-0 top-full mt-1 w-72 ops-panel-hot rounded-[3px] shadow-2xl max-h-80 overflow-y-auto z-50">
              {projects.length === 0 && (
                <div className="px-3 py-2 text-[11px] font-mono text-text-dim">
                  [ NO PROJECTS · CREATE ONE ]
                </div>
              )}
              {projects.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setOpenProj(false);
                    if (workspaceProjectId(location.pathname, undefined)) {
                      void navigate({
                        to: "/dashboard/projects/$projectId",
                        params: { projectId: p.id },
                        search: { project: p.id },
                      });
                    } else if (/^\/dashboard\/(cholqui|franco|palmeras)$/.test(location.pathname)) {
                      void navigate({ to: "/dashboard/project-report", search: { project: p.id } });
                    } else {
                      setActiveId(p.id);
                      void navigate({ search: (previous) => ({ ...previous, project: p.id }) });
                    }
                  }}
                  className={cn(
                    "w-full text-left px-3 py-1.5 font-mono text-[11px] border-b border-border/40 last:border-b-0 hover:bg-bg-elevated transition-colors flex items-baseline gap-2",
                    p.id === active?.id &&
                      "bg-bg-elevated text-signal-cyan border-l-2 border-l-signal-cyan",
                  )}
                >
                  <span className="text-text-dim text-[9px] uppercase w-12 shrink-0 tabular-nums">
                    {p.code}
                  </span>
                  <span className="truncate flex-1">{p.name}</span>
                  <span className="text-[9px] text-text-dim uppercase">{p.role}</span>
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  setOpenProj(false);
                  navigate({ to: "/dashboard/projects" });
                }}
                className="w-full text-left px-3 py-1.5 font-mono text-[11px] text-signal-cyan hover:bg-bg-elevated inline-flex items-center gap-1.5 border-t border-border"
              >
                <Plus className="w-3 h-3" /> NEW PROJECT
              </button>
            </div>
          )}
        </div>

        <div className="hidden sm:flex items-center gap-1.5 font-mono text-[10px] min-w-0">
          <span className="text-text-dim/50">/</span>
          <span className="text-text-mono uppercase tracking-wider truncate">
            {breadcrumb(location.pathname)}
          </span>
        </div>
      </div>

      <div className="flex-1" />

      {/* Actions zone */}
      <div className="flex items-center gap-1.5 h-full pr-2 pl-3 border-l border-border/60">
        <GlobalGeoCopilot />
        <button
          type="button"
          title="Command palette (⌘K)"
          className="hidden lg:inline-flex items-center gap-1 h-7 px-2 rounded-[2px] border border-border bg-bg-elevated text-text-mono hover:border-signal-cyan hover:text-signal-cyan transition-colors font-mono text-[10px]"
        >
          <Command className="w-3 h-3" />
          <span>⌘K</span>
        </button>
        <div className="hidden md:inline-flex">
          <OnlineStatusBadge />
        </div>

        {user && (
          <div ref={userRef} className="relative">
            <button
              type="button"
              onClick={() => setOpenUser((v) => !v)}
              className={cn(
                "inline-flex items-center gap-1.5 h-7 pl-1 pr-1.5 rounded-[2px] border transition-colors font-mono text-[11px]",
                openUser ? "border-signal-cyan" : "border-transparent hover:border-border",
              )}
              aria-label="Cuenta"
              aria-expanded={openUser}
            >
              <span className="w-5 h-5 rounded-[2px] bg-signal-cyan/15 text-signal-cyan inline-flex items-center justify-center text-[10px] font-bold border border-signal-cyan/30">
                {initial}
              </span>
              <ChevronDown
                className={cn(
                  "w-3 h-3 text-text-dim transition-transform",
                  openUser && "rotate-180",
                )}
              />
            </button>
            {openUser && (
              <div className="absolute right-0 top-full mt-1 w-56 ops-panel-hot rounded-[3px] shadow-2xl z-50 overflow-hidden">
                <div className="px-3 py-2 border-b border-border">
                  <div className="text-[11px] font-mono text-foreground truncate">
                    {profile?.display_name ?? "Usuario"}
                  </div>
                  <div className="text-[10px] text-text-dim truncate">{user.email}</div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setOpenUser(false);
                    navigate({ to: "/dashboard/profile" });
                  }}
                  className="w-full text-left px-3 py-1.5 text-[11px] font-mono text-text-mono hover:bg-bg-elevated inline-flex items-center gap-2"
                >
                  <UserCircle className="w-3.5 h-3.5" /> Mi perfil
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    setOpenUser(false);
                    await signOut();
                    navigate({ to: "/" });
                  }}
                  className="w-full text-left px-3 py-1.5 text-[11px] font-mono text-signal-red/90 hover:bg-bg-elevated inline-flex items-center gap-2 border-t border-border"
                >
                  <LogOut className="w-3.5 h-3.5" /> Cerrar sesión
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
