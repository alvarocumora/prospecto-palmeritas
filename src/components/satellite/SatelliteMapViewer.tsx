import { ProjectMasterViewer } from "@/components/geo/ProjectMasterViewer";
import { satelliteEvidence } from "@/lib/satellite/evidence";
import { geoColors } from "@/lib/geospatial/visualTokens";
import { useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import type { FeatureCollection } from "geojson";
import {
  Layers,
  Loader2,
  Map as MapIcon,
  Mountain,
  Radar,
  Sparkles,
  Target as TargetIcon,
} from "lucide-react";
import {
  useTargetSatelliteSummaries,
  type TargetSatelliteSummary,
} from "@/hooks/useTargetSatelliteSummaries";
import {
  useSatelliteContextLayers,
  type SatelliteLayerKey,
} from "@/hooks/useSatelliteContextLayers";
import { cn } from "@/lib/utils";

type Props = {
  projectId: string;
  center: [number, number] | null; // [lat, lng]
};

type LayerKey = SatelliteLayerKey | "targets";

const LAYER_META: Record<
  LayerKey,
  {
    label: string;
    color: string;
    icon: LucideIcon;
    group: "context" | "hyper" | "insar" | "dem" | "targets" | "hotspots";
  }
> = {
  aoi: { label: "AOI proyecto", color: geoColors.signal, icon: MapIcon, group: "context" },
  hotspots_high: {
    label: "Hotspots HIGH (sat)",
    color: geoColors.neighbourDeposit,
    icon: Sparkles,
    group: "hotspots",
  },
  hyper_emit: {
    label: "EMIT (60 m)",
    color: geoColors.pendingEvidence,
    icon: Sparkles,
    group: "hyper",
  },
  hyper_aster: {
    label: "ASTER (30 m)",
    color: geoColors.hydrothermal,
    icon: Sparkles,
    group: "hyper",
  },
  insar: { label: "InSAR velocity (mm/a)", color: geoColors.signal, icon: Radar, group: "insar" },
  demdiff: { label: "DEM-diff stockpiles", color: geoColors.sample, icon: Mountain, group: "dem" },
  targets: {
    label: "Targets exploración",
    color: geoColors.tenureOwn,
    icon: TargetIcon,
    group: "targets",
  },
};

const CRITICAL_PRIORITIES = new Set(["critical", "Critical", "CRITICAL", "high", "High", "HIGH"]);

function statusColor(s: TargetSatelliteSummary["overallStatus"]): string {
  return s === "alert"
    ? geoColors.neighbourDeposit
    : s === "monitor"
      ? geoColors.tenureOwn
      : geoColors.sample;
}

export function SatelliteMapViewer({ projectId, center }: Props) {
  const [enabled, setEnabled] = useState<Record<LayerKey, boolean>>({
    aoi: true,
    hyper_emit: true,
    hyper_aster: true,
    insar: true,
    demdiff: true,
    targets: true,
    hotspots_high: true,
  });
  const [statusFilter, setStatusFilter] = useState<"all" | "alert" | "monitor" | "ok">("all");
  const [criticalOnly, setCriticalOnly] = useState(false);

  const { data: summariesRes } = useTargetSatelliteSummaries(projectId);
  const summaries = useMemo<TargetSatelliteSummary[]>(
    () => summariesRes?.summaries ?? [],
    [summariesRes],
  );

  const { layers: satelliteLayers, loading, counts } = useSatelliteContextLayers(projectId);

  const contextLayers = useMemo(() => {
    const result: Array<{
      id: string;
      label: string;
      evidence: string;
      evidenceForFeature?: (properties: Record<string, unknown>) => string;
      features: FeatureCollection;
      color?: string | ((properties: Record<string, unknown>) => string);
    }> = [];
    for (const layer of satelliteLayers) if (enabled[layer.id]) result.push(layer);
    if (enabled.targets)
      result.push({
        id: "targets",
        label: LAYER_META.targets.label,
        evidence: "DECLARADO",
        evidenceForFeature: (properties) =>
          satelliteEvidence(
            properties.metadata,
            typeof properties.notes === "string" ? properties.notes : null,
          ),
        features: {
          type: "FeatureCollection",
          features: summaries
            .filter((t) => statusFilter === "all" || t.overallStatus === statusFilter)
            .filter((t) => !criticalOnly || CRITICAL_PRIORITIES.has(String(t.priority ?? "")))
            .flatMap((t) =>
              t.lng == null || t.lat == null
                ? []
                : [
                    {
                      type: "Feature" as const,
                      geometry: { type: "Point" as const, coordinates: [t.lng, t.lat] },
                      properties: {
                        ...t,
                        insar_velocity_mm_year: t.insar.velocityMmYear,
                        hyperspectral_max_score: t.hyperspectral.maxScore,
                        dem_diff_volume_m3: t.demDiff.volumeM3,
                      },
                    },
                  ],
            ),
        },
        color: (p) => statusColor(p.overallStatus as TargetSatelliteSummary["overallStatus"]),
      });
    return result;
  }, [enabled, satelliteLayers, summaries, statusFilter, criticalOnly]);

  function toggle(k: LayerKey) {
    setEnabled((prev) => ({ ...prev, [k]: !prev[k] }));
  }

  return (
    <div className="border border-hairline/50 rounded-md bg-surface/40 backdrop-blur overflow-hidden">
      <header className="flex items-center justify-between gap-3 flex-wrap p-4 border-b border-hairline/30">
        <div className="flex items-center gap-2">
          <MapIcon className="w-4 h-4 text-accent-brand" />
          <h2 className="text-sm font-mono uppercase tracking-wider text-content">
            Visor Geoespacial
          </h2>
          <span className="text-xs text-content-subtle font-mono">
            ({counts.hyper} hiper · {counts.insar} InSAR · {counts.stock} stockpiles ·{" "}
            {summaries.length} targets ·{" "}
            <span className="text-brand-danger">{counts.hotspots} hotspots HIGH</span>)
          </span>
        </div>
        {loading && <Loader2 className="w-4 h-4 animate-spin text-content-subtle" />}
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr]">
        {/* Layer panel */}
        <aside className="border-r border-hairline/30 bg-surface-2/30 p-3 space-y-3 max-h-[640px] overflow-y-auto">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-content-subtle mb-2 flex items-center gap-1">
              <Layers className="w-3 h-3" /> Capas
            </div>
            <div className="space-y-1">
              {(Object.keys(LAYER_META) as LayerKey[]).map((k) => {
                const m = LAYER_META[k];
                const Icon = m.icon;
                return (
                  <label
                    key={k}
                    className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-surface/60 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={enabled[k]}
                      onChange={() => toggle(k)}
                      className="w-3 h-3 accent-accent-brand"
                    />
                    <span
                      className="w-2.5 h-2.5 rounded-sm border border-hairline/50"
                      style={{ background: m.color }}
                    />
                    <Icon className="w-3 h-3 text-content-subtle" />
                    <span className="text-[11px] font-mono text-content-muted flex-1">
                      {m.label}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-[10px] font-mono uppercase tracking-wider text-content-subtle">
                Filtro targets
              </div>
              <button
                onClick={() => setCriticalOnly((v) => !v)}
                className={cn(
                  "text-[9px] font-mono uppercase px-1.5 py-0.5 rounded border transition-colors",
                  criticalOnly
                    ? "border-signal-red/60 bg-signal-red/10 text-brand-danger"
                    : "border-hairline/40 text-content-muted hover:border-hairline",
                )}
                title="Solo targets críticos / high priority"
              >
                ★ Críticos
              </button>
            </div>
            <div className="grid grid-cols-2 gap-1">
              {(["all", "alert", "monitor", "ok"] as const).map((k) => (
                <button
                  key={k}
                  onClick={() => setStatusFilter(k)}
                  className={cn(
                    "text-[10px] font-mono uppercase px-2 py-1 rounded border transition-colors",
                    statusFilter === k
                      ? "border-signal-cyan/60 bg-signal-cyan/10 text-accent-brand"
                      : "border-hairline/40 text-content-muted hover:border-hairline",
                  )}
                >
                  {k === "all"
                    ? "Todos"
                    : k === "alert"
                      ? "Alerta"
                      : k === "monitor"
                        ? "Monitor"
                        : "OK"}
                </button>
              ))}
            </div>
          </div>

          {/* Legend — InSAR velocity ramp */}
          <div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-content-subtle mb-2">
              Velocidad InSAR
            </div>
            <div className="space-y-1 text-[10px] font-mono">
              {[
                { c: geoColors.sample, l: "< 3 mm/año · estable" },
                { c: geoColors.signal, l: "3–8 mm/año" },
                { c: geoColors.structure, l: "8–15 mm/año" },
                { c: geoColors.tenureOwn, l: "15–25 mm/año · warning" },
                { c: geoColors.deposit, l: "≥ 25 mm/año · crítico" },
              ].map((e) => (
                <div key={e.c} className="flex items-center gap-2 text-content-muted">
                  <span
                    className="w-3 h-3 rounded-full border border-hairline/50"
                    style={{ background: e.c }}
                  />
                  {e.l}
                </div>
              ))}
            </div>
          </div>

          {/* Legend — Targets */}
          <div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-content-subtle mb-2">
              Estado target
            </div>
            <div className="space-y-1 text-[10px] font-mono">
              {[
                { c: geoColors.sample, l: "Estable" },
                { c: geoColors.tenureOwn, l: "Monitorear" },
                { c: geoColors.neighbourDeposit, l: "Alerta" },
              ].map((e) => (
                <div key={e.c} className="flex items-center gap-2 text-content-muted">
                  <span
                    className="w-3 h-3 rounded-full border border-hairline/50"
                    style={{ background: e.c }}
                  />
                  {e.l}
                </div>
              ))}
            </div>
          </div>
        </aside>

        <div className="min-w-0">
          {center ? (
            <ProjectMasterViewer
              projectName="Inteligencia satelital"
              center={{ lat: center[0], lng: center[1] }}
              contextLayers={contextLayers}
              enableLayerTools
              height={640}
            />
          ) : (
            <p className="p-4 text-content-subtle">
              Faltan coordenadas del proyecto para encuadrar sus productos.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
