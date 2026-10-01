import { useEffect, useMemo, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import type { Map as LeafletMap, LayerGroup } from "leaflet";
import type { Geometry } from "geojson";
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
  aoi: { label: "AOI proyecto", color: "#22d3ee", icon: MapIcon, group: "context" },
  hotspots_high: {
    label: "Hotspots HIGH (sat)",
    color: "#ef4444",
    icon: Sparkles,
    group: "hotspots",
  },
  hyper_emit: { label: "EMIT (60 m)", color: "#a78bfa", icon: Sparkles, group: "hyper" },
  hyper_aster: { label: "ASTER (30 m)", color: "#f472b6", icon: Sparkles, group: "hyper" },
  insar: { label: "InSAR velocity (mm/a)", color: "#22d3ee", icon: Radar, group: "insar" },
  demdiff: { label: "DEM-diff stockpiles", color: "#34d399", icon: Mountain, group: "dem" },
  targets: { label: "Targets exploración", color: "#f59e0b", icon: TargetIcon, group: "targets" },
};

const CRITICAL_PRIORITIES = new Set(["critical", "Critical", "CRITICAL", "high", "High", "HIGH"]);

// Industrial color ramp for InSAR velocity (mm/year)
function velocityColor(v: number | null): string {
  if (v == null) return "#64748b";
  const a = Math.abs(v);
  if (a >= 25) return "#dc2626"; // red
  if (a >= 15) return "#f59e0b"; // amber
  if (a >= 8) return "#fbbf24"; // yellow
  if (a >= 3) return "#22d3ee"; // cyan
  return "#34d399"; // green
}

function statusColor(s: TargetSatelliteSummary["overallStatus"]): string {
  return s === "alert" ? "#ef4444" : s === "monitor" ? "#f59e0b" : "#34d399";
}

export function SatelliteMapViewer({ projectId, center }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const layerRefs = useRef<Record<LayerKey, LayerGroup>>({} as Record<LayerKey, LayerGroup>);
  const [ready, setReady] = useState(false);
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

  // Init Leaflet map (client only)
  useEffect(() => {
    let cancelled = false;
    if (typeof window === "undefined" || !containerRef.current) return;

    (async () => {
      const L = (await import("leaflet")).default;
      await import("leaflet/dist/leaflet.css");
      if (cancelled || !containerRef.current) return;

      const c = center ?? [-33.84, -71.15];
      const map = L.map(containerRef.current, {
        zoomControl: true,
        attributionControl: false,
      }).setView(c, 12);

      L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        {
          maxZoom: 19,
        },
      ).addTo(map);
      L.tileLayer("https://stamen-tiles.a.ssl.fastly.net/terrain-labels/{z}/{x}/{y}.png", {
        maxZoom: 18,
        opacity: 0.6,
      }).addTo(map);

      mapRef.current = map;

      // Initialize layer groups
      (Object.keys(LAYER_META) as LayerKey[]).forEach((k) => {
        layerRefs.current[k] = L.layerGroup().addTo(map);
      });

      setReady(true);
    })();

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load satellite data
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      const [h, i, s, hs] = await Promise.all([
        supabase
          .from("hyperspectral_products")
          .select("id,source,mineral,assemblage,bbox_geojson,mean_score,max_score,acquisition_date")
          .eq("project_id", projectId),
        supabase
          .from("insar_displacement")
          .select(
            "id,asset_name,asset_type,point_geojson,velocity_mm_year,cumulative_displacement_mm,coherence,alert_severity,end_date",
          )
          .eq("project_id", projectId),
        supabase
          .from("stockpile_volumes")
          .select("id,name,material,polygon_geojson,volume_m3,area_m2,mean_height_m")
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

  // Render layers
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled) return;
      const map = mapRef.current;
      const groups = layerRefs.current;
      Object.values(groups).forEach((g) => g.clearLayers());

      // AOI — derive from union of hyperspectral bboxes (largest)
      if (enabled.aoi && hyperData.length > 0) {
        const biggest = hyperData
          .map((p) => p.bbox_geojson)
          .filter(Boolean)
          .sort((a, b) => bboxArea(b) - bboxArea(a))[0];
        if (biggest) {
          L.geoJSON(biggest, {
            style: {
              color: LAYER_META.aoi.color,
              weight: 2,
              dashArray: "6 4",
              fillOpacity: 0.05,
              fillColor: LAYER_META.aoi.color,
            },
          })
            .bindTooltip("AOI proyecto", { sticky: true })
            .addTo(groups.aoi);
        }
      }

      // Hyperspectral footprints — separate EMIT vs ASTER
      hyperData.forEach((p) => {
        const isEmit = p.source === "EMIT";
        const key: LayerKey = isEmit ? "hyper_emit" : "hyper_aster";
        if (!enabled[key]) return;
        if (!p.bbox_geojson) return;
        L.geoJSON(p.bbox_geojson, {
          style: {
            color: LAYER_META[key].color,
            weight: 1,
            opacity: 0.85,
            fillColor: LAYER_META[key].color,
            fillOpacity: 0.08 + Math.min(0.2, Number(p.mean_score ?? 0) * 0.25),
          },
        })
          .bindPopup(
            `<div style="font-family:ui-monospace,monospace;font-size:11px"><b>${p.source}</b> · ${p.mineral}<br/>Ensamble: ${p.assemblage ?? "—"}<br/>Score med: ${Number(p.mean_score ?? 0).toFixed(2)} · max: ${Number(p.max_score ?? 0).toFixed(2)}<br/>${String(p.acquisition_date ?? "").slice(0, 10)}</div>`,
          )
          .addTo(groups[key]);
      });

      // InSAR points — colored by velocity
      if (enabled.insar) {
        insarData.forEach((p) => {
          const g = p.point_geojson;
          if (g?.type !== "Point") return;
          const [lng, lat] = g.coordinates;
          const v = Number(p.velocity_mm_year);
          const radius = 4 + Math.min(10, Math.abs(v) / 3);
          const color = velocityColor(v);
          L.circleMarker([lat, lng], {
            radius,
            color: "#0b1220",
            weight: 1,
            fillColor: color,
            fillOpacity: 0.85,
          })
            .bindPopup(
              `<div style="font-family:ui-monospace,monospace;font-size:11px"><b>${p.asset_name ?? "InSAR"}</b><br/>v = ${v.toFixed(1)} mm/año<br/>Σ = ${Number(p.cumulative_displacement_mm ?? 0).toFixed(0)} mm<br/>coh = ${Number(p.coherence ?? 0).toFixed(2)}<br/>severidad: <b>${p.alert_severity ?? "—"}</b><br/>${p.end_date ?? ""}</div>`,
            )
            .addTo(groups.insar);
        });
      }

      // DEM-diff stockpiles
      if (enabled.demdiff) {
        stockData.forEach((s) => {
          if (!s.polygon_geojson) return;
          L.geoJSON(s.polygon_geojson, {
            style: {
              color: LAYER_META.demdiff.color,
              weight: 2,
              fillColor: LAYER_META.demdiff.color,
              fillOpacity: 0.35,
            },
          })
            .bindPopup(
              `<div style="font-family:ui-monospace,monospace;font-size:11px"><b>${s.name}</b> · ${s.material ?? "—"}<br/>V = ${Number(s.volume_m3 ?? 0).toLocaleString()} m³<br/>A = ${Number(s.area_m2 ?? 0).toLocaleString()} m²<br/>h̄ = ${Number(s.mean_height_m ?? 0).toFixed(1)} m</div>`,
            )
            .addTo(groups.demdiff);
        });
      }

      // Hotspots HIGH (satellite_anomalies)
      if (enabled.hotspots_high) {
        hotspots.forEach((a) => {
          const g = a.geometry;
          if (!g) return;
          const sev = String(a.severity ?? "").toLowerCase();
          const color = sev === "critical" ? "#dc2626" : "#ef4444";
          const popup = `<div style="font-family:ui-monospace,monospace;font-size:11px"><b>Hotspot ${String(a.severity ?? "").toUpperCase()}</b> · ${a.index_code ?? ""}<br/>Score: ${Number(a.score ?? 0).toFixed(2)} · ${Number(a.area_ha ?? 0).toFixed(1)} ha<br/>${a.notes ?? ""}<br/>${String(a.detected_at ?? "").slice(0, 10)}</div>`;
          if (g.type === "Point") {
            const [lng, lat] = g.coordinates;
            L.circleMarker([lat, lng], {
              radius: 8 + Math.min(8, Number(a.score ?? 0) * 6),
              color: "#0b1220",
              weight: 1.2,
              fillColor: color,
              fillOpacity: 0.85,
            })
              .bindPopup(popup)
              .addTo(groups.hotspots_high);
          } else {
            L.geoJSON(g, {
              style: { color, weight: 1.5, fillColor: color, fillOpacity: 0.4, dashArray: "4 3" },
              pointToLayer: (_f, ll) =>
                L.circleMarker(ll, {
                  radius: 8,
                  color: "#0b1220",
                  weight: 1.2,
                  fillColor: color,
                  fillOpacity: 0.85,
                }),
            })
              .bindPopup(popup)
              .addTo(groups.hotspots_high);
          }
        });
      }

      // Targets
      if (enabled.targets) {
        summaries
          .filter((t) => statusFilter === "all" || t.overallStatus === statusFilter)
          .filter((t) => !criticalOnly || CRITICAL_PRIORITIES.has(String(t.priority ?? "")))
          .forEach((t) => {
            if (t.lat == null || t.lng == null) return;
            const isCritical = CRITICAL_PRIORITIES.has(String(t.priority ?? ""));
            const color = statusColor(t.overallStatus);
            L.circleMarker([t.lat, t.lng], {
              radius: isCritical ? 9 : 6,
              color: isCritical ? "#fde68a" : "#0b1220",
              weight: isCritical ? 2.5 : 1.5,
              fillColor: color,
              fillOpacity: 0.95,
            })
              .bindPopup(
                `<div style="font-family:ui-monospace,monospace;font-size:11px"><b>${t.code}</b> · ${t.name}<br/>${t.targetType} · ${t.commodity ?? ""}<br/>Prioridad: <b>${t.priority ?? "—"}</b> · Estado: <b>${t.overallStatus.toUpperCase()}</b><br/>InSAR: ${t.insar.velocityMmYear != null ? t.insar.velocityMmYear.toFixed(1) + " mm/a" : "—"}<br/>Hiper: ${t.hyperspectral.productCount} prod · max ${t.hyperspectral.maxScore?.toFixed(2) ?? "—"}<br/>DEM-diff: ${t.demDiff.available ? Math.round(t.demDiff.volumeM3 ?? 0) + " m³" : "—"}</div>`,
              )
              .addTo(groups.targets);
          });
      }

      // Fit bounds on first paint with data
      if (hyperData.length > 0 || summaries.length > 0 || hotspots.length > 0) {
        try {
          const bounds = L.latLngBounds([]);
          hyperData.forEach((p) => {
            const bbox = p.bbox_geojson;
            const c =
              bbox && "coordinates" in bbox ? (bbox.coordinates as unknown[])[0] : undefined;
            if (Array.isArray(c)) c.forEach((pt: number[]) => bounds.extend([pt[1], pt[0]]));
          });
          summaries.forEach((t) => {
            if (t.lat != null && t.lng != null) bounds.extend([t.lat, t.lng]);
          });
          hotspots.forEach((a) => {
            const g = a.geometry;
            if (g?.type === "Point") bounds.extend([g.coordinates[1], g.coordinates[0]]);
          });
          if (map && bounds.isValid()) map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
        } catch {
          /* noop */
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    ready,
    enabled,
    statusFilter,
    criticalOnly,
    hyperData,
    insarData,
    stockData,
    hotspots,
    summaries,
  ]);

  function toggle(k: LayerKey) {
    setEnabled((prev) => ({ ...prev, [k]: !prev[k] }));
  }

  return (
    <div className="border border-border/50 rounded-md bg-surface-1/40 backdrop-blur overflow-hidden">
      <header className="flex items-center justify-between gap-3 flex-wrap p-4 border-b border-border/30">
        <div className="flex items-center gap-2">
          <MapIcon className="w-4 h-4 text-signal-cyan" />
          <h2 className="text-sm font-mono uppercase tracking-wider text-foreground">
            Visor Geoespacial
          </h2>
          <span className="text-xs text-text-dim font-mono">
            ({hyperData.length} hiper · {insarData.length} InSAR · {stockData.length} stockpiles ·{" "}
            {summaries.length} targets ·{" "}
            <span className="text-signal-red">{hotspots.length} hotspots HIGH</span>)
          </span>
        </div>
        {loading && <Loader2 className="w-4 h-4 animate-spin text-text-dim" />}
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr]">
        {/* Layer panel */}
        <aside className="border-r border-border/30 bg-surface-2/30 p-3 space-y-3 max-h-[640px] overflow-y-auto">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-text-dim mb-2 flex items-center gap-1">
              <Layers className="w-3 h-3" /> Capas
            </div>
            <div className="space-y-1">
              {(Object.keys(LAYER_META) as LayerKey[]).map((k) => {
                const m = LAYER_META[k];
                const Icon = m.icon;
                return (
                  <label
                    key={k}
                    className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-surface-1/60 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={enabled[k]}
                      onChange={() => toggle(k)}
                      className="w-3 h-3 accent-signal-cyan"
                    />
                    <span
                      className="w-2.5 h-2.5 rounded-sm border border-border/50"
                      style={{ background: m.color }}
                    />
                    <Icon className="w-3 h-3 text-text-dim" />
                    <span className="text-[11px] font-mono text-text-secondary flex-1">
                      {m.label}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-[10px] font-mono uppercase tracking-wider text-text-dim">
                Filtro targets
              </div>
              <button
                onClick={() => setCriticalOnly((v) => !v)}
                className={cn(
                  "text-[9px] font-mono uppercase px-1.5 py-0.5 rounded border transition-colors",
                  criticalOnly
                    ? "border-signal-red/60 bg-signal-red/10 text-signal-red"
                    : "border-border/40 text-text-secondary hover:border-border",
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
                      ? "border-signal-cyan/60 bg-signal-cyan/10 text-signal-cyan"
                      : "border-border/40 text-text-secondary hover:border-border",
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
            <div className="text-[10px] font-mono uppercase tracking-wider text-text-dim mb-2">
              Velocidad InSAR
            </div>
            <div className="space-y-1 text-[10px] font-mono">
              {[
                { c: "#34d399", l: "< 3 mm/año · estable" },
                { c: "#22d3ee", l: "3–8 mm/año" },
                { c: "#fbbf24", l: "8–15 mm/año" },
                { c: "#f59e0b", l: "15–25 mm/año · warning" },
                { c: "#dc2626", l: "≥ 25 mm/año · crítico" },
              ].map((e) => (
                <div key={e.c} className="flex items-center gap-2 text-text-secondary">
                  <span
                    className="w-3 h-3 rounded-full border border-border/50"
                    style={{ background: e.c }}
                  />
                  {e.l}
                </div>
              ))}
            </div>
          </div>

          {/* Legend — Targets */}
          <div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-text-dim mb-2">
              Estado target
            </div>
            <div className="space-y-1 text-[10px] font-mono">
              {[
                { c: "#34d399", l: "Estable" },
                { c: "#f59e0b", l: "Monitorear" },
                { c: "#ef4444", l: "Alerta" },
              ].map((e) => (
                <div key={e.c} className="flex items-center gap-2 text-text-secondary">
                  <span
                    className="w-3 h-3 rounded-full border border-border/50"
                    style={{ background: e.c }}
                  />
                  {e.l}
                </div>
              ))}
            </div>
          </div>
        </aside>

        {/* Map */}
        <div className="relative">
          <div ref={containerRef} className="w-full h-[640px] bg-surface-2" />
          {!ready && (
            <div className="absolute inset-0 flex items-center justify-center text-xs font-mono text-text-dim bg-surface-1/40">
              <Loader2 className="w-4 h-4 animate-spin mr-2" /> Cargando mapa…
            </div>
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
