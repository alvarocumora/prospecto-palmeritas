import { ProjectMasterViewer } from "@/components/geo/ProjectMasterViewer";
import { satelliteEvidence } from "@/lib/satellite/evidence";
import { geoColors } from "@/lib/geospatial/visualTokens";
import { useEffect, useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import type { FeatureCollection, Geometry } from "geojson";
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
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type HyperRow = {
  metadata?: unknown;
  id: string;
  source: string | null;
  mineral: string | null;
  assemblage: string | null;
  bbox_geojson: Geometry | null;
  mean_score: number | null;
  max_score: number | null;
  acquisition_date: string | null;
};

type InsarRow = {
  metadata?: unknown;
  id: string;
  asset_name: string | null;
  asset_type: string | null;
  point_geojson: Geometry | null;
  velocity_mm_year: number | null;
  cumulative_displacement_mm: number | null;
  coherence: number | null;
  alert_severity: string | null;
  end_date: string | null;
};

type StockRow = {
  notes?: string | null;
  id: string;
  name: string;
  material: string | null;
  polygon_geojson: Geometry | null;
  volume_m3: number | null;
  area_m2: number | null;
  mean_height_m: number | null;
};

type HotspotRow = {
  id: string;
  index_code: string | null;
  geometry: Geometry | null;
  severity: string | null;
  score: number | null;
  area_ha: number | null;
  detected_at: string | null;
  notes: string | null;
};

type Props = {
  projectId: string;
  center: [number, number] | null; // [lat, lng]
};

type LayerKey =
  "aoi" | "hyper_emit" | "hyper_aster" | "insar" | "demdiff" | "targets" | "hotspots_high";

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

// Industrial color ramp for InSAR velocity (mm/year)
function velocityColor(v: number | null): string {
  if (v == null) return geoColors.declared;
  const a = Math.abs(v);
  if (a >= 25) return geoColors.deposit; // red
  if (a >= 15) return geoColors.tenureOwn; // amber
  if (a >= 8) return geoColors.structure; // yellow
  if (a >= 3) return geoColors.signal; // cyan
  return geoColors.sample; // green
}

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
  const [hyperData, setHyperData] = useState<HyperRow[]>([]);
  const [insarData, setInsarData] = useState<InsarRow[]>([]);
  const [stockData, setStockData] = useState<StockRow[]>([]);
  const [hotspots, setHotspots] = useState<HotspotRow[]>([]);
  const [loading, setLoading] = useState(true);

  const { data: summariesRes } = useTargetSatelliteSummaries(projectId);
  const summaries = useMemo<TargetSatelliteSummary[]>(
    () => summariesRes?.summaries ?? [],
    [summariesRes],
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      const [h, i, s, hs] = await Promise.all([
        supabase
          .from("hyperspectral_products")
          .select(
            "id,source,mineral,assemblage,bbox_geojson,mean_score,max_score,acquisition_date,metadata",
          )
          .eq("project_id", projectId),
        supabase
          .from("insar_displacement")
          .select(
            "id,asset_name,asset_type,point_geojson,velocity_mm_year,cumulative_displacement_mm,coherence,alert_severity,end_date,metadata",
          )
          .eq("project_id", projectId),
        supabase
          .from("stockpile_volumes")
          .select("id,name,material,polygon_geojson,volume_m3,area_m2,mean_height_m,notes")
          .eq("project_id", projectId),
        supabase
          .from("satellite_anomalies")
          .select("id,index_code,geometry,severity,score,area_ha,detected_at,notes")
          .eq("project_id", projectId)
          .in("severity", ["high", "HIGH", "High", "critical", "Critical", "CRITICAL"]),
      ]);
      if (cancelled) return;
      setHyperData((h.data ?? []) as unknown as HyperRow[]);
      setInsarData((i.data ?? []) as unknown as InsarRow[]);
      setStockData((s.data ?? []) as unknown as StockRow[]);
      setHotspots((hs.data ?? []) as unknown as HotspotRow[]);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const contextLayers = useMemo(() => {
    const result: Array<{
      id: string;
      label: string;
      evidence: string;
      evidenceForFeature?: (properties: Record<string, unknown>) => string;
      features: FeatureCollection;
      color?: string | ((properties: Record<string, unknown>) => string);
    }> = [];
    const add = (
      key: LayerKey,
      features: FeatureCollection["features"],
      color?: string | ((properties: Record<string, unknown>) => string),
    ) => {
      if (enabled[key])
        result.push({
          id: key,
          label: LAYER_META[key].label,
          evidence: key === "targets" ? "DECLARADO" : "DERIVADO",
          evidenceForFeature: (properties) =>
            satelliteEvidence(
              properties.metadata,
              typeof properties.notes === "string" ? properties.notes : null,
            ),
          features: { type: "FeatureCollection", features },
          color: color ?? LAYER_META[key].color,
        });
    };
    const footprint = hyperData
      .map((p) => p.bbox_geojson)
      .filter((g): g is Geometry => !!g)
      .sort((a, b) => bboxArea(b) - bboxArea(a))[0];
    add(
      "aoi",
      footprint
        ? [
            {
              type: "Feature",
              geometry: footprint,
              properties: { source: "Mayor huella hiperespectral; no delimita tenencia" },
            },
          ]
        : [],
    );
    for (const [key, source] of [
      ["hyper_emit", "EMIT"],
      ["hyper_aster", "ASTER"],
    ] as const)
      add(
        key,
        hyperData
          .filter((p) => (source === "EMIT" ? p.source === "EMIT" : p.source !== "EMIT"))
          .flatMap((p) =>
            p.bbox_geojson
              ? [{ type: "Feature", id: p.id, geometry: p.bbox_geojson, properties: { ...p } }]
              : [],
          ),
      );
    add(
      "insar",
      insarData.flatMap((p) =>
        p.point_geojson
          ? [{ type: "Feature", id: p.id, geometry: p.point_geojson, properties: { ...p } }]
          : [],
      ),
      (p) => velocityColor(typeof p.velocity_mm_year === "number" ? p.velocity_mm_year : null),
    );
    add(
      "demdiff",
      stockData.flatMap((p) =>
        p.polygon_geojson
          ? [{ type: "Feature", id: p.id, geometry: p.polygon_geojson, properties: { ...p } }]
          : [],
      ),
    );
    add(
      "hotspots_high",
      hotspots.flatMap((p) =>
        p.geometry
          ? [{ type: "Feature", id: p.id, geometry: p.geometry, properties: { ...p } }]
          : [],
      ),
    );
    add(
      "targets",
      summaries
        .filter((t) => statusFilter === "all" || t.overallStatus === statusFilter)
        .filter((t) => !criticalOnly || CRITICAL_PRIORITIES.has(String(t.priority ?? "")))
        .flatMap((t) =>
          t.lng == null || t.lat == null
            ? []
            : [
                {
                  type: "Feature",
                  geometry: { type: "Point", coordinates: [t.lng, t.lat] },
                  properties: {
                    ...t,
                    insar_velocity_mm_year: t.insar.velocityMmYear,
                    hyperspectral_max_score: t.hyperspectral.maxScore,
                    dem_diff_volume_m3: t.demDiff.volumeM3,
                  },
                },
              ],
        ),
      (p) => statusColor(p.overallStatus as TargetSatelliteSummary["overallStatus"]),
    );
    return result;
  }, [enabled, hyperData, insarData, stockData, hotspots, summaries, statusFilter, criticalOnly]);

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
            ({hyperData.length} hiper · {insarData.length} InSAR · {stockData.length} stockpiles ·{" "}
            {summaries.length} targets ·{" "}
            <span className="text-brand-danger">{hotspots.length} hotspots HIGH</span>)
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

function bboxArea(g: Geometry | null | undefined): number {
  try {
    const c = g && "coordinates" in g ? (g.coordinates as unknown[])[0] : undefined;
    if (!Array.isArray(c)) return 0;
    const xs = c.map((p: number[]) => p[0]);
    const ys = c.map((p: number[]) => p[1]);
    return (Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys));
  } catch {
    return 0;
  }
}
