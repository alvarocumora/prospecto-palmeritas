import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, Play, RotateCcw, Filter } from "lucide-react";
import { HudPanel } from "@/components/ops/HudPanel";
import { StatusDot } from "@/components/ops/StatusDot";
import {
  useConcessionOverlaps,
  OVERLAP_TYPE_LABELS,
  OVERLAP_SEVERITY_COLORS,
  OVERLAP_SEVERITY_LABELS,
  type ConcessionOverlap,
  type OverlapSeverity,
} from "@/hooks/useConcessionOverlaps";
import { useMiningConcessions } from "@/hooks/useMiningConcessions";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type StatusFilter = "active" | "resolved" | "all";
type SeverityFilter = OverlapSeverity | "all";

const SEVERITY_RANK: Record<OverlapSeverity, number> = { blocking: 3, warning: 2, info: 1 };

function timeAgo(iso: string | null): string {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return "hace instantes";
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  return `hace ${d} d`;
}

export function OverlapInspector({ projectId }: { projectId: string }) {
  const { data, loading, refresh } = useConcessionOverlaps(projectId);
  const { data: concessions } = useMiningConcessions(projectId);
  const [computing, setComputing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all");

  // Auto-refresh after a sync from the page header (which chains compute-overlaps)
  useEffect(() => {
    const onSynced = (e: Event) => {
      const detail = (e as CustomEvent<{ projectId: string }>).detail;
      if (detail?.projectId === projectId) refresh();
    };
    window.addEventListener("catastro:synced", onSynced);
    return () => window.removeEventListener("catastro:synced", onSynced);
  }, [projectId, refresh]);

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

  const lastDetectedAt = useMemo(() => {
    if (data.length === 0) return null;
    return data.reduce<string | null>((max, o) => {
      if (!max || o.detected_at > max) return o.detected_at;
      return max;
    }, null);
  }, [data]);

  const visible = useMemo(() => {
    return data
      .filter((o) => {
        if (statusFilter === "active" && o.resolved_at) return false;
        if (statusFilter === "resolved" && !o.resolved_at) return false;
        if (severityFilter !== "all" && o.severity !== severityFilter) return false;
        return true;
      })
      .sort((a, b) => {
        // Active first, then by severity desc, then by detected_at desc
        const ar = a.resolved_at ? 1 : 0;
        const br = b.resolved_at ? 1 : 0;
        if (ar !== br) return ar - br;
        const sd = SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity];
        if (sd !== 0) return sd;
        return b.detected_at.localeCompare(a.detected_at);
      });
  }, [data, statusFilter, severityFilter]);

  const onCompute = async () => {
    setComputing(true);
    const t = toast.loading("Analizando sobreposiciones…");
    try {
      const { data: result, error } = await supabase.functions.invoke("compute-overlaps", {
        body: { projectId },
      });
      if (error) throw error;
      toast.success(
        `Análisis completo · ${result?.scanned ?? 0} concesiones · ${result?.detected ?? 0} sobreposiciones detectadas`,
        { id: t }
      );
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al computar sobreposiciones", { id: t });
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
    else { toast.success("Sobreposición marcada como resuelta"); refresh(); }
  };

  const onReopen = async (o: ConcessionOverlap) => {
    const { error } = await supabase
      .from("concession_overlaps")
      .update({ resolved_at: null, resolved_by: null })
      .eq("id", o.id);
    if (error) toast.error(error.message);
    else { toast.success("Sobreposición reabierta"); refresh(); }
  };

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

      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-3 text-[10px] font-mono">
          <StatusDot status="crit" label={`${stats.blocking} crit`} />
          <StatusDot status="warn" label={`${stats.warning} warn`} />
          <StatusDot status="ok" label={`${stats.resolved} resueltas`} />
          <span className="text-text-dim">· último análisis {timeAgo(lastDetectedAt)}</span>
        </div>
        <button
          onClick={onCompute}
          disabled={computing}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[2px] border border-signal-cyan/40 bg-signal-cyan/10 text-signal-cyan text-[10px] font-mono uppercase hover:bg-signal-cyan/20 disabled:opacity-50"
          title="Recalcula sobreposiciones contra el catastro nacional de SERNAGEOMIN"
        >
          {computing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
          Recomputar
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-3 pb-2 border-b border-border">
        <Filter className="w-3 h-3 text-text-dim" />
        <FilterChips
          options={[
            { value: "active", label: `Activas (${stats.blocking + stats.warning + stats.info})` },
            { value: "resolved", label: `Resueltas (${stats.resolved})` },
            { value: "all", label: `Todas (${data.length})` },
          ]}
          value={statusFilter}
          onChange={(v) => setStatusFilter(v as StatusFilter)}
        />
        <span className="text-text-dim">·</span>
        <FilterChips
          options={[
            { value: "all", label: "Toda severidad" },
            { value: "blocking", label: "Bloq." },
            { value: "warning", label: "Adv." },
            { value: "info", label: "Info" },
          ]}
          value={severityFilter}
          onChange={(v) => setSeverityFilter(v as SeverityFilter)}
        />
      </div>

      {loading ? (
        <div className="p-4 text-center text-[11px] font-mono text-text-dim">CARGANDO…</div>
      ) : visible.length === 0 ? (
        <div className="p-6 text-center border border-dashed border-border rounded-[2px]">
          <div className="text-[11px] font-mono text-text-dim">
            {data.length === 0
              ? "Sin análisis previo. Ejecuta «Recomputar» o «Sincronizar con SERNAGEOMIN» para detectar conflictos."
              : "Sin resultados con los filtros actuales."}
          </div>
        </div>
      ) : (
        <div className="border border-border rounded-[2px] divide-y divide-border max-h-[520px] overflow-y-auto">
          {visible.map((o) => {
            const color = OVERLAP_SEVERITY_COLORS[o.severity];
            const isResolved = !!o.resolved_at;
            return (
              <div key={o.id} className={`px-2.5 py-2 hover:bg-accent/30 ${isResolved ? "opacity-60" : ""}`}>
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
                      <span
                        className={`text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded-sm border ${
                          isResolved
                            ? "border-signal-green/40 text-signal-green bg-signal-green/10"
                            : "border-signal-amber/40 text-signal-amber bg-signal-amber/10"
                        }`}
                      >
                        {isResolved ? "Resuelta" : "Activa"}
                      </span>
                    </div>
                    <div className="text-[10px] text-text-dim mt-0.5">
                      {OVERLAP_TYPE_LABELS[o.overlap_type]}
                      {o.overlap_with_name && ` · ${o.overlap_with_name}`}
                      {o.area_overlap_ha != null && ` · ${o.area_overlap_ha.toFixed(1)} ha`}
                      {o.pct_overlap != null && ` (${o.pct_overlap.toFixed(1)}%)`}
                      {` · detectada ${timeAgo(o.detected_at)}`}
                      {isResolved && o.resolved_at && ` · resuelta ${timeAgo(o.resolved_at)}`}
                    </div>
                    {o.notes && <div className="text-[10px] text-text-secondary mt-1">{o.notes}</div>}
                  </div>
                  {isResolved ? (
                    <button
                      onClick={() => onReopen(o)}
                      className="p-1 rounded hover:bg-signal-amber/20 text-signal-amber shrink-0"
                      title="Reabrir conflicto"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <button
                      onClick={() => onResolve(o)}
                      className="p-1 rounded hover:bg-signal-green/20 text-signal-green shrink-0"
                      title="Marcar como resuelta"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    </button>
                  )}
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

function FilterChips({
  options,
  value,
  onChange,
}: {
  options: Array<{ value: string; label: string }>;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="inline-flex gap-1">
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`px-2 py-0.5 rounded-[2px] text-[10px] font-mono uppercase tracking-wider border transition-colors ${
              active
                ? "border-signal-cyan/60 bg-signal-cyan/15 text-signal-cyan"
                : "border-border text-text-dim hover:text-foreground hover:border-text-dim"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
