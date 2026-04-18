import { useCallback, useEffect, useRef, useState } from "react";
import { Maximize2, Minimize2, Wrench, Ruler, Crosshair, Download, Layers, Pencil } from "lucide-react";
import type { Control, GeoJSON as LeafletGeoJSON, Layer, Map as LeafletMap, LayerGroup } from "leaflet";
import "leaflet/dist/leaflet.css";

import aoiData from "@/data/geo/aoi.geojson?url";
import veinsData from "@/data/geo/veins.geojson?url";
import palmsData from "@/data/geo/palm_clusters.geojson?url";
import workingsData from "@/data/geo/workings.geojson?url";
import drillsData from "@/data/geo/drill_collars.geojson?url";

import { CENTER, type AnyFC, type LeafletNS } from "./map/types";
import { buildBasemaps } from "./map/basemaps";
import {
  buildGeologyOverlays,
  CATASTRO_STYLE,
  fetchMacrostratUnit,
  macrostratPopupHtml,
  type CatastroOrigen,
} from "./map/overlays";
import { buildGeophysicsOverlays } from "./map/geophysicsOverlays";
import { buildGeophysicsLayer, computeMagStats, type MagStats } from "./map/geophysicsLayers";
import { MagnetometryLegend } from "./map/MagnetometryLegend";
import { addProjectFeatures } from "./map/featureLayers";
import {
  bboxAround,
  clearCatastroCache,
  loadCatastro,
  wireMacrostratClickPopup,
} from "./map/catastroLayer";

import { loadAoiPolygon, type AoiPolygon } from "./map/aoiPolygon";
import { useGeophysicsData } from "@/hooks/useGeophysicsData";
import { useProjects } from "@/hooks/useProjects";
import { useMiningConcessions } from "@/hooks/useMiningConcessions";
import { useDrillHoles } from "@/hooks/useDrilling";
import { buildConcessionsLayer } from "./map/concessionLayer";
import { buildDrillCollarsLayer } from "./map/drillCollarsLayer";
import { useLayerState, type LayerStateMap } from "@/hooks/useLayerState";
import { LayerOpacityPanel, type ManagedLayer } from "./map/LayerOpacityPanel";
import { CoordinateFooter } from "./map/CoordinateFooter";
import { DrawingTools } from "./map/DrawingTools";

type CatastroLayersByOrigen = Partial<Record<CatastroOrigen, LeafletGeoJSON>>;

const ORIGEN_ORDER: CatastroOrigen[] = [
  "EXPLOTA_1983",
  "EXPLOTA_1932",
  "EXPLORA_1983",
  "ESTACAMENTO",
];

const DEFAULT_VISIBLE: ReadonlySet<CatastroOrigen> = new Set([
  "EXPLOTA_1983",
  "EXPLORA_1983",
]);

const DEFAULT_LAYER_STATE: LayerStateMap = {
  "basemap:esri-imagery": { visible: true, opacity: 1 },
  "basemap:esri-topo": { visible: false, opacity: 1 },
  "basemap:carto-dark": { visible: false, opacity: 1 },
  "basemap:opentopo": { visible: false, opacity: 1 },
  "geo:macrostrat": { visible: false, opacity: 0.7 },
  "geophys:emag2": { visible: false, opacity: 0.55 },
  "geophys:wgm2012": { visible: false, opacity: 0.55 },
  "geophys:hillshade": { visible: false, opacity: 0.6 },
  "geophys:planned": { visible: true, opacity: 1 },
  "geophys:real": { visible: true, opacity: 1 },
  "catastro:EXPLOTA_1983": { visible: true, opacity: 1 },
  "catastro:EXPLOTA_1932": { visible: false, opacity: 1 },
  "catastro:EXPLORA_1983": { visible: true, opacity: 1 },
  "catastro:ESTACAMENTO": { visible: false, opacity: 1 },
  "concessions:project": { visible: true, opacity: 1 },
  "drills:project": { visible: true, opacity: 1 },
};

export function ProjectMap() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const leafletRef = useRef<LeafletNS | null>(null);
  const catastroLayersRef = useRef<CatastroLayersByOrigen>({});
  const featuresByOrigenRef = useRef<Record<CatastroOrigen, AnyFC["features"]> | null>(null);
  const aoiRef = useRef<AoiPolygon | null>(null);
  const geophysicsLayerRef = useRef<LayerGroup | null>(null);
  const geophysicsRealLayerRef = useRef<LayerGroup | null>(null);
  const measureLineRef = useRef<Layer | null>(null);
  const measurePointsRef = useRef<[number, number][]>([]);

  const [counts, setCounts] = useState<Partial<Record<CatastroOrigen, number>>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [layersOpen, setLayersOpen] = useState(false);
  const [drawOpen, setDrawOpen] = useState(false);
  const [measuring, setMeasuring] = useState(false);
  const [measureDist, setMeasureDist] = useState<number | null>(null);
  const [managedLayers, setManagedLayers] = useState<ManagedLayer[]>([]);
  const [mapReady, setMapReady] = useState(false);
  const [magStats, setMagStats] = useState<MagStats | null>(null);
  const { active } = useProjects();
  const { data: geoph } = useGeophysicsData(active?.id ?? null);
  const { data: concessions } = useMiningConcessions(active?.id ?? null);
  const { data: drillHoles } = useDrillHoles(active?.id ?? null);
  const concessionsLayerRef = useRef<LayerGroup | null>(null);
  const drillCollarsLayerRef = useRef<LayerGroup | null>(null);
  const { state: layerState, setVisible, setOpacity } = useLayerState(DEFAULT_LAYER_STATE);

  const loadCatastroData = useCallback(async () => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!L || !map) return;

    const bbox = bboxAround(CENTER, 8);
    let result: Awaited<ReturnType<typeof loadCatastro>>;
    try {
      result = await loadCatastro(L, bbox);
    } catch (err) {
      console.warn("Catastro falló:", err);
      setCounts({});
      return;
    }

    for (const origen of ORIGEN_ORDER) {
      const prev = catastroLayersRef.current[origen];
      if (prev && map.hasLayer(prev)) map.removeLayer(prev);
    }
    catastroLayersRef.current = {};

    const newCatastroLayers: ManagedLayer[] = [];
    for (const origen of [...ORIGEN_ORDER].reverse()) {
      const layer = result.layersByOrigen[origen];
      const count = result.countsByOrigen[origen] ?? 0;
      const style = CATASTRO_STYLE[origen];
      if (!layer) continue;
      catastroLayersRef.current[origen] = layer;
      newCatastroLayers.push({
        id: `catastro:${origen}`,
        label: `${style.label} (${count})`,
        group: "Catastro",
        layer,
      });
      if (DEFAULT_VISIBLE.has(origen)) layer.addTo(map);
    }
    // Merge into managedLayers (replace catastro entries)
    setManagedLayers((prev) => [
      ...prev.filter((l) => !l.id.startsWith("catastro:")),
      ...newCatastroLayers,
    ]);
    setCounts(result.countsByOrigen);
    featuresByOrigenRef.current = result.featuresByOrigen;
  }, []);

  const handleExportPdf = useCallback(async () => {
    const f = featuresByOrigenRef.current;
    if (!f) return;
    const { exportCatastroPdf } = await import("./map/exportCatastroPdf");
    exportCatastroPdf(f, { center: CENTER, halfKm: 8, aoi: aoiRef.current });
  }, []);

  const handleRefresh = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    setCounts({});
    try {
      clearCatastroCache();
      await loadCatastroData();
    } finally {
      setRefreshing(false);
    }
  }, [loadCatastroData, refreshing]);

  useEffect(() => {
    let cancelled = false;
    let cleanup: (() => void) | undefined;

    (async () => {
      const L = (await import("leaflet")).default as unknown as LeafletNS;
      // Load leaflet-draw as a side-effect so it extends L.Control.Draw / L.Draw
      await import("leaflet-draw");
      if (cancelled || !containerRef.current) return;
      if (mapRef.current) return;

      const map = L.map(containerRef.current, {
        center: CENTER,
        zoom: 16,
        scrollWheelZoom: false,
        zoomControl: true,
        attributionControl: true,
      });
      mapRef.current = map;
      leafletRef.current = L;

      const basemaps = buildBasemaps(L);
      const geoOverlays = buildGeologyOverlays(L);
      const geophysicsWms = buildGeophysicsOverlays(L);

      const [aoiFC, veinsFC, palmsFC, workingsFC, drillsFC] = (await Promise.all(
        [aoiData, veinsData, palmsData, workingsData, drillsData].map((u) =>
          fetch(u).then((r) => r.json())
        )
      )) as AnyFC[];
      if (cancelled) return;

      addProjectFeatures(L, map, {
        aoi: aoiFC,
        veins: veinsFC,
        palms: palmsFC,
        workings: workingsFC,
        drills: drillsFC,
      });

      aoiRef.current = (await loadAoiPolygon()) ?? null;

      // Build managed layers list (basemaps + overlays). Catastro added later.
      const initial: ManagedLayer[] = [
        { id: "basemap:esri-imagery", label: "Esri Imagery", group: "Basemap", layer: basemaps["Esri Imagery"], exclusive: true },
        { id: "basemap:esri-topo", label: "Esri Topo", group: "Basemap", layer: basemaps["Esri Topo"], exclusive: true },
        { id: "basemap:carto-dark", label: "CARTO Dark", group: "Basemap", layer: basemaps["CARTO Dark"], exclusive: true },
        { id: "basemap:opentopo", label: "OpenTopoMap", group: "Basemap", layer: basemaps["OpenTopoMap"], exclusive: true },
        { id: "geo:macrostrat", label: "Geología Macrostrat", group: "Geología", layer: geoOverlays["Geología Macrostrat (global)"] },
        { id: "geophys:emag2", label: "Magnetometría EMAG2", group: "Geofísica", layer: geophysicsWms["Magnetometría EMAG2 (regional)"] },
        { id: "geophys:wgm2012", label: "Gravimetría WGM2012", group: "Geofísica", layer: geophysicsWms["Gravimetría Bouguer WGM2012 (regional)"] },
        { id: "geophys:hillshade", label: "Hillshade SRTM", group: "Geofísica", layer: geophysicsWms["Hillshade SRTM (Esri)"] },
      ];
      setManagedLayers(initial);
      setMapReady(true);

      await loadCatastroData();
      if (cancelled) return;

      wireMacrostratClickPopup(L, map, fetchMacrostratUnit, macrostratPopupHtml);

      cleanup = () => {
        map.remove();
        mapRef.current = null;
        leafletRef.current = null;
        catastroLayersRef.current = {};
        geophysicsLayerRef.current = null;
      };
    })();

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [loadCatastroData]);

  // Build geophysics layers (planned/synthetic + real captured) for the active project
  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!L || !map || !geoph) return;

    const surveys = geoph.surveys;
    const surveyIds = new Set(surveys.map((s) => s.id));
    const linesAll = geoph.lines.filter((l) => l.survey_id == null || surveyIds.has(l.survey_id));
    const stationsAll = geoph.stations.filter((s) => s.survey_id == null || surveyIds.has(s.survey_id));

    const synLines = linesAll.filter((l) => l.is_synthetic);
    const synStations = stationsAll.filter((s) => s.is_synthetic);
    const realLines = linesAll.filter((l) => !l.is_synthetic);
    const realStations = stationsAll.filter((s) => !s.is_synthetic);

    if (geophysicsLayerRef.current) {
      map.removeLayer(geophysicsLayerRef.current);
      geophysicsLayerRef.current = null;
    }
    if (geophysicsRealLayerRef.current) {
      map.removeLayer(geophysicsRealLayerRef.current);
      geophysicsRealLayerRef.current = null;
    }

    const plannedLayer = buildGeophysicsLayer(L, surveys, synLines, synStations);
    const realLayer = buildGeophysicsLayer(L, surveys, realLines, realStations, { realData: true });
    geophysicsLayerRef.current = plannedLayer;
    geophysicsRealLayerRef.current = realLayer;

    setMagStats(computeMagStats(realStations));

    setManagedLayers((prev) => {
      const without = prev.filter((p) => p.id !== "geophys:planned" && p.id !== "geophys:real");
      return [
        ...without,
        {
          id: "geophys:planned",
          label: `Geofísica planificada (${synLines.length}L / ${synStations.length}E)`,
          group: "Proyecto",
          layer: plannedLayer,
        },
        {
          id: "geophys:real",
          label: `Geofísica capturada en campo (${realLines.length}L / ${realStations.length}E)`,
          group: "Proyecto",
          layer: realLayer,
        },
      ];
    });
  }, [geoph, active?.id]);

  // Build mining concessions layer for the active project
  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!L || !map) return;
    if (concessionsLayerRef.current) {
      map.removeLayer(concessionsLayerRef.current);
      concessionsLayerRef.current = null;
    }
    const layer = buildConcessionsLayer(L, concessions);
    concessionsLayerRef.current = layer;
    if (concessions.length > 0) layer.addTo(map);
    setManagedLayers((prev) => {
      const without = prev.filter((p) => p.id !== "concessions:project");
      return [
        ...without,
        {
          id: "concessions:project",
          label: `Concesiones del proyecto (${concessions.length})`,
          group: "Catastro",
          layer,
        },
      ];
    });
  }, [concessions, active?.id]);

  // Build drill collars layer for the active project
  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!L || !map) return;
    if (drillCollarsLayerRef.current) {
      map.removeLayer(drillCollarsLayerRef.current);
      drillCollarsLayerRef.current = null;
    }
    const layer = buildDrillCollarsLayer(L, drillHoles);
    drillCollarsLayerRef.current = layer;
    if (drillHoles.length > 0) layer.addTo(map);
    setManagedLayers((prev) => {
      const without = prev.filter((p) => p.id !== "drills:project");
      return [
        ...without,
        {
          id: "drills:project",
          label: `Sondajes del proyecto (${drillHoles.length})`,
          group: "Proyecto",
          layer,
        },
      ];
    });
  }, [drillHoles, active?.id]);


  // Fullscreen toggle
  const toggleFullscreen = useCallback(async () => {
    const el = wrapperRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      await el.requestFullscreen?.();
    } else {
      await document.exitFullscreen?.();
    }
  }, []);

  useEffect(() => {
    const handler = () => {
      const fs = !!document.fullscreenElement;
      setIsFullscreen(fs);
      setTimeout(() => mapRef.current?.invalidateSize(), 200);
    };
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  // Center on AOI
  const centerOnAoi = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    map.setView(CENTER, 16, { animate: true });
  }, []);

  // Measure tool
  const clearMeasure = useCallback(() => {
    const map = mapRef.current;
    if (map && measureLineRef.current) map.removeLayer(measureLineRef.current);
    measureLineRef.current = null;
    measurePointsRef.current = [];
    setMeasureDist(null);
  }, []);

  const toggleMeasure = useCallback(() => {
    const map = mapRef.current;
    const L = leafletRef.current;
    if (!map || !L) return;
    if (measuring) {
      clearMeasure();
      setMeasuring(false);
      map.getContainer().style.cursor = "";
      return;
    }
    setMeasuring(true);
    map.getContainer().style.cursor = "crosshair";
  }, [measuring, clearMeasure]);

  useEffect(() => {
    const map = mapRef.current;
    const L = leafletRef.current;
    if (!map || !L || !measuring) return;
    const container = map.getContainer();
    const handleClick = (ev: MouseEvent) => {
      ev.stopPropagation();
      ev.preventDefault();
      const rect = container.getBoundingClientRect();
      const x = ev.clientX - rect.left;
      const y = ev.clientY - rect.top;
      const latlng = map.containerPointToLatLng([x, y]);
      const pt: [number, number] = [latlng.lat, latlng.lng];
      measurePointsRef.current.push(pt);
      if (measureLineRef.current) map.removeLayer(measureLineRef.current);
      const line = L.polyline(measurePointsRef.current, { color: "#F5A524", weight: 3, dashArray: "5 5" });
      line.addTo(map);
      measureLineRef.current = line;
      let total = 0;
      const pts = measurePointsRef.current;
      for (let i = 1; i < pts.length; i++) total += map.distance(pts[i - 1], pts[i]);
      setMeasureDist(total);
    };
    container.addEventListener("click", handleClick, true);
    return () => container.removeEventListener("click", handleClick, true);
  }, [measuring]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "f" || e.key === "F") toggleFullscreen();
      else if (e.key === "m" || e.key === "M") toggleMeasure();
      else if (e.key === "l" || e.key === "L") setLayersOpen((v) => !v);
      else if (e.key === "d" || e.key === "D") setDrawOpen((v) => !v);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggleFullscreen, toggleMeasure]);

  const renderChip = (origen: CatastroOrigen) => {
    const style = CATASTRO_STYLE[origen];
    const c = counts[origen];
    return (
      <span
        key={origen}
        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded border"
        style={{
          borderColor: `${style.color}66`,
          background: `${style.color}1A`,
          color: style.color,
        }}
      >
        <span className="w-2 h-2 rounded-sm" style={{ background: style.color, opacity: 0.8 }} />
        {style.label}: <strong>{c ?? "…"}</strong>
      </span>
    );
  };

  return (
    <div className="space-y-3">
      <div
        ref={wrapperRef}
        className={`relative ${isFullscreen ? "h-screen w-screen bg-background" : ""}`}
      >
        <div
          ref={containerRef}
          data-export-map
          className={`${isFullscreen ? "h-full" : "h-72 md:h-96"} w-full rounded border border-border overflow-hidden bg-bg-secondary`}
          style={{ zIndex: 0 }}
        />

        {/* Floating control toolbar (top-left) */}
        <div className="absolute top-2 left-2 z-[1000] flex flex-col gap-1.5">
          <button
            type="button"
            onClick={toggleFullscreen}
            className="w-9 h-9 inline-flex items-center justify-center rounded border border-border bg-background/95 backdrop-blur text-foreground hover:bg-accent shadow-md transition-colors"
            title="Pantalla completa (F)"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
          <button
            type="button"
            onClick={() => { setToolsOpen((v) => !v); setLayersOpen(false); setDrawOpen(false); }}
            className={`w-9 h-9 inline-flex items-center justify-center rounded border border-border ${toolsOpen ? "bg-primary text-primary-foreground" : "bg-background/95 text-foreground hover:bg-accent"} backdrop-blur shadow-md transition-colors`}
            title="Herramientas de gestión"
          >
            <Wrench className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => { setDrawOpen((v) => !v); setToolsOpen(false); setLayersOpen(false); }}
            className={`w-9 h-9 inline-flex items-center justify-center rounded border border-border ${drawOpen ? "bg-primary text-primary-foreground" : "bg-background/95 text-foreground hover:bg-accent"} backdrop-blur shadow-md transition-colors`}
            title="Dibujo (D)"
          >
            <Pencil className="w-4 h-4" />
          </button>
        </div>

        {/* Layers button (top-right) */}
        <div className="absolute top-2 right-2 z-[1001]">
          {!layersOpen && (
            <button
              type="button"
              onClick={() => { setLayersOpen(true); setToolsOpen(false); setDrawOpen(false); }}
              className="w-9 h-9 inline-flex items-center justify-center rounded border border-border bg-background/95 backdrop-blur text-foreground hover:bg-accent shadow-md transition-colors"
              title="Capas y opacidad (L)"
            >
              <Layers className="w-4 h-4" />
            </button>
          )}
        </div>

        {toolsOpen && (
          <div className="absolute top-2 left-14 z-[1000] w-64 rounded border border-border bg-background/95 backdrop-blur shadow-lg p-3 text-xs font-mono space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-foreground font-semibold uppercase tracking-wide">Gestión</span>
              <button type="button" onClick={() => setToolsOpen(false)} className="text-muted-foreground hover:text-foreground" aria-label="Cerrar">✕</button>
            </div>
            <div className="space-y-1.5">
              <div className="text-muted-foreground/70 text-[10px] uppercase">Navegación</div>
              <button type="button" onClick={centerOnAoi} className="w-full inline-flex items-center gap-2 px-2 py-1.5 rounded border border-border bg-bg-secondary text-foreground hover:bg-accent transition-colors">
                <Crosshair className="w-3.5 h-3.5" /> Centrar en AOI
              </button>
              <button type="button" onClick={toggleMeasure} className={`w-full inline-flex items-center justify-between gap-2 px-2 py-1.5 rounded border ${measuring ? "border-gold bg-gold/10 text-gold" : "border-border bg-bg-secondary text-foreground hover:bg-accent"} transition-colors`}>
                <span className="inline-flex items-center gap-2">
                  <Ruler className="w-3.5 h-3.5" /> {measuring ? "Medir: ON" : "Medir distancia (M)"}
                </span>
                {measureDist != null && <span className="text-[10px] text-foreground">{(measureDist / 1000).toFixed(2)} km</span>}
              </button>
              {measuring && (
                <button type="button" onClick={clearMeasure} className="w-full text-[10px] text-muted-foreground hover:text-foreground">Limpiar mediciones</button>
              )}
            </div>
            <div className="space-y-1.5 border-t border-border pt-2">
              <div className="text-muted-foreground/70 text-[10px] uppercase">Catastro</div>
              <button type="button" onClick={handleExportPdf} disabled={Object.values(counts).every((n) => !n)} className="w-full inline-flex items-center gap-2 px-2 py-1.5 rounded border border-border bg-bg-secondary text-foreground hover:bg-accent disabled:opacity-50 transition-colors">
                <Download className="w-3.5 h-3.5" /> PDF pertenencias
              </button>
              <button type="button" onClick={handleRefresh} disabled={refreshing} className="w-full inline-flex items-center gap-2 px-2 py-1.5 rounded border border-border bg-bg-secondary text-foreground hover:bg-accent disabled:opacity-50 transition-colors">
                ↻ {refreshing ? "Refrescando…" : "Refrescar catastro"}
              </button>
            </div>
            <div className="text-[10px] text-muted-foreground/70 border-t border-border pt-2">
              Atajos: <strong>F</strong> pantalla · <strong>M</strong> medir · <strong>L</strong> capas · <strong>D</strong> dibujo
            </div>
          </div>
        )}

        <DrawingTools open={drawOpen} onClose={() => setDrawOpen(false)} map={mapRef.current} L={leafletRef.current} />

        <LayerOpacityPanel
          open={layersOpen}
          onClose={() => setLayersOpen(false)}
          map={mapRef.current}
          layers={managedLayers}
          state={layerState}
          onVisible={setVisible}
          onOpacity={setOpacity}
        />

        {mapReady && <CoordinateFooter map={mapRef.current} />}
      </div>

      <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono">
        <span className="text-muted-foreground/70">Catastro 8 km AOI:</span>
        {ORIGEN_ORDER.map(renderChip)}
        <a
          href={`https://appsngmaz.sernageomin.cl/catastro_SNGM/home/index?lat=${CENTER[0]}&lng=${CENTER[1]}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-border bg-bg-secondary text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors"
          title="Abrir el visor oficial de SERNAGEOMIN"
        >
          ↗ Visor SERNAGEOMIN
        </a>
      </div>

      <div className="flex flex-wrap gap-x-3 gap-y-1.5 text-[11px] font-mono text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-gold border border-background" /> Centroide
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-4 h-0.5 bg-gold-light" /> Veta Au–Cu
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full border-2 border-teal" /> Cluster palmeras
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 bg-copper inline-block" style={{ transform: "rotate(45deg)" }} /> Labor antigua
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm border-2 border-info" /> Collar DDH
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-info border border-background" /> Collar sondaje ({drillHoles.length})
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-0.5" style={{ background: "#E11D48", borderTop: "1px dashed #E11D48" }} /> Línea geofísica
        </span>
        <span className="text-muted-foreground/70">· panel <strong>Capas</strong> arriba-derecha controla visibilidad y opacidad</span>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <MagnetometryLegend stats={magStats} />
      </div>
    </div>
  );
}
