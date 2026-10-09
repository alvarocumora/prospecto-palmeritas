import { Link } from "@tanstack/react-router";
import type { PortfolioProject } from "@/lib/terminal.functions";
import { cn } from "@/lib/utils";
import { AlertTriangle, Layers } from "lucide-react";

type Props = {
  projects: PortfolioProject[];
  loading: boolean;
  authed: boolean;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
};

export function PortfolioPanel({ projects, loading, authed, selectedId, onSelect }: Props) {
  if (!authed) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-6 text-center gap-3">
        <p className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
          Portfolio privado
        </p>
        <p className="text-sm text-foreground max-w-xs">
          Inicia sesión para ver tus proyectos, concesiones y alertas activas.
        </p>
        <Link
          to="/auth"
          className="px-3 py-1.5 text-xs font-mono rounded-md bg-gold text-background hover:bg-gold-light transition-colors"
        >
          Iniciar sesión
        </Link>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="h-8 px-3 flex items-center justify-between border-b border-border">
        <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
          Portfolio · {projects.length} proyectos
        </span>
        <span className="text-[10px] font-mono text-signal-red">
          {projects.reduce((s, p) => s + p.open_alerts, 0)} alertas
        </span>
      </div>
      <div className="flex-1 overflow-auto">
        {loading && (
          <div className="p-3 text-[11px] font-mono text-muted-foreground">cargando…</div>
        )}
        {!loading && projects.length === 0 && (
          <div className="p-3 text-[11px] font-mono text-muted-foreground">
            Sin proyectos asignados. Crea uno desde el dashboard.
          </div>
        )}
        <table className="w-full text-[11px] font-mono">
          <thead className="text-[10px] uppercase text-muted-foreground border-b border-border">
            <tr>
              <th className="text-left px-3 py-1.5 font-normal">Código</th>
              <th className="text-left px-2 py-1.5 font-normal">Proyecto</th>
              <th className="text-left px-2 py-1.5 font-normal">Commodity</th>
              <th className="text-right px-2 py-1.5 font-normal">Concesiones</th>
              <th className="text-right px-3 py-1.5 font-normal">Alertas</th>
            </tr>
          </thead>
          <tbody>
            {projects.map((p) => (
              <tr
                key={p.id}
                onClick={() => onSelect(p.id === selectedId ? null : p.id)}
                className={cn(
                  "border-b border-border/50 cursor-pointer transition-colors",
                  selectedId === p.id ? "bg-gold/10" : "hover:bg-muted/30",
                )}
              >
                <td className="px-3 py-1.5 text-gold">{p.code}</td>
                <td className="px-2 py-1.5 text-foreground truncate max-w-[160px]">
                  <Link
                    to="/dashboard/project-report"
                    search={{ project: p.id }}
                    onClick={(event) => event.stopPropagation()}
                    className="hover:underline"
                  >
                    {p.name} →
                  </Link>
                </td>
                <td className="px-2 py-1.5 text-muted-foreground uppercase">
                  {p.commodity ?? "—"}
                </td>
                <td className="px-2 py-1.5 text-right text-foreground">
                  <span className="inline-flex items-center gap-1 justify-end">
                    <Layers className="w-3 h-3 text-muted-foreground" />
                    {p.concession_count}
                  </span>
                </td>
                <td className="px-3 py-1.5 text-right">
                  {p.open_alerts > 0 ? (
                    <span className="inline-flex items-center gap-1 justify-end text-signal-red">
                      <AlertTriangle className="w-3 h-3" />
                      {p.open_alerts}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">0</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
