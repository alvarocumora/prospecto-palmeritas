import React, { useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Layers,
  Loader2,
  MapPin,
  Mountain,
  Radar,
  Search,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import {
  useTargetSatelliteSummaries,
  type TargetSatelliteSummary,
} from "@/hooks/useTargetSatelliteSummaries";
import { cn } from "@/lib/utils";

type Props = { projectId: string };

type StatusFilter = "all" | "alert" | "monitor" | "ok";

const STATUS_STYLES: Record<TargetSatelliteSummary["overallStatus"], string> = {
  ok: "bg-emerald-500/15 text-emerald-400 border-emerald-500/40",
  monitor: "bg-signal-amber/15 text-signal-amber border-signal-amber/40",
  alert: "bg-red-500/15 text-red-400 border-red-500/40",
};

const STATUS_LABEL: Record<TargetSatelliteSummary["overallStatus"], string> = {
  ok: "Estable",
  monitor: "Monitorear",
  alert: "Alerta",
};

const TREND_ICON: Record<NonNullable<TargetSatelliteSummary["insar"]["trend"]>, React.ReactNode> = {
  stable: <Activity className="w-3 h-3" />,
  subsiding: <TrendingDown className="w-3 h-3 text-signal-amber" />,
  uplifting: <TrendingUp className="w-3 h-3 text-signal-cyan" />,
  warning: <AlertTriangle className="w-3 h-3 text-red-400" />,
};

function fmtNum(n: number | null, digits = 1): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toLocaleString("es-CL", { maximumFractionDigits: digits });
}

export function TargetSummariesPanel({ projectId }: Props) {
  const { data, isLoading, isError, refetch, isFetching } = useTargetSatelliteSummaries(projectId);
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const summaries = useMemo(() => data?.summaries ?? [], [data]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return summaries
      .filter((s) => filter === "all" || s.overallStatus === filter)
      .filter(
        (s) =>
          !q ||
          s.code.toLowerCase().includes(q) ||
          s.name.toLowerCase().includes(q) ||
          (s.commodity ?? "").toLowerCase().includes(q),
      )
      .sort((a, b) => {
        const order = { alert: 0, monitor: 1, ok: 2 };
        const so = order[a.overallStatus] - order[b.overallStatus];
        if (so !== 0) return so;
        return (b.score ?? 0) - (a.score ?? 0);
      });
  }, [summaries, filter, search]);

  const counts = useMemo(
    () => ({
      all: summaries.length,
      alert: summaries.filter((s) => s.overallStatus === "alert").length,
      monitor: summaries.filter((s) => s.overallStatus === "monitor").length,
      ok: summaries.filter((s) => s.overallStatus === "ok").length,
    }),
    [summaries],
  );

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="border border-border/50 rounded-md bg-surface-1/40 backdrop-blur">
      <header className="flex items-center justify-between gap-3 flex-wrap p-4 border-b border-border/30">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-signal-cyan" />
          <h2 className="text-sm font-mono uppercase tracking-wider text-foreground">
            Resumen por Target
          </h2>
          <span className="text-xs text-text-dim font-mono">
            ({summaries.length} targets · hyperspectral × InSAR × DEM-diff)
          </span>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="text-xs px-3 py-1.5 rounded border border-signal-cyan/40 text-signal-cyan hover:bg-signal-cyan/10 disabled:opacity-50 font-mono uppercase tracking-wide flex items-center gap-1.5"
        >
          {isFetching ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <Sparkles className="w-3 h-3" />
          )}
          Recalcular
        </button>
      </header>

      <div className="p-4 flex flex-wrap items-center gap-2 border-b border-border/20">
        {(["all", "alert", "monitor", "ok"] as StatusFilter[]).map((k) => (
          <button
            key={k}
            onClick={() => setFilter(k)}
            className={cn(
              "text-xs font-mono uppercase tracking-wide px-2.5 py-1 rounded border transition-colors",
              filter === k
                ? "border-signal-cyan/60 bg-signal-cyan/10 text-signal-cyan"
                : "border-border/40 text-text-secondary hover:border-border",
            )}
          >
            {k === "all" ? "Todos" : STATUS_LABEL[k as TargetSatelliteSummary["overallStatus"]]} ·{" "}
            {counts[k]}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-1.5 border border-border/40 rounded px-2 py-1 bg-surface-2/40">
          <Search className="w-3 h-3 text-text-dim" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar código, nombre o commodity..."
            className="bg-transparent text-xs text-foreground placeholder:text-text-dim outline-none w-56 font-mono"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="p-8 text-sm text-text-dim text-center font-mono flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Calculando resúmenes…
        </div>
      ) : isError ? (
        <div className="p-8 text-sm text-red-400 text-center font-mono">
          Error al calcular resúmenes.
        </div>
      ) : filtered.length === 0 ? (
        <div className="p-8 text-sm text-text-dim text-center font-mono">
          Sin targets para los filtros activos.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 p-4">
          {filtered.map((s) => (
            <TargetCard
              key={s.targetId}
              s={s}
              expanded={expanded.has(s.targetId)}
              onToggle={() => toggle(s.targetId)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TargetCard({
  s,
  expanded,
  onToggle,
}: {
  s: TargetSatelliteSummary;
  expanded: boolean;
  onToggle: () => void;
}) {
  const StatusIcon =
    s.overallStatus === "alert"
      ? AlertTriangle
      : s.overallStatus === "monitor"
        ? Activity
        : CheckCircle2;
  return (
    <div className="border border-border/50 rounded bg-surface-2/40 hover:border-border transition-colors overflow-hidden">
      {/* Header */}
      <div className="p-3 border-b border-border/30 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs text-signal-cyan">{s.code}</span>
            <span
              className={cn(
                "text-[10px] font-mono uppercase px-1.5 py-0.5 rounded border flex items-center gap-1",
                STATUS_STYLES[s.overallStatus],
              )}
            >
              <StatusIcon className="w-2.5 h-2.5" />
              {STATUS_LABEL[s.overallStatus]}
            </span>
          </div>
          <div className="text-sm font-medium text-foreground truncate mt-0.5">{s.name}</div>
          <div className="text-[11px] text-text-dim mt-0.5 font-mono flex items-center gap-2">
            <span>{s.targetType}</span>
            {s.commodity && <span>· {s.commodity}</span>}
            {s.score != null && <span>· score {fmtNum(s.score, 0)}</span>}
            {s.lat != null && s.lng != null && (
              <span className="flex items-center gap-1">
                <MapPin className="w-2.5 h-2.5" /> {fmtNum(s.lat, 4)}, {fmtNum(s.lng, 4)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-3 divide-x divide-border/30">
        {/* Hyperspectral */}
        <div className="p-2.5 space-y-1">
          <div className="flex items-center gap-1 text-[10px] font-mono uppercase text-text-dim">
            <Sparkles className="w-3 h-3 text-violet-400" /> Hiper
          </div>
          <div className="text-xs font-mono text-foreground">
            {s.hyperspectral.productCount} prod
          </div>
          <div className="text-[10px] text-text-secondary font-mono">
            scorē {fmtNum(s.hyperspectral.meanScore, 2)} / max {fmtNum(s.hyperspectral.maxScore, 2)}
          </div>
          <div
            className="text-[10px] text-text-dim truncate"
            title={s.hyperspectral.minerals.join(", ")}
          >
            {s.hyperspectral.minerals.length > 0
              ? s.hyperspectral.minerals.slice(0, 2).join(", ") +
                (s.hyperspectral.minerals.length > 2 ? "…" : "")
              : "—"}
          </div>
        </div>

        {/* InSAR */}
        <div className="p-2.5 space-y-1">
          <div className="flex items-center gap-1 text-[10px] font-mono uppercase text-text-dim">
            <Radar className="w-3 h-3 text-signal-cyan" /> InSAR
          </div>
          <div className="text-xs font-mono text-foreground flex items-center gap-1">
            {s.insar.velocityMmYear != null ? `${fmtNum(s.insar.velocityMmYear, 1)} mm/a` : "—"}
            {s.insar.trend && TREND_ICON[s.insar.trend]}
          </div>
          <div className="text-[10px] text-text-secondary font-mono">
            coh {fmtNum(s.insar.coherence, 2)} · Σ {fmtNum(s.insar.cumulativeMm, 0)} mm
          </div>
          <div
            className={cn(
              "text-[10px] font-mono",
              s.insar.severity === "warning" || s.insar.severity === "critical"
                ? "text-signal-amber"
                : "text-text-dim",
            )}
          >
            {s.insar.severity ? s.insar.severity : "—"}
          </div>
        </div>

        {/* DEM-diff */}
        <div className="p-2.5 space-y-1">
          <div className="flex items-center gap-1 text-[10px] font-mono uppercase text-text-dim">
            <Mountain className="w-3 h-3 text-emerald-400" /> DEM-diff
          </div>
          {s.demDiff.available ? (
            <>
              <div className="text-xs font-mono text-foreground">
                {fmtNum(s.demDiff.volumeM3, 0)} m³
              </div>
              <div className="text-[10px] text-text-secondary font-mono">
                h̄ {fmtNum(s.demDiff.meanHeightM, 1)} m · {fmtNum(s.demDiff.areaM2, 0)} m²
              </div>
              <div
                className="text-[10px] text-text-dim truncate"
                title={s.demDiff.stockpileName ?? ""}
              >
                {s.demDiff.material ?? "—"}
              </div>
            </>
          ) : (
            <div className="text-[10px] text-text-dim font-mono">Sin acopio cercano</div>
          )}
        </div>
      </div>

      {/* Expandable detail */}
      <button
        onClick={onToggle}
        className="w-full px-3 py-1.5 text-[10px] font-mono uppercase tracking-wide text-text-dim hover:text-text-secondary border-t border-border/30 flex items-center justify-center gap-1"
      >
        <ChevronDown className={cn("w-3 h-3 transition-transform", expanded && "rotate-180")} />
        {expanded ? "Ocultar" : "Detalle"}
      </button>
      {expanded && (
        <div className="px-3 py-2.5 border-t border-border/20 bg-surface-1/40 text-[11px] font-mono space-y-1.5 text-text-secondary">
          <div>
            <span className="text-text-dim">Hiperspectral:</span>{" "}
            {s.hyperspectral.coverageOk
              ? `${s.hyperspectral.productCount} productos, ${s.hyperspectral.cellsAboveThreshold} celdas anómalas, área ${fmtNum(s.hyperspectral.areaHa, 1)} ha. Última escena ${s.hyperspectral.latestDate?.slice(0, 10) ?? "—"}.`
              : "Sin cobertura para este target (fuera del bbox)."}
          </div>
          <div>
            <span className="text-text-dim">Minerales:</span>{" "}
            {s.hyperspectral.minerals.length > 0 ? s.hyperspectral.minerals.join(", ") : "—"}
          </div>
          {s.hyperspectral.assemblages.length > 0 && (
            <div>
              <span className="text-text-dim">Ensambles:</span>{" "}
              {s.hyperspectral.assemblages.join(", ")}
            </div>
          )}
          <div>
            <span className="text-text-dim">InSAR:</span>{" "}
            {s.insar.available
              ? `${s.insar.assetType ?? "—"} a ${fmtNum(s.insar.distanceM, 0)} m. v=${fmtNum(s.insar.velocityMmYear, 1)} mm/año, Σ=${fmtNum(s.insar.cumulativeMm, 0)} mm, coh=${fmtNum(s.insar.coherence, 2)}. Cierre ${s.insar.endDate ?? "—"}.`
              : "Sin punto InSAR cercano."}
          </div>
          <div>
            <span className="text-text-dim">DEM-diff:</span>{" "}
            {s.demDiff.available
              ? `${s.demDiff.stockpileName} (${s.demDiff.material}) a ${fmtNum(s.demDiff.distanceM, 0)} m. V=${fmtNum(s.demDiff.volumeM3, 0)} m³, A=${fmtNum(s.demDiff.areaM2, 0)} m², h̄=${fmtNum(s.demDiff.meanHeightM, 1)} m.`
              : "Sin stockpile dentro de 5 km."}
          </div>
        </div>
      )}
    </div>
  );
}
