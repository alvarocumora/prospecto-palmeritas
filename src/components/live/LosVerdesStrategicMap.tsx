import { useEffect, useMemo, useRef, useState } from "react";
import maplibregl, {
  Map as MLMap,
  type MapGeoJSONFeature,
  type LngLatLike,
  type StyleSpecification,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import {
  Loader2,
  Satellite,
  Target,
  Layers as LayersIcon,
  MapPin,
  Sparkles,
  ShieldCheck,
  TestTube2,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { getLosVerdesMapData } from "@/lib/losverdes-map.functions";

type LayerKey = "concessions" | "targets" | "sat" | "mag" | "samples";

const BASEMAPS = {
  satellite: {
    label: "Satélite",
    style: {
      version: 8 as const,
      sources: {
        esri: {
          type: "raster" as const,
          tiles: [
            "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
          ],
          tileSize: 256,
          attribution: "Esri World Imagery",
        },
      },
      layers: [{ id: "esri", type: "raster" as const, source: "esri" }],
    },
  },
  topo: {
    label: "Topo",
    style: {
      version: 8 as const,
      sources: {
        otm: {
          type: "raster" as const,
          tiles: ["https://a.tile.opentopomap.org/{z}/{x}/{y}.png"],
          tileSize: 256,
          attribution: "© OpenTopoMap (CC-BY-SA)",
        },
      },
      layers: [{ id: "otm", type: "raster" as const, source: "otm" }],
    },
  },
  osm: {
    label: "Calles",
    style: {
      version: 8 as const,
      sources: {
        osm: {
          type: "raster" as const,
          tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
          tileSize: 256,
          attribution: "© OpenStreetMap",
        },
      },
      layers: [{ id: "osm", type: "raster" as const, source: "osm" }],
    },
  },
};

type BasemapKey = keyof typeof BASEMAPS;

const PRIORITY_COLOR: Record<string, string> = {
  critical: "#ef4444",
  high: "#f59e0b",
  medium: "#3b82f6",
  low: "#94a3b8",
};
const SEVERITY_COLOR: Record<string, string> = {
  high: "#ef4444",
  medium: "#f59e0b",
  low: "#94a3b8",
};

function fmt(n: number | string | boolean | null | undefined, d = 1) {
  if (n == null) return "—";
  return Number(n).toFixed(d);
}

type FeatureProps = Record<string, string | number | boolean | null>;

type SelectedFeature = {
  layer: string;
  props: FeatureProps;
  lngLat: [number, number];
};

export function LosVerdesStrategicMap({ height = 640 }: { height?: number }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const [basemap, setBasemap] = useState<BasemapKey>("satellite");
  const [visible, setVisible] = useState<Record<LayerKey, boolean>>({
    concessions: true,
    targets: true,
    sat: false,
    mag: false,
    samples: true,
  });
  const [certificationMode, setCertificationMode] = useState(false);
  const [layersOpen, setLayersOpen] = useState(false);
  const [selected, setSelected] = useState<SelectedFeature | null>(null);
  const [mapReady, setMapReady] = useState(false);

  const fetchData = useServerFn(getLosVerdesMapData);
  const dataQ = useQuery({
    queryKey: ["losverdes-map-data"],
    queryFn: () => fetchData(),
    staleTime: 5 * 60 * 1000,
  });

  // Init map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: BASEMAPS[basemap].style as StyleSpecification,
      center: [-71.05, -31.95],
      zoom: 11,
      attributionControl: { compact: true },
    });
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: false }), "top-right");
    map.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-left");
    map.addControl(new maplibregl.FullscreenControl(), "top-right");

    map.on("load", () => {
      setMapReady(true);
    });

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Switch basemap
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    setMapReady(false);
    map.setStyle(BASEMAPS[basemap].style as StyleSpecification);
    const onLoad = () => setMapReady(true);
    map.once("styledata", onLoad);
  }, [basemap]);

  // Add data sources + layers
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !dataQ.data) return;
    const d = dataQ.data;

    const addOrUpdate = (id: string, data: unknown) => {
      const geojson = data as GeoJSON.FeatureCollection;
      const src = map.getSource(id) as maplibregl.GeoJSONSource | undefined;
      if (src) src.setData(geojson);
      else map.addSource(id, { type: "geojson", data: geojson });
    };

    const drawableConcessions = {
      ...d.concessions,
      features: d.concessions.features.filter((f) => f.geometry != null),
    };
    addOrUpdate("src-concessions", drawableConcessions);
    addOrUpdate("src-targets", d.targets);
    addOrUpdate("src-sat", d.satAnomalies);
    addOrUpdate("src-mag", d.magAnomalies);
    addOrUpdate("src-samples", d.samples);

    // Concession polygons (fill + outline)
    if (!map.getLayer("lyr-concessions-fill")) {
      map.addLayer({
        id: "lyr-concessions-fill",
        type: "fill",
        source: "src-concessions",
        paint: {
          "fill-color": [
            "match",
            ["coalesce", ["get", "concession_type"], "explotacion"],
            "exploracion",
            "#3b82f6",
            "explotacion",
            "#f59e0b",
            "#94a3b8",
          ],
          "fill-opacity": 0.22,
        },
      });
      map.addLayer({
        id: "lyr-concessions-line",
        type: "line",
        source: "src-concessions",
        paint: { "line-color": "#f0c96b", "line-width": 1.4 },
      });
      map.addLayer({
        id: "lyr-concessions-label",
        type: "symbol",
        source: "src-concessions",
        layout: {
          "text-field": ["coalesce", ["get", "code"], ["get", "name"]],
          "text-size": 10,
          "text-anchor": "center",
        },
        paint: {
          "text-color": "#fef3c7",
          "text-halo-color": "#0b0a09",
          "text-halo-width": 1.2,
        },
      });
    }

    // Targets (circles)
    if (!map.getLayer("lyr-targets")) {
      map.addLayer({
        id: "lyr-targets",
        type: "circle",
        source: "src-targets",
        paint: {
          "circle-color": [
            "match",
            ["coalesce", ["get", "priority"], "low"],
            "critical",
            PRIORITY_COLOR.critical,
            "high",
            PRIORITY_COLOR.high,
            "medium",
            PRIORITY_COLOR.medium,
            PRIORITY_COLOR.low,
          ],
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["coalesce", ["get", "score"], 0],
            0,
            4,
            100,
            12,
          ],
          "circle-stroke-color": "#0b0a09",
          "circle-stroke-width": 1.2,
          "circle-opacity": 0.85,
        },
      });
    }

    // Sat anomalies
    if (!map.getLayer("lyr-sat")) {
      map.addLayer({
        id: "lyr-sat",
        type: "circle",
        source: "src-sat",
        paint: {
          "circle-color": [
            "match",
            ["coalesce", ["get", "severity"], "low"],
            "high",
            SEVERITY_COLOR.high,
            "medium",
            SEVERITY_COLOR.medium,
            SEVERITY_COLOR.low,
          ],
          "circle-radius": 7,
          "circle-stroke-color": "#fef3c7",
          "circle-stroke-width": 1.5,
          "circle-opacity": 0.75,
        },
      });
    }

    // Mag anomalies (heat-ish via circle blur)
    if (!map.getLayer("lyr-mag")) {
      map.addLayer({
        id: "lyr-mag",
        type: "circle",
        source: "src-mag",
        paint: {
          "circle-color": "#a855f7",
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["coalesce", ["get", "rank"], 1],
            1,
            10,
            10,
            22,
          ],
          "circle-blur": 0.6,
          "circle-opacity": 0.5,
        },
      });
    }

    if (!map.getLayer("lyr-samples")) {
      map.addLayer({
        id: "lyr-samples",
        type: "circle",
        source: "src-samples",
        paint: {
          "circle-color": [
            "step",
            ["coalesce", ["get", "cu_pct"], 0],
            "#38bdf8",
            0.5,
            "#facc15",
            1,
            "#fb923c",
            3,
            "#ef4444",
          ],
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["coalesce", ["get", "cu_pct"], 0],
            0,
            3,
            5,
            8,
          ],
          "circle-stroke-color": "#fff7ed",
          "circle-stroke-width": 1,
          "circle-opacity": 0.9,
        },
      });
    }

    // Click handler
    const clickLayers = [
      "lyr-samples",
      "lyr-targets",
      "lyr-sat",
      "lyr-mag",
      "lyr-concessions-fill",
    ];
    const onClick = (e: maplibregl.MapMouseEvent) => {
      const feats = map.queryRenderedFeatures(e.point, { layers: clickLayers });
      if (!feats.length) return;
      const f = feats[0] as MapGeoJSONFeature;
      const props = f.properties as FeatureProps;
      setSelected({
        layer: (props.layer as string) ?? "feature",
        props,
        lngLat: [e.lngLat.lng, e.lngLat.lat],
      });
    };
    for (const id of clickLayers) {
      map.on("click", id, onClick);
      map.on("mouseenter", id, () => (map.getCanvas().style.cursor = "pointer"));
      map.on("mouseleave", id, () => (map.getCanvas().style.cursor = ""));
    }

    // Fit bbox first time
    if (d.bbox) {
      map.fitBounds(
        [
          [d.bbox[0], d.bbox[1]],
          [d.bbox[2], d.bbox[3]],
        ] as [LngLatLike, LngLatLike],
        { padding: 60, animate: false, maxZoom: 13 },
      );
    }

    return () => {
      for (const id of clickLayers) map.off("click", id, onClick);
    };
  }, [mapReady, dataQ.data, basemap]);

  // Toggle layer visibility
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const toggle = (layerId: string, on: boolean) => {
      if (map.getLayer(layerId))
        map.setLayoutProperty(layerId, "visibility", on ? "visible" : "none");
    };
    toggle("lyr-concessions-fill", visible.concessions);
    toggle("lyr-concessions-line", visible.concessions);
    toggle("lyr-concessions-label", visible.concessions);
    toggle("lyr-targets", visible.targets);
    toggle("lyr-sat", visible.sat);
    toggle("lyr-mag", visible.mag);
    toggle("lyr-samples", visible.samples);
  }, [visible, mapReady, dataQ.data]);

  // Certification mode: filter targets by confidence_pct >= 60
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    if (!map.getLayer("lyr-targets")) return;
    if (certificationMode) {
      map.setFilter("lyr-targets", [">=", ["coalesce", ["get", "confidence_pct"], 0], 60]);
    } else {
      map.setFilter("lyr-targets", null);
    }
  }, [certificationMode, mapReady, dataQ.data]);

  const counts = dataQ.data?.counts;
  const concessionsWithoutGeometry =
    dataQ.data?.concessions.features.filter((f) => !f.geometry) ?? [];

  const certifReady = useMemo(() => {
    if (!dataQ.data) return { total: 0, ok: 0, gap: 0 };
    const feats = dataQ.data.targets.features;
    let ok = 0;
    for (const f of feats) {
      const c = (f.properties as FeatureProps).confidence_pct ?? 0;
      if (Number(c) >= 60) ok++;
    }
    return { total: feats.length, ok, gap: feats.length - ok };
  }, [dataQ.data]);

  return (
    <div className="relative w-full rounded-lg overflow-hidden border border-border bg-bg-secondary">
      <div ref={containerRef} style={{ width: "100%", height }} />

      {/* Loading overlay */}
      {(dataQ.isLoading || !mapReady) && (
        <div className="absolute inset-0 bg-bg-app/60 flex items-center justify-center pointer-events-none">
          <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground bg-bg-secondary/90 px-3 py-2 rounded border border-border">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-gold" />
            Cargando capas…
          </div>
        </div>
      )}

      {/* Basemap switcher */}
      <div className="absolute top-3 left-3 flex gap-1 bg-bg-secondary/90 border border-border rounded p-1">
        {(Object.keys(BASEMAPS) as BasemapKey[]).map((k) => (
          <button
            key={k}
            onClick={() => setBasemap(k)}
            className={`text-[10px] font-mono uppercase px-2 py-1 rounded transition-colors ${
              basemap === k
                ? "bg-gold text-background"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {BASEMAPS[k].label}
          </button>
        ))}
      </div>

      {/* Layers panel — cerrado por defecto para priorizar el mapa. */}
      <div className="absolute top-3 right-14 bg-bg-secondary/95 border border-border rounded p-1.5 min-w-[150px]">
        <button
          type="button"
          onClick={() => setLayersOpen((open) => !open)}
          className="flex w-full items-center justify-between gap-2 px-1 text-[10px] font-mono uppercase tracking-wider text-gold"
        >
          <span className="flex items-center gap-1.5">
            <LayersIcon className="w-3 h-3" /> Capas · {Object.values(visible).filter(Boolean).length}
          </span>
          <span>{layersOpen ? "▾" : "▸"}</span>
        </button>
        {layersOpen && (
          <div className="mt-1.5 min-w-[180px]">
        <LayerToggle
          icon={<TestTube2 className="w-3 h-3" />}
          label="Muestras"
          count={counts?.samples}
          color="#fb923c"
          checked={visible.samples}
          onChange={(v) => setVisible((s) => ({ ...s, samples: v }))}
        />
        <LayerToggle
          icon={<LayersIcon className="w-3 h-3" />}
          label="Concesiones"
          count={counts?.concessionsWithGeom}
          total={counts?.concessions}
          color="#f59e0b"
          checked={visible.concessions}
          onChange={(v) => setVisible((s) => ({ ...s, concessions: v }))}
        />
        {concessionsWithoutGeometry.length > 0 && (
          <div className="mt-1 mb-1 px-1.5 py-1.5 rounded border border-amber-500/30 bg-amber-500/10">
            <div className="text-[10px] font-mono text-amber-400">
              {concessionsWithoutGeometry.length} sin polígono
            </div>
            <div className="mt-1 space-y-0.5 max-h-20 overflow-y-auto">
              {concessionsWithoutGeometry.map((f) => (
                <div
                  key={String(f.id)}
                  className="text-[9px] font-mono text-muted-foreground truncate"
                >
                  {String(f.properties.code ?? f.properties.name ?? f.id ?? "Concesión")}
                </div>
              ))}
            </div>
          </div>
        )}
        <LayerToggle
          icon={<Target className="w-3 h-3" />}
          label="Targets"
          count={counts?.targets}
          color="#ef4444"
          checked={visible.targets}
          onChange={(v) => setVisible((s) => ({ ...s, targets: v }))}
        />
        <LayerToggle
          icon={<Satellite className="w-3 h-3" />}
          label="Anom. SAT"
          count={counts?.satAnomalies}
          color="#f59e0b"
          checked={visible.sat}
          onChange={(v) => setVisible((s) => ({ ...s, sat: v }))}
        />
        <LayerToggle
          icon={<Sparkles className="w-3 h-3" />}
          label="Anom. MAG"
          count={counts?.magAnomalies}
          color="#a855f7"
          checked={visible.mag}
          onChange={(v) => setVisible((s) => ({ ...s, mag: v }))}
        />
          </div>
        )}
      </div>

      {/* Certification toggle */}
      <div className="absolute bottom-3 right-3 bg-bg-secondary/95 border border-border rounded p-2 max-w-[260px]">
        <label className="flex items-center justify-between gap-3 text-xs cursor-pointer">
          <span className="flex items-center gap-1.5 text-foreground">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span className="font-medium">Modo validación</span>
          </span>
          <Switch checked={certificationMode} onCheckedChange={setCertificationMode} />
        </label>
        <div className="mt-1.5 text-[10px] font-mono text-muted-foreground">
          Filtro interno · targets con confianza ≥ 60%
        </div>
        {certificationMode && (
          <div className="mt-1.5 text-[10px] font-mono">
            <span className="text-emerald-400">{certifReady.ok} aptos</span> ·{" "}
            <span className="text-amber-400">{certifReady.gap} gaps</span>
          </div>
        )}
      </div>

      {/* Feature side panel */}
      {selected && (
        <div className="absolute top-3 bottom-3 right-3 w-[320px] bg-bg-secondary/98 border border-border rounded-lg shadow-2xl overflow-y-auto z-10">
          <FeaturePanel feature={selected} onClose={() => setSelected(null)} />
        </div>
      )}
    </div>
  );
}

function LayerToggle({
  icon,
  label,
  count,
  total,
  color,
  checked,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  count?: number;
  total?: number;
  color: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-2 py-1 cursor-pointer hover:bg-bg-app/40 px-1 rounded">
      <span className="flex items-center gap-1.5 text-[11px] text-foreground">
        <span style={{ color }}>{icon}</span>
        {label}
      </span>
      <span className="flex items-center gap-1.5">
        {count != null && (
          <span className="text-[9px] font-mono text-muted-foreground">
            {count}
            {total != null && total !== count ? `/${total}` : ""}
          </span>
        )}
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="w-3 h-3 accent-gold"
        />
      </span>
    </label>
  );
}

function FeaturePanel({ feature, onClose }: { feature: SelectedFeature; onClose: () => void }) {
  const { layer, props, lngLat } = feature;

  const title = props.name ?? props.code ?? props.index_code ?? `${layer}`;
  const subtitle =
    layer === "target"
      ? `${props.target_type ?? "target"} · ${props.commodity ?? "—"}`
      : layer === "concession"
        ? `${props.concession_type ?? "—"} · ${props.status ?? "—"}`
        : layer === "sat_anomaly"
          ? `Anomalía satelital ${props.index_code ?? ""}`
          : layer === "mag_anomaly"
            ? "Anomalía magnética"
            : layer === "sample"
              ? `${props.sample_type ?? "muestra"} · ${props.lab ?? "laboratorio no informado"}`
              : "";

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[10px] font-mono uppercase tracking-wider text-gold">{layer}</div>
          <h3 className="text-sm font-semibold text-foreground truncate">{title}</h3>
          {subtitle && <div className="text-[11px] text-muted-foreground">{subtitle}</div>}
        </div>
        <Button size="icon" variant="ghost" onClick={onClose} className="h-6 w-6 shrink-0">
          <X className="w-3.5 h-3.5" />
        </Button>
      </div>

      {layer === "target" && (
        <div className="space-y-2">
          <div className="flex gap-1 flex-wrap">
            {props.priority && (
              <Badge
                style={{
                  backgroundColor: PRIORITY_COLOR[props.priority as string] ?? "#94a3b8",
                  color: "#0b0a09",
                }}
                className="text-[10px]"
              >
                {String(props.priority).toUpperCase()}
              </Badge>
            )}
            {props.stage && (
              <Badge variant="outline" className="text-[10px]">
                {props.stage}
              </Badge>
            )}
          </div>
          <Metric label="Score" value={fmt(props.score, 1)} />
          <Metric label="Confianza" value={`${fmt(props.confidence_pct, 0)}%`} />
          <Metric label="Elevación" value={`${fmt(props.elevation_m, 0)} m`} />
          {props.rationale && (
            <div className="text-[11px] text-muted-foreground bg-bg-app/60 p-2 rounded border border-border">
              {props.rationale}
            </div>
          )}
        </div>
      )}

      {layer === "concession" && (
        <div className="space-y-2">
          <Metric label="Holder" value={props.holder ?? "—"} />
          <Metric label="Área" value={`${fmt(props.area_ha, 0)} ha`} />
          <Metric label="Región" value={props.region ?? "—"} />
          <Metric label="Comuna" value={props.commune ?? "—"} />
          <Metric
            label="Vigencia"
            value={
              props.expires_at
                ? new Date(props.expires_at as string).toLocaleDateString("es-CL")
                : "—"
            }
          />
        </div>
      )}

      {layer === "sat_anomaly" && (
        <div className="space-y-2">
          <Badge
            style={{
              backgroundColor: SEVERITY_COLOR[props.severity as string] ?? "#94a3b8",
              color: "#0b0a09",
            }}
            className="text-[10px]"
          >
            {String(props.severity ?? "").toUpperCase()}
          </Badge>
          <Metric label="Índice" value={props.index_code ?? "—"} />
          <Metric label="Score" value={fmt(props.score, 2)} />
        </div>
      )}

      {layer === "mag_anomaly" && (
        <div className="space-y-2">
          <Metric label="Magnetismo" value={`${fmt(props.mag_nt, 1)} nT`} />
          <Metric label="Rank" value={fmt(props.rank, 0)} />
          <Metric label="Radio" value={`${fmt(props.radius_m, 0)} m`} />
        </div>
      )}

      {layer === "sample" && (
        <div className="space-y-2">
          <Metric label="Código" value={props.sample_code ?? "—"} />
          <Metric label="Cobre" value={`${fmt(props.cu_pct, 3)} % Cu`} />
          <Metric label="Oro" value={`${fmt(props.au_gpt, 3)} g/t Au`} />
          <Metric label="Plata" value={`${fmt(props.ag_gpt, 2)} g/t Ag`} />
          <Metric label="Laboratorio" value={props.lab ?? "—"} />
          <Metric label="Certificado" value={props.certificate ?? "No informado"} />
          <Metric label="Estado" value={props.record_status ?? "—"} />
          <div className="text-[10px] text-muted-foreground border-t border-border pt-2">
            Antecedente geoquímico cargado. No constituye recurso ni reserva mineral.
          </div>
        </div>
      )}

      <div className="pt-2 border-t border-border text-[10px] font-mono text-muted-foreground flex items-center gap-1.5">
        <MapPin className="w-3 h-3" />
        {lngLat[1].toFixed(5)}°, {lngLat[0].toFixed(5)}°
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between text-[11px]">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-foreground font-mono">{value}</span>
    </div>
  );
}
