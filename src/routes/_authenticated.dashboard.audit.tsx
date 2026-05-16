import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useProjects } from "@/hooks/useProjects";
import { useAuditLog } from "@/hooks/useAuditLog";
import { Clock, Plus, Pencil, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard/audit")({
  head: () => ({ meta: [{ title: "Auditoría — Trackmin GeoIntel" }] }),
  component: AuditPage,
});

const ENTITY_LABELS: Record<string, string> = {
  drill_holes: "Sondaje",
  drill_core_logs: "Registro testigo",
  sampling_results: "Muestra",
  mining_concessions: "Concesión",
};

function AuditPage() {
  const { active } = useProjects();
  const { entries, loading } = useAuditLog(active?.id ?? null, 500);
  const [cutoff, setCutoff] = useState<string>(""); // YYYY-MM-DD

  const filtered = useMemo(() => {
    if (!cutoff) return entries;
    const t = new Date(cutoff + "T23:59:59").getTime();
    return entries.filter((e) => new Date(e.created_at).getTime() <= t);
  }, [entries, cutoff]);

  if (!active)
    return <div className="p-8 text-sm text-muted-foreground">Selecciona un proyecto.</div>;

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto pb-20 md:pb-8">
      <header className="mb-6">
        <div className="text-[10px] uppercase tracking-wider font-mono text-muted-foreground">
          Proyecto · {active.code}
        </div>
        <h1 className="text-xl md:text-2xl font-bold mt-1">Auditoría · Time Machine</h1>
        <p className="text-xs text-muted-foreground mt-1">
          Cada cambio en sondajes, testigos, muestras y concesiones.
        </p>
      </header>

      <div className="mb-4 flex items-center gap-2">
        <Clock className="w-3.5 h-3.5 text-muted-foreground" />
        <label className="text-xs font-mono text-muted-foreground">Ver hasta:</label>
        <input
          type="date"
          value={cutoff}
          onChange={(e) => setCutoff(e.target.value)}
          className="px-2 py-1 text-xs font-mono rounded border border-border bg-background"
        />
        {cutoff && (
          <button
            onClick={() => setCutoff("")}
            className="text-[10px] font-mono text-gold underline"
          >
            limpiar
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground">Cargando…</div>
      ) : (
        <div className="rounded border border-border bg-bg-secondary divide-y divide-border">
          {filtered.length === 0 && (
            <div className="px-3 py-6 text-center text-xs font-mono text-muted-foreground">
              Sin actividad.
            </div>
          )}
          {filtered.map((e) => {
            const Icon = e.action === "INSERT" ? Plus : e.action === "UPDATE" ? Pencil : Trash2;
            const color =
              e.action === "INSERT"
                ? "text-teal"
                : e.action === "UPDATE"
                  ? "text-info"
                  : "text-destructive";
            const label = ENTITY_LABELS[e.entity_type] ?? e.entity_type;
            const name =
              (e.payload as any)?.name ??
              (e.payload as any)?.hole_id ??
              (e.payload as any)?.sample_code ??
              (e.payload as any)?.code ??
              "";
            return (
              <div key={e.id} className="px-3 py-2 flex items-start gap-3 text-xs">
                <Icon className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${color}`} />
                <div className="flex-1 min-w-0">
                  <div className="font-mono">
                    <span className={color}>{e.action}</span>{" "}
                    <span className="text-muted-foreground">·</span> {label}{" "}
                    {name && <span className="text-foreground">{name}</span>}
                  </div>
                  <div className="text-[10px] font-mono text-muted-foreground">
                    {new Date(e.created_at).toLocaleString()}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
