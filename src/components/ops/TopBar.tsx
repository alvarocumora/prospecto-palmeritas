import { useState, useEffect, useRef } from "react";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { ChevronDown, Plus, Command } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useProjects } from "@/hooks/useProjects";
import { Logo } from "@/components/Logo";
import { OnlineStatusBadge } from "@/components/OnlineStatusBadge";
import { cn } from "@/lib/utils";

const ROUTE_LABELS: Record<string, string> = {
  "/dashboard": "Mission Control",
  "/dashboard/map": "Centro Op.",
  "/dashboard/catastro": "Catastro",
  "/dashboard/boletin": "Boletín Minero",
  "/dashboard/geophysics": "Geofísica",
  "/dashboard/drones": "Drones",
  "/dashboard/drilling": "Sondajes",
  "/dashboard/sampling": "Muestreo",
  "/dashboard/qaqc": "QA/QC",
  "/dashboard/approvals": "Aprobaciones",
  "/dashboard/targets": "Targets",
  "/dashboard/inventory": "Inventario",
  "/dashboard/finance": "Costos",
  "/dashboard/hse": "HSE",
  "/dashboard/reports": "Reportes",
  "/dashboard/team": "Equipo",
  "/dashboard/audit": "Auditoría",
  "/dashboard/marketplace": "Marketplace",
  "/dashboard/projects": "Proyectos",
  "/dashboard/profile": "Perfil",
  "/dashboard/admin": "Admin",
  "/dashboard/campaigns": "Campañas",
};

function breadcrumb(path: string): string {
  const exact = ROUTE_LABELS[path];
  if (exact) return exact;
  const parts = path.split("/").filter(Boolean);
  while (parts.length > 0) {
    const p = "/" + parts.join("/");
    if (ROUTE_LABELS[p]) return ROUTE_LABELS[p];
    parts.pop();
  }
  return "Dashboard";
}

export function TopBar({ onMenuClick }: { onMenuClick?: () => void }) {
  const { user, signOut } = useAuth();
  const { projects, active, setActiveId, loading } = useProjects();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  return (
    <header
      className="fixed top-0 left-0 right-0 z-40 h-9 border-b border-border bg-bg-panel/95 backdrop-blur flex items-center px-2 gap-3 select-none"
      role="banner"
    >
      {onMenuClick && (
        <button
          type="button"
          onClick={onMenuClick}
          className="md:hidden inline-flex items-center justify-center w-7 h-7 rounded-[2px] text-text-mono hover:bg-bg-elevated"
          aria-label="Menú"
        >
          <span className="block w-3.5 h-px bg-current shadow-[0_4px_0_currentColor,0_-4px_0_currentColor]" />
        </button>
      )}
      <Link to="/" className="inline-flex items-center gap-1.5 shrink-0">
        <Logo size={14} textClassName="text-[11px] tracking-[0.12em]" />
      </Link>

      <div ref={ref} className="relative shrink-0">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={cn(
            "flex items-center gap-1.5 h-7 px-2 rounded-[2px] border border-border bg-bg-elevated hover:border-border-hot transition-colors font-mono text-[11px]",
            open && "border-signal-cyan",
          )}
          aria-haspopup="listbox"
          aria-expanded={open}
        >
          <span className="hidden sm:inline text-text-dim text-[9px] uppercase tracking-wider">Project</span>
          <span className="text-foreground tabular-nums truncate max-w-[90px] sm:max-w-[140px]">
            {loading ? "…" : active?.code ?? "—"}
          </span>
          <ChevronDown className="w-3 h-3 text-text-dim" />
        </button>
        {open && (
          <div className="absolute left-0 top-full mt-0.5 w-72 ops-panel-hot rounded-[2px] shadow-xl max-h-80 overflow-y-auto z-50">
            {projects.length === 0 && (
              <div className="px-3 py-2 text-[11px] font-mono text-text-dim">[ NO PROJECTS · CREATE ONE ]</div>
            )}
            {projects.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => { setActiveId(p.id); setOpen(false); }}
                className={cn(
                  "w-full text-left px-3 py-1.5 font-mono text-[11px] border-b border-border/40 last:border-b-0 hover:bg-bg-elevated transition-colors flex items-baseline gap-2",
                  p.id === active?.id && "bg-bg-elevated text-signal-cyan border-l-2 border-l-signal-cyan",
                )}
              >
                <span className="text-text-dim text-[9px] uppercase w-12 shrink-0 tabular-nums">{p.code}</span>
                <span className="truncate flex-1">{p.name}</span>
                <span className="text-[9px] text-text-dim uppercase">{p.role}</span>
              </button>
            ))}
            <button
              type="button"
              onClick={() => { setOpen(false); navigate({ to: "/dashboard/projects" }); }}
              className="w-full text-left px-3 py-1.5 font-mono text-[11px] text-signal-cyan hover:bg-bg-elevated inline-flex items-center gap-1.5 border-t border-border"
            >
              <Plus className="w-3 h-3" /> NEW PROJECT
            </button>
          </div>
        )}
      </div>

      <div className="hidden sm:flex items-center gap-1.5 font-mono text-[10px] text-text-dim min-w-0">
        <span className="text-text-dim/60">›</span>
        <span className="text-text-mono uppercase tracking-wider truncate">{breadcrumb(location.pathname)}</span>
      </div>

      <div className="flex-1" />

      <button
        type="button"
        title="Command palette (⌘K)"
        className="hidden sm:inline-flex items-center gap-1 h-7 px-2 rounded-[2px] border border-border bg-bg-elevated text-text-mono hover:border-signal-cyan hover:text-signal-cyan transition-colors font-mono text-[10px]"
      >
        <Command className="w-3 h-3" />
        <span>⌘K</span>
      </button>
      <div className="hidden md:flex items-center gap-2">
        <OnlineStatusBadge />
        {user && (
          <button
            type="button"
            onClick={async () => { await signOut(); navigate({ to: "/" }); }}
            className="font-mono text-[10px] text-text-dim hover:text-signal-red uppercase tracking-wider"
          >
            Salir
          </button>
        )}
      </div>
    </header>
  );
}
