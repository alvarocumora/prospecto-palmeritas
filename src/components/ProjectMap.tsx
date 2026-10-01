import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Maximize2,
  Minimize2,
  Wrench,
  Ruler,
  Crosshair,
  Download,
  Layers,
  Pencil,
} from "lucide-react";
import type { GeoJSON as LeafletGeoJSON, Layer, Map as LeafletMap, LayerGroup } from "leaflet";
import "leaflet/dist/leaflet.css";

import { CENTER, type AnyFC, type LeafletNS } from "./map/types";
import { buildBasemaps } from "./map/basemaps";
import {
  buildGeologyOverlays,
  CATASTRO_STYLE,
  fetchMacrostratUnit,
  type CatastroOrigen,
} from "./map/overlays";
import { buildGeophysicsOverlays } from "./map/geophysicsOverlays";
import { buildSernageominLayers } from "./map/sernageominLayers";
import { buildUsgsEarthquakesLayer, buildOverpassInfraLayer } from "./map/externalFeedLayers";
import { buildSatelliteLayers } from "./map/satelliteLayers";
import { buildGeophysicsLayer, computeMagStats, type MagStats } from "./map/geophysicsLayers";
import { MagnetometryLegend } from "./map/MagnetometryLegend";
import { GeologyLegend } from "./map/GeologyLegend";
import { addProjectFeatures } from "./map/featureLayers";
import { bboxAround, clearCatastroCache, loadCatastro } from "./map/catastroLayer";
import { buildGeologyFeatureLayers, type GeologyLegendEntry } from "./map/geologyFeatureLayers";
import { useProjectGeologyMap } from "@/hooks/useProjectGeologyMap";

import { loadAoiPolygon, type AoiPolygon } from "./map/aoiPolygon";
import { useGeophysicsData } from "@/hooks/useGeophysicsData";
import { useProjects } from "@/hooks/useProjects";
import { useMiningConcessions } from "@/hooks/useMiningConcessions";
import { useDrillHoles } from "@/hooks/useDrilling";
import { useProjectCoreLogs } from "@/hooks/useProjectCoreLogs";
import {
  computeIntercepts,
  bestIntercept,
  interceptScore,
  scoreToHaloStyle,
} from "@/lib/drilling/intercepts";
import { buildConcessionsLayer } from "./map/concessionLayer";
import {
  buildConcesionesNacionalesLayer,
  type ConcesionTipo,
} from "./map/concesionesNacionalesLayer";
import { buildDrillCollarsLayer } from "./map/drillCollarsLayer";
import { useLayerState, type LayerStateMap } from "@/hooks/useLayerState";
import { LayerOpacityPanel, type ManagedLayer } from "./map/LayerOpacityPanel";
import { CoordinateFooter } from "./map/CoordinateFooter";
import { CatastroSearch } from "./map/CatastroSearch";
import { DrawingTools } from "./map/DrawingTools";
import { buildSamplesLayer } from "./map/sampleLayer";
import { buildDroneLayer } from "./map/droneLayer";
import { buildTargetsLayer } from "./map/targetsLayer";
import { wireGeoIntelClickPopup } from "./map/geoIntelInspector";
import { useDroneFlights } from "@/hooks/useDroneFlights";
import { useExplorationTargets } from "@/hooks/useExplorationTargets";
import type { SamplingResult } from "@/hooks/useSamplingResults";
import type { InspectedFeature } from "./map/FeatureInspectorPanel";
import { layerStateForPreset } from "@/lib/geospatial/projectMapPolicy";
import { getGeoViewerPreset, type GeoViewerPresetId } from "@/lib/geospatial/layerRegistry";

interface ProjectMapProps {
  samples?: SamplingResult[];
  onInspect?: (f: InspectedFeature) => void;
  fillHeight?: boolean;
  onMapReady?: (map: LeafletMap, L: LeafletNS) => void;
  /**
   * Force a specific basemap (used by report capture). When set, switches
   * to "satellite" → Esri Imagery or "topo" → Esri Topo, hiding other basemaps.
   * Set to null/undefined to leave user selection alone.
   */
  basemapOverride?: "satellite" | "topo" | null;
  /** Initial canonical layer preset. Runtime user choices still persist in localStorage. */
  initialPreset?: GeoViewerPresetId;
  /**
   * Transitional public Palmeras compatibility only.
   * Loads the historical static AOI/veins/palms/workings/drill/anomaly bundle.
   * Never enable this in authenticated multi-project workspaces.
   */
  legacyStaticProjectFeatures?: boolean;
}

type CatastroLayersByOrigen = Partial<Record<CatastroOrigen, LeafletGeoJSON>>;

const ORIGEN_ORDER: CatastroOrigen[] = [
  "EXPLOTA_1983",
  "EXPLOTA_1932",
  "EXPLORA_1983",
  "ESTACAMENTO",
];

const DEFAULT_VISIBLE: ReadonlySet<CatastroOrigen> = new Set(["EXPLOTA_1983", "EXPLORA_1983"]);

const DEFAULT_LAYER_STATE: LayerStateMap = {
  "basemap:esri-imagery": { visible: true, opacity: 1 },
  "basemap:esri-topo": { visible: false, opacity: 1 },
  "basemap:carto-dark": { visible: false, opacity: 1 },
  "basemap:opentopo": { visible: false, opacity: 1 },
  "geo:macrostrat": { visible: false, opacity: 0.7 },
  "geo:host-rock": { visible: true, opacity: 0.85 },
  "geo:alteration": { visible: true, opacity: 0.75 },
  "geo:prospect": { visible: true, opacity: 1 },
  "geochile:litologia": { visible: true, opacity: 0.65 },
  "geochile:yacimientos": { visible: true, opacity: 0.95 },
  "geochile:areas-protegidas": { visible: false, opacity: 0.5 },
  "sat:s2-truecolor": { visible: false, opacity: 1 },
  "sat:s2-ndvi": { visible: false, opacity: 0.85 },
  "sat:worldcover": { visible: false, opacity: 0.55 },
  "sat:copernicus-dem": { visible: false, opacity: 0.75 },
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
  "samples:project": { visible: true, opacity: 1 },
  "drones:flights": { visible: true, opacity: 0.9 },
  "drones:rasters": { visible: true, opacity: 0.75 },
  "targets:project": { visible: true, opacity: 1 },
  "ext:usgs-quakes": { visible: false, opacity: 0.85 },
  "ext:osm-infra": { visible: false, opacity: 0.9 },
  "sernageomin:explotacion": { visible: false, opacity: 0.55 },
  "sernageomin:exploracion": { visible: false, opacity: 0.55 },
  "sernageomin:mensura": { visible: false, opacity: 0.55 },
  "sernageomin:manifestacion": { visible: false, opacity: 0.55 },
};

export function ProjectMap({
  samples,
  onInspect,
  fillHeight,
  onMapReady,
  basemapOverride,
  initialPreset = "official_workbench",
  legacyStaticProjectFeatures = false,
}: ProjectMapProps = {}) {
  const samplesLayerRef = useRef<LayerGroup | null>(null);
  const droneLayerRef = useRef<LayerGroup | null>(null);
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
  const lithologyLayerRef = useRef<LayerGroup | null>(null);
  const alterationLayerRef = useRef<LayerGroup | null>(null);
  const prospectLayerRef = useRef<LayerGroup | null>(null);

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
  const [lithoLegend, setLithoLegend] = useState<GeologyLegendEntry[]>([]);
  const [altLegend, setAltLegend] = useState<GeologyLegendEntry[]>([]);
  const { active } = useProjects();
  const mapCenter = useMemo<[number, number]>(
    () =>
      active?.center_lat != null && active?.center_lng != null
        ? [Number(active.center_lat), Number(active.center_lng)]
        : CENTER,
    [active?.center_lat, active?.center_lng],
  );
  const { data: geologyMap } = useProjectGeologyMap(active?.id ?? null);
  const { data: geoph } = useGeophysicsData(active?.id ?? null);
  const { data: concessions } = useMiningConcessions(active?.id ?? null);
  const { data: drillHoles } = useDrillHoles(active?.id ?? null);
  const { byHole: logsByHole } = useProjectCoreLogs(active?.id ?? null);
  const { flights: droneFlights, rasters: droneRasters } = useDroneFlights(active?.id ?? null);
  const { targets } = useExplorationTargets(active?.id ?? null);
  const targetsRef = useRef<typeof targets>(targets);
  useEffect(() => {
    targetsRef.current = targets;
  }, [targets]);
  const targetsLayerRef = useRef<LayerGroup | null>(null);
  const scoresByHole = useMemo(() => {
    const out: Record<string, number> = {};
    for (const h of drillHoles) {
      const logs = logsByHole[h.id];
      if (!logs?.length) continue;
      const best = bestIntercept(computeIntercepts(logs, 0.5, 2));
      if (best) out[h.id] = interceptScore(best);
    }
    return out;
  }, [drillHoles, logsByHole]);
  const concessionsLayerRef = useRef<LayerGroup | null>(null);
  const drillCollarsLayerRef = useRef<LayerGroup | null>(null);
  const presetLayerState = useMemo(
    () => layerStateForPreset(DEFAULT_LAYER_STATE, initialPreset),
    [initialPreset],
  );
  const presetLabel = getGeoViewerPreset(initialPreset).label;
  const { state: layerState, setVisible, setOpacity } = useLayerState(presetLayerState);

  // External basemap override (used by NI 43-101 report capture).
  // Switches Esri Imagery / Esri Topo while hiding the other basemaps.
  useEffect(() => {
    if (!basemapOverride) return;
    if (basemapOverride === "satellite") {
      setVisible("basemap:esri-imagery", true);
      setVisible("basemap:esri-topo", false);
      setVisible("basemap:carto-dark", false);
      setVisible("basemap:opentopo", false);
    } else {
      setVisible("basemap:esri-topo", true);
      setVisible("basemap:esri-imagery", false);
      setVisible("basemap:carto-dark", false);
      setVisible("basemap:opentopo", false);
    }
  }, [basemapOverride, setVisible]);

  const loadCatastroData = useCallback(async () => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!L || !map) return;

    const bbox = bboxAround(mapCenter, 8);
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
  }, [mapCenter]);

  const handleExportPdf = useCallback(async () => {
    const f = featuresByOrigenRef.current;
    if (!f) return;
    const { exportCatastroPdf } = await import("./map/exportCatastroPdf");
    exportCatastroPdf(f, { center: mapCenter, halfKm: 8, aoi: aoiRef.current });
  }, [mapCenter]);

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
        center: mapCenter,
        zoom: 16,
        scrollWheelZoom: false,
        zoomControl: false,
        attributionControl: true,
      });
      L.control.zoom({ position: "bottomleft" }).addTo(map);
      L.control.scale({ position: "bottomleft", imperial: false, maxWidth: 140 }).addTo(map);

      // Minimap overview (bottom-right)
      try {
        const MiniMapMod = await import("leaflet-minimap");
        await import("leaflet-minimap/dist/Control.MiniMap.min.css");
        const MiniMap = (
          MiniMapMod as unknown as {
            default: new (layer: unknown, opts: unknown) => { addTo: (m: unknown) => void };
          }
        ).default;
        const miniLayer = L.tileLayer(
          "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
          { attribution: "", maxZoom: 13 },
        );
        new MiniMap(miniLayer, {
          position: "bottomright",
          width: 160,
          height: 110,
          zoomLevelOffset: -5,
          toggleDisplay: true,
          minimized: false,
          aimingRectOptions: {
            color: "#D4A24C",
            weight: 1,
            fillColor: "#D4A24C",
            fillOpacity: 0.15,
          },
          shadowRectOptions: { color: "#D4A24C", weight: 1, opacity: 0, fillOpacity: 0 },
        }).addTo(map);
      } catch (err) {
        console.warn("[minimap] failed to load:", err);
      }

      mapRef.current = map;
      leafletRef.current = L;

      const basemaps = buildBasemaps(L);
      const geoOverlays = buildGeologyOverlays(L);
      const geophysicsWms = buildGeophysicsOverlays(L);
      const sernageomin = buildSernageominLayers(L);
      const satellite = buildSatelliteLayers(L);
      const usgsLayer = await buildUsgsEarthquakesLayer(L);
      const overpassCtl = buildOverpassInfraLayer(L);
      overpassCtl.attach(map);

      if (legacyStaticProjectFeatures) {
        const staticUrls = await Promise.all([
          import("@/data/geo/aoi.geojson?url").then((module) => module.default),
          import("@/data/geo/veins.geojson?url").then((module) => module.default),
          import("@/data/geo/palm_clusters.geojson?url").then((module) => module.default),
          import("@/data/geo/workings.geojson?url").then((module) => module.default),
          import("@/data/geo/drill_collars.geojson?url").then((module) => module.default),
          import("@/data/geo/satellite_anomalies.geojson?url").then((module) => module.default),
        ]);
        const [aoiFC, veinsFC, palmsFC, workingsFC, drillsFC, anomaliesFC] = (await Promise.all(
          staticUrls.map((url) => fetch(url).then((response) => response.json())),
        )) as AnyFC[];
        if (cancelled) return;

        addProjectFeatures(L, map, {
          aoi: aoiFC,
          veins: veinsFC,
          palms: palmsFC,
          workings: workingsFC,
          drills: drillsFC,
          anomalies: anomaliesFC,
        });
        aoiRef.current = (await loadAoiPolygon()) ?? null;
      } else {
        aoiRef.current = null;
      }

      // Build managed layers list (basemaps + overlays). Catastro added later.
      const initial: ManagedLayer[] = [
        {
          id: "basemap:esri-imagery",
          label: "Esri Imagery",
          group: "Basemap",
          layer: basemaps["Esri Imagery"],
          exclusive: true,
        },
        {
          id: "basemap:esri-topo",
          label: "Esri Topo",
          group: "Basemap",
          layer: basemaps["Esri Topo"],
          exclusive: true,
        },
        {
          id: "basemap:carto-dark",
          label: "CARTO Dark",
          group: "Basemap",
          layer: basemaps["CARTO Dark"],
          exclusive: true,
        },
        {
          id: "basemap:opentopo",
          label: "OpenTopoMap",
          group: "Basemap",
          layer: basemaps["OpenTopoMap"],
          exclusive: true,
        },
        {
          id: "geochile:litologia",
          label: "SERNAGEOMIN Geología 1:1M",
          group: "Geología Chile",
          layer: sernageomin.geologia1M,
        },
        {
          id: "geochile:yacimientos",
          label: "Yacimientos & faenas (SERNAGEOMIN)",
          group: "Geología Chile",
          layer: sernageomin.yacimientos,
        },
        {
          id: "geochile:areas-protegidas",
          label: "Áreas protegidas SNASPE",
          group: "Geología Chile",
          layer: sernageomin.areasProtegidas,
        },
        {
          id: "sat:s2-truecolor",
          label: "Sentinel-2 color verdadero (10 m)",
          group: "Satelital",
          layer: satellite.sentinel2TrueColor,
        },
        {
          id: "sat:s2-ndvi",
          label: "Sentinel-2 vegetación / NDVI",
          group: "Satelital",
          layer: satellite.sentinel2NDVI,
        },
        {
          id: "sat:worldcover",
          label: "ESA WorldCover 2021 (10 m)",
          group: "Satelital",
          layer: satellite.worldCover,
        },
        {
          id: "sat:copernicus-dem",
          label: "Copernicus DEM (relieve)",
          group: "Satelital",
          layer: satellite.copernicusDem,
        },
        {
          id: "geo:macrostrat",
          label: "Macrostrat (global, fallback)",
          group: "Geología",
          layer: geoOverlays["Geología Macrostrat (global)"],
        },
        {
          id: "geo:prospect",
          label: "Ubicación del prospecto",
          group: "Geología",
          layer: (prospectLayerRef.current ??= L.layerGroup()),
        },
        {
          id: "geo:host-rock",
          label: "Host rock (unidades litológicas)",
          group: "Geología",
          layer: (lithologyLayerRef.current ??= L.layerGroup()),
        },
        {
          id: "geo:alteration",
          label: "Alteración hidrotermal",
          group: "Geología",
          layer: (alterationLayerRef.current ??= L.layerGroup()),
        },
        {
          id: "geophys:emag2",
          label: "Magnetometría EMAG2 (regional)",
          group: "Geofísica",
          layer: geophysicsWms["Magnetometría EMAG2 (regional)"],
        },
        {
          id: "geophys:wgm2012",
          label: "Gravimetría WGM2012 (regional)",
          group: "Geofísica",
          layer: geophysicsWms["Gravimetría Bouguer WGM2012 (regional)"],
        },
        {
          id: "geophys:hillshade",
          label: "Hillshade SRTM",
          group: "Geofísica",
          layer: geophysicsWms["Hillshade SRTM (Esri)"],
        },
        {
          id: "ext:usgs-quakes",
          label: "Sismos USGS (último mes, M≥2.5)",
          group: "Datos externos",
          layer: usgsLayer,
        },
        {
          id: "ext:osm-infra",
          label: "OSM caminos & edificios (vista actual)",
          group: "Datos externos",
          layer: overpassCtl.group,
        },
      ];
      setManagedLayers(initial);
      setMapReady(true);
      onMapReady?.(map, L);

      await loadCatastroData();
      if (cancelled) return;

      // Concesiones nacionales SERNAGEOMIN (lazy: solo se cargan cuando el usuario activa la capa)
      const tiposNac: ConcesionTipo[] = ["explotacion", "exploracion", "mensura", "manifestacion"];
      try {
        const b = map.getBounds();
        const bbox: [number, number, number, number] = [
          b.getWest(),
          b.getSouth(),
          b.getEast(),
          b.getNorth(),
        ];
        const nacLayers: ManagedLayer[] = [];
        for (const tipo of tiposNac) {
          const { layer, count } = await buildConcesionesNacionalesLayer(L, tipo, bbox);
          nacLayers.push({
            id: `sernageomin:${tipo}`,
            label: `SERNAGEOMIN ${tipo} (${count})`,
            group: "Catastro",
            layer,
          });
        }
        if (!cancelled)
          setManagedLayers((prev) => [
            ...prev.filter((p) => !p.id.startsWith("sernageomin:")),
            ...nacLayers,
          ]);
      } catch (err) {
        console.warn("[sernageomin] failed:", err);
      }

      wireGeoIntelClickPopup(L, map, fetchMacrostratUnit, () => targetsRef.current);

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
    // onMapReady is intentionally omitted to avoid recreating Leaflet for inline callbacks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadCatastroData, legacyStaticProjectFeatures, mapCenter]);

  // Build geophysics layers (planned/synthetic + real captured) for the active project
  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!L || !map || !geoph) return;

    const surveys = geoph.surveys;
    const surveyIds = new Set(surveys.map((s) => s.id));
    const linesAll = geoph.lines.filter((l) => l.survey_id == null || surveyIds.has(l.survey_id));
    const stationsAll = geoph.stations.filter(
      (s) => s.survey_id == null || surveyIds.has(s.survey_id),
    );

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

  // Build geology feature layers (host rock + alteration) from geological_features
  useEffect(() => {
    const L = leafletRef.current;
    if (!L || !mapReady || !geologyMap) return;
    const lithoLG = lithologyLayerRef.current;
    const altLG = alterationLayerRef.current;
    lithoLG?.clearLayers();
    altLG?.clearLayers();

    const built = buildGeologyFeatureLayers(L, geologyMap);
    built.lithologyLayer.eachLayer((l) => lithoLG?.addLayer(l));
    built.alterationLayer.eachLayer((l) => altLG?.addLayer(l));

    setLithoLegend(built.lithologyLegend);
    setAltLegend(built.alterationLegend);
  }, [geologyMap, mapReady]);

  // Render prospect location marker (project center)
  useEffect(() => {
    const L = leafletRef.current;
    const layer = prospectLayerRef.current;
    if (!L || !layer || !mapReady) return;
    layer.clearLayers();
    const lat = active?.center_lat;
    const lng = active?.center_lng;
    if (lat == null || lng == null) return;

    const icon = L.divIcon({
      html: `<div style="position:relative;width:36px;height:36px;">
        <div style="position:absolute;inset:0;border-radius:50%;background:radial-gradient(circle,rgba(240,201,107,0.45) 0%,rgba(240,201,107,0) 70%);animation:prospect-pulse 2.4s ease-out infinite;"></div>
        <svg viewBox="0 0 24 24" width="36" height="36" style="position:absolute;inset:0;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.6));">
          <path d="M12 2 L14.5 9 L22 9.3 L16 14 L18 21.5 L12 17.3 L6 21.5 L8 14 L2 9.3 L9.5 9 Z"
                fill="#F0C96B" stroke="#3a2f1f" stroke-width="1" stroke-linejoin="round"/>
        </svg>
      </div>`,
      className: "prospect-marker-icon",
      iconSize: [36, 36],
      iconAnchor: [18, 18],
    });

    const m = L.marker([lat, lng], { icon, zIndexOffset: 1000 });
    m.bindTooltip(
      `<strong>${active?.name ?? "Prospecto"}</strong><br/><span style="color:#A89080;">${active?.code ?? ""}${active?.commodity ? ` · ${active.commodity}` : ""}</span>`,
      { direction: "top", offset: [0, -18], className: "geo-tooltip" },
    );
    m.bindPopup(`<div style="font-family:'IBM Plex Mono',monospace;font-size:11px;line-height:1.5;max-width:240px;">
      <strong style="color:#F0C96B;">${active?.name ?? "Prospecto"}</strong><br/>
      <span style="color:#A89080;">${active?.code ?? ""}</span><br/>
      ${active?.commodity ? `Commodity: ${active.commodity}<br/>` : ""}
      ${active?.region ? `Región: ${active.region}<br/>` : ""}
      Lat/Lng: ${lat.toFixed(5)}, ${lng.toFixed(5)}
    </div>`);
    layer.addLayer(m);
  }, [
    active?.id,
    active?.center_lat,
    active?.center_lng,
    active?.name,
    active?.code,
    active?.commodity,
    active?.region,
    mapReady,
  ]);

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
    const layer = buildDrillCollarsLayer(L, drillHoles, scoresByHole, scoreToHaloStyle);
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
  }, [drillHoles, scoresByHole, active?.id]);
  // Build samples layer for the active project
  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!L || !map || !samples) return;
    if (samplesLayerRef.current) {
      map.removeLayer(samplesLayerRef.current);
      samplesLayerRef.current = null;
    }
    const layer = buildSamplesLayer(L, samples, {
      onClick: (s) => onInspect?.({ kind: "sample", data: s }),
    });
    samplesLayerRef.current = layer;
    if (samples.length > 0) layer.addTo(map);
    setManagedLayers((prev) => {
      const without = prev.filter((p) => p.id !== "samples:project");
      return [
        ...without,
        {
          id: "samples:project",
          label: `Muestras (${samples.length})`,
          group: "Proyecto",
          layer,
        },
      ];
    });
  }, [samples, onInspect]);

  // Drone flights + rasters layer
  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!L || !map) return;
    if (droneLayerRef.current) {
      map.removeLayer(droneLayerRef.current);
      droneLayerRef.current = null;
    }
    const layer = buildDroneLayer(L, droneFlights, droneRasters, {
      onFlightClick: (f) => onInspect?.({ kind: "drone_flight", data: f }),
      onRasterClick: (r) => onInspect?.({ kind: "drone_raster", data: r }),
    });
    droneLayerRef.current = layer;
    if (droneFlights.length > 0 || droneRasters.length > 0) layer.addTo(map);
    setManagedLayers((prev) => {
      const without = prev.filter((p) => p.id !== "drones:flights");
      return [
        ...without,
        {
          id: "drones:flights",
          label: `Drones (${droneFlights.length} vuelos · ${droneRasters.length} rasters)`,
          group: "Geofísica",
          layer,
        },
      ];
    });
  }, [droneFlights, droneRasters, onInspect]);

  // Exploration targets layer (Fase 2 → mapa)
  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!L || !map) return;
    if (targetsLayerRef.current) {
      map.removeLayer(targetsLayerRef.current);
      targetsLayerRef.current = null;
    }
    const layer = buildTargetsLayer(L, targets, {
      onClick: (t) => onInspect?.({ kind: "target", data: t }),
    });
    targetsLayerRef.current = layer;
    if (targets.length > 0) layer.addTo(map);
    setManagedLayers((prev) => {
      const without = prev.filter((p) => p.id !== "targets:project");
      return [
        ...without,
        {
          id: "targets:project",
          label: `Targets exploración (${targets.length})`,
          group: "Proyecto",
          layer,
        },
      ];
    });
  }, [targets, onInspect]);

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
    map.setView(mapCenter, 16, { animate: true });
  }, [mapCenter]);

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
      const line = L.polyline(measurePointsRef.current, {
        color: "#F5A524",
        weight: 3,
        dashArray: "5 5",
      });
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
    <div className={fillHeight ? "h-full flex flex-col" : "space-y-3"}>
      <div
        ref={wrapperRef}
        className={`relative ${fillHeight ? "flex-1 min-h-0" : ""} ${isFullscreen ? "h-screen w-screen bg-background" : ""}`}
        data-geo-workbench="official-2d"
        data-geo-preset={initialPreset}
        data-legacy-static-project-features={legacyStaticProjectFeatures ? "true" : "false"}
      >
        <div
          ref={containerRef}
          data-export-map
          className={`${fillHeight || isFullscreen ? "h-full" : "h-72 md:h-96"} w-full ${fillHeight ? "" : "rounded border border-border"} overflow-hidden bg-bg-secondary`}
          style={{ zIndex: 0 }}
        />

        {/* Unified vertical toolbar (top-right) */}
        <div className="absolute top-3 right-3 z-[500] flex flex-col gap-1.5" data-map-toolbar>
          <button
            type="button"
            onClick={toggleFullscreen}
            className="w-9 h-9 inline-flex items-center justify-center rounded border border-border bg-background/95 backdrop-blur text-foreground hover:bg-accent shadow-md transition-colors"
            title="Pantalla completa (F)"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
          {!layersOpen && (
            <button
              type="button"
              onClick={() => {
                setLayersOpen(true);
                setToolsOpen(false);
                setDrawOpen(false);
              }}
              className="w-9 h-9 inline-flex items-center justify-center rounded border border-border bg-background/95 backdrop-blur text-foreground hover:bg-accent shadow-md transition-colors"
              title="Capas y opacidad (L)"
            >
              <Layers className="w-4 h-4" />
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setDrawOpen((v) => !v);
              setToolsOpen(false);
              setLayersOpen(false);
            }}
            className={`w-9 h-9 inline-flex items-center justify-center rounded border border-border ${drawOpen ? "bg-primary text-primary-foreground" : "bg-background/95 text-foreground hover:bg-accent"} backdrop-blur shadow-md transition-colors`}
            title="Dibujo (D)"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={toggleMeasure}
            className={`w-9 h-9 inline-flex items-center justify-center rounded border ${measuring ? "border-gold bg-gold/10 text-gold" : "border-border bg-background/95 text-foreground hover:bg-accent"} backdrop-blur shadow-md transition-colors`}
            title="Medir distancia (M)"
          >
            <Ruler className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              setToolsOpen((v) => !v);
              setLayersOpen(false);
              setDrawOpen(false);
            }}
            className={`w-9 h-9 inline-flex items-center justify-center rounded border border-border ${toolsOpen ? "bg-primary text-primary-foreground" : "bg-background/95 text-foreground hover:bg-accent"} backdrop-blur shadow-md transition-colors`}
            title="Más herramientas"
          >
            <Wrench className="w-4 h-4" />
          </button>
        </div>

        {toolsOpen && (
          <div className="absolute top-3 right-14 z-[500] w-60 rounded border border-border bg-background/95 backdrop-blur shadow-lg p-3 text-xs font-mono space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-foreground font-semibold uppercase tracking-wide">Gestión</span>
              <button
                type="button"
                onClick={() => setToolsOpen(false)}
                className="text-muted-foreground hover:text-foreground"
                aria-label="Cerrar"
              >
                ✕
              </button>
            </div>
            <div className="space-y-1.5">
              <div className="text-muted-foreground/70 text-[10px] uppercase">Navegación</div>
              <button
                type="button"
                onClick={centerOnAoi}
                className="w-full inline-flex items-center gap-2 px-2 py-1.5 rounded border border-border bg-bg-secondary text-foreground hover:bg-accent transition-colors"
              >
                <Crosshair className="w-3.5 h-3.5" /> Centrar en AOI
              </button>
              {measureDist != null && (
                <div className="flex items-center justify-between text-[10px] px-2 py-1 rounded bg-bg-secondary border border-border">
                  <span className="text-muted-foreground">Distancia</span>
                  <span className="text-foreground font-semibold">
                    {(measureDist / 1000).toFixed(2)} km
                  </span>
                  <button
                    type="button"
                    onClick={clearMeasure}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>
            <div className="space-y-1.5 border-t border-border pt-2">
              <div className="text-muted-foreground/70 text-[10px] uppercase">Catastro</div>
              <button
                type="button"
                onClick={handleExportPdf}
                disabled={Object.values(counts).every((n) => !n)}
                className="w-full inline-flex items-center gap-2 px-2 py-1.5 rounded border border-border bg-bg-secondary text-foreground hover:bg-accent disabled:opacity-50 transition-colors"
              >
                <Download className="w-3.5 h-3.5" /> PDF pertenencias
              </button>
              <button
                type="button"
                onClick={handleRefresh}
                disabled={refreshing}
                className="w-full inline-flex items-center gap-2 px-2 py-1.5 rounded border border-border bg-bg-secondary text-foreground hover:bg-accent disabled:opacity-50 transition-colors"
              >
                ↻ {refreshing ? "Refrescando…" : "Refrescar catastro"}
              </button>
            </div>
            <div className="text-[10px] text-muted-foreground/70 border-t border-border pt-2">
              Atajos: <strong>F</strong> pantalla · <strong>M</strong> medir · <strong>L</strong>{" "}
              capas · <strong>D</strong> dibujo
            </div>
          </div>
        )}

        <CatastroSearch map={mapRef.current} L={leafletRef.current} />

        <DrawingTools
          open={drawOpen}
          onClose={() => setDrawOpen(false)}
          map={mapRef.current}
          L={leafletRef.current}
        />

        <LayerOpacityPanel
          open={layersOpen}
          onClose={() => setLayersOpen(false)}
          map={mapRef.current}
          layers={managedLayers}
          state={layerState}
          onVisible={setVisible}
          onOpacity={setOpacity}
          presetLabel={presetLabel}
        />

        {mapReady && <CoordinateFooter map={mapRef.current} />}
      </div>

      {!fillHeight && (
        <>
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono">
            <span className="text-muted-foreground/70">Catastro 8 km AOI:</span>
            {ORIGEN_ORDER.map(renderChip)}
            <a
              href={`https://appsngmaz.sernageomin.cl/catastro_SNGM/home/index?lat=${mapCenter[0]}&lng=${mapCenter[1]}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-border bg-bg-secondary text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors"
              title="Abrir el visor oficial de SERNAGEOMIN"
            >
              ↗ Visor SERNAGEOMIN
            </a>
          </div>

          {legacyStaticProjectFeatures && (
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
                <span
                  className="w-2.5 h-2.5 bg-copper inline-block"
                  style={{ transform: "rotate(45deg)" }}
                />{" "}
                Labor antigua
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm border-2 border-info" /> Collar DDH
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-info border border-background" /> Collar
                sondaje ({drillHoles.length})
              </span>
              <span
                className="inline-flex items-center gap-1.5"
                title="Halo = mejor intercept (Au g/t × m)"
              >
                <span className="text-muted-foreground/70">Halo GT:</span>
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ background: "#86efac" }}
                  title="≤5"
                />
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ background: "#bef264" }}
                  title="5–20"
                />
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ background: "#fbbf24" }}
                  title="20–50"
                />
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ background: "#fb923c" }}
                  title="50–150"
                />
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ background: "#dc2626" }}
                  title=">150"
                />
                <span className="text-muted-foreground/70">g·m/t</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span
                  className="w-3 h-0.5"
                  style={{ background: "#E11D48", borderTop: "1px dashed #E11D48" }}
                />{" "}
                Línea geofísica
              </span>
              <span className="text-muted-foreground/70">
                · panel <strong>Capas</strong> arriba-derecha controla visibilidad y opacidad
              </span>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <MagnetometryLegend stats={magStats} />
            <GeologyLegend hostRock={lithoLegend} alteration={altLegend} />
          </div>
        </>
      )}
    </div>
  );
}
