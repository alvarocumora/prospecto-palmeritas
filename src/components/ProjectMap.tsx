import { useCallback, useEffect, useRef, useState } from "react";
import type { Control, GeoJSON as LeafletGeoJSON, Layer, Map as LeafletMap } from "leaflet";
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
import { addProjectFeatures } from "./map/featureLayers";
import {
  bboxAround,
  clearCatastroCache,
  loadCatastro,
  wireMacrostratClickPopup,
} from "./map/catastroLayer";

/**
 * Interactive Leaflet map for Prospecto Palmeras (TRK-ALH-001).
 * - Project features (AOI, vetas, palmeras, labores, collares) from local GeoJSON.
 * - Macrostrat geological raster overlay + click-to-query popup.
 * - SERNAGEOMIN Catastro Minero — single FeatureServer query (layer 2,
 *   `WGS84_Concesion`), filtered by `ID_SITUACION_CONCESION in (1,3)` and
 *   split client-side by `ORIGEN` into the same 4 categories used by the
 *   official viewer (Explotación 1983/1932, Exploración 1983, Estacamento).
 *
 * Client-only: dynamically imports Leaflet to avoid SSR breakage in the Worker.
 */
type CatastroLayersByOrigen = Partial<Record<CatastroOrigen, LeafletGeoJSON>>;

const ORIGEN_ORDER: CatastroOrigen[] = [
  "EXPLOTA_1983",
  "EXPLOTA_1932",
  "EXPLORA_1983",
  "ESTACAMENTO",
];

// Activar por defecto las dos categorías más relevantes para el proyecto:
// pertenencias de explotación (azules) y concesiones de exploración (verdes).
const DEFAULT_VISIBLE: ReadonlySet<CatastroOrigen> = new Set([
  "EXPLOTA_1983",
  "EXPLORA_1983",
]);

export function ProjectMap() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const leafletRef = useRef<LeafletNS | null>(null);
  const layerControlRef = useRef<Control.Layers | null>(null);
  const catastroLayersRef = useRef<CatastroLayersByOrigen>({});
  const [counts, setCounts] = useState<Partial<Record<CatastroOrigen, number>>>({});
  const [refreshing, setRefreshing] = useState(false);

  const loadCatastroData = useCallback(async () => {
    const L = leafletRef.current;
    const map = mapRef.current;
    const ctrl = layerControlRef.current;
    if (!L || !map || !ctrl) return;

    const bbox = bboxAround(CENTER, 8);
    let result: Awaited<ReturnType<typeof loadCatastro>>;
    try {
      result = await loadCatastro(L, bbox);
    } catch (err) {
      console.warn("Catastro falló:", err);
      setCounts({});
      return;
    }

    // Remove previous catastro layers from the layer control + map.
    for (const origen of ORIGEN_ORDER) {
      const prev = catastroLayersRef.current[origen];
      if (prev) {
        ctrl.removeLayer(prev);
        if (map.hasLayer(prev)) map.removeLayer(prev);
      }
    }
    catastroLayersRef.current = {};

    // Add new layers, in stacking order: estacamento (bottom) → explota_1983 (top)
    for (const origen of [...ORIGEN_ORDER].reverse()) {
      const layer = result.layersByOrigen[origen];
      const count = result.countsByOrigen[origen] ?? 0;
      const style = CATASTRO_STYLE[origen];
      if (!layer) continue;
      const label = `${style.label} (${count})`;
      ctrl.addOverlay(layer, label);
      if (DEFAULT_VISIBLE.has(origen)) layer.addTo(map);
      catastroLayersRef.current[origen] = layer;
    }
    setCounts(result.countsByOrigen);
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
      basemaps["Esri Imagery"].addTo(map);
      const geoOverlays = buildGeologyOverlays(L);

      // --- Load project GeoJSON in parallel ---
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

      // Layer control with geology overlays — catastro overlays are added dynamically.
      const overlays: Record<string, Layer> = { ...geoOverlays };
      const ctrl = L.control
        .layers(basemaps, overlays, { position: "topright", collapsed: true })
        .addTo(map);
      layerControlRef.current = ctrl;

      // --- Initial Catastro load ---
      await loadCatastroData();
      if (cancelled) return;

      // --- Macrostrat click-to-query popup ---
      wireMacrostratClickPopup(L, map, fetchMacrostratUnit, macrostratPopupHtml);

      cleanup = () => {
        map.remove();
        mapRef.current = null;
        leafletRef.current = null;
        layerControlRef.current = null;
        catastroLayersRef.current = {};
      };
    })();

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [loadCatastroData]);

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
        <span
          className="w-2 h-2 rounded-sm"
          style={{ background: style.color, opacity: 0.8 }}
        />
        {style.label}: <strong>{c ?? "…"}</strong>
      </span>
    );
  };

  return (
    <div className="space-y-3">
      <div
        ref={containerRef}
        className="h-72 md:h-96 w-full rounded border border-border overflow-hidden bg-bg-secondary"
        style={{ zIndex: 0 }}
      />
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
        <button
          type="button"
          onClick={handleRefresh}
          disabled={refreshing}
          className="ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded border border-border bg-bg-secondary text-muted-foreground hover:text-foreground hover:border-foreground/40 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          title="Limpia el cache local y vuelve a descargar el catastro desde SERNAGEOMIN"
        >
          {refreshing ? "Refrescando…" : "↻ Refrescar catastro"}
        </button>
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
          <span className="w-3 h-3 rounded-sm border-2 border-info" /> Collar DDH propuesto
        </span>
        <span className="text-muted-foreground/70">· toggle de capas arriba-derecha del mapa · click → Macrostrat</span>
      </div>
    </div>
  );
}
