import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, Play } from "lucide-react";
import { HudPanel } from "@/components/ops/HudPanel";
import { StatusDot } from "@/components/ops/StatusDot";
import {
  useConcessionOverlaps,
  OVERLAP_TYPE_LABELS,
  OVERLAP_SEVERITY_COLORS,
  OVERLAP_SEVERITY_LABELS,
  type ConcessionOverlap,
} from "@/hooks/useConcessionOverlaps";
import { useMiningConcessions } from "@/hooks/useMiningConcessions";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function OverlapInspector({ projectId }: { projectId: string }) {
  const { data, loading, refresh } = useConcessionOverlaps(projectId);
  const { data: concessions } = useMiningConcessions(projectId);
  const [computing, setComputing] = useState(false);

  const concessionMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of concessions) m.set(c.id, `${c.code} — ${c.name}`);
    return m;
  }, [concessions]);

  const stats = useMemo(() => {
    let blocking = 0, warning = 0, info = 0, resolved = 0;
    for (const o of data) {
      if (o.resolved_at) { resolved++; continue; }
      if (o.severity === "blocking") blocking++;
      else if (o.severity === "warning") warning++;
      else info++;
    }
    return { blocking, warning, info, resolved };
  }, [data]);

  const onCompute = async () => {
    setComputing(true);
    try {
      const { data: result, error } = await supabase.functions.invoke("compute-overlaps", {
        body: { projectId },
      });
      if (error) throw error;
      toast.success(`Análisis completo · ${result?.detected ?? 0} sobreposiciones detectadas`);
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al computar sobreposiciones");
    } finally {
      setComputing(false);
    }
  };

  const onResolve = async (o: ConcessionOverlap) => {
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("concession_overlaps")
      .update({ resolved_at: new Date().toISOString(), resolved_by: u.user?.id })
      .eq("id", o.id);
    if (error) toast.error(error.message);
    else { toast.success("Sobreposición resuelta"); refresh(); }
  };

  const active = data.filter((o) => !o.resolved_at);

  return (
    <HudPanel
      title="Sobreposición · Análisis de conflictos"
      accent={stats.blocking > 0 ? "red" : stats.warning > 0 ? "amber" : "cyan"}
      className="bg-bg-panel/40"
    >
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
        <Stat label="Bloqueantes" value={String(stats.blocking)} color={stats.blocking > 0 ? "var(--signal-red)" : undefined} />
        <Stat label="Advertencias" value={String(stats.warning)} color={stats.warning > 0 ? "var(--signal-amber)" : undefined} />
        <Stat label="Informativos" value={String(stats.info)} />
        <Stat label="Resueltos" value={String(stats.resolved)} color="var(--signal-green)" />
      </div>

      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3 text-[10px] font-mono">
          <StatusDot status="crit" label={`${stats.blocking} crit`} />
          <StatusDot status="warn" label={`${stats.warning} warn`} />
          <StatusDot status="ok" label={`${stats.resolved} resueltas`} />
        </div>
        <button
          onClick={onCompute}
          disabled={computing}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[2px] border border-signal-cyan/40 bg-signal-cyan/10 text-signal-cyan text-[10px] font-mono uppercase hover:bg-signal-cyan/20 disabled:opacity-50"
        >
          {computing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
          Computar
        </button>
      </div>

      {loading ? (
        <div className="p-4 text-center text-[11px] font-mono text-text-dim">CARGANDO…</div>
      ) : active.length === 0 ? (
        <div className="p-6 text-center border border-dashed border-border rounded-[2px]">
          <div className="text-[11px] font-mono text-text-dim">
            Sin sobreposiciones activas. {data.length === 0 ? "Ejecuta el análisis para detectar conflictos." : "Todas resueltas."}
          </div>
        </div>
      ) : (
        <div className="border border-border rounded-[2px] divide-y divide-border">
          {active.map((o) => {
            const color = OVERLAP_SEVERITY_COLORS[o.severity];
            return (
              <div key={o.id} className="px-2.5 py-2 hover:bg-accent/30">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[11px] font-mono font-semibold truncate">
                        {concessionMap.get(o.concession_id) ?? o.concession_id.slice(0, 8)}
                      </span>
                      <span
                        className="text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded-sm"
                        style={{ background: `${color}22`, color }}
                      >
                        {OVERLAP_SEVERITY_LABELS[o.severity]}
                      </span>
                    </div>
                    <div className="text-[10px] text-text-dim mt-0.5">
                      {OVERLAP_TYPE_LABELS[o.overlap_type]}
                      {o.overlap_with_name && ` · ${o.overlap_with_name}`}
                      {o.area_overlap_ha != null && ` · ${o.area_overlap_ha.toFixed(1)} ha`}
                      {o.pct_overlap != null && ` (${o.pct_overlap.toFixed(1)}%)`}
                    </div>
                    {o.notes && <div className="text-[10px] text-text-secondary mt-1">{o.notes}</div>}
                  </div>
                  <button
                    onClick={() => onResolve(o)}
                    className="p-1 rounded hover:bg-signal-green/20 text-signal-green shrink-0"
                    title="Marcar resuelto"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </HudPanel>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="border border-border rounded-[2px] p-2 bg-bg-panel/50">
      <div className="text-[9px] font-mono uppercase tracking-wider text-text-dim">{label}</div>
      <div className="text-sm font-mono font-semibold" style={color ? { color } : undefined}>{value}</div>
    </div>
  );
}
