// GeoSceneCanvas — canvas unificado MapLibre + deck.gl con terreno 3D.
// Consume ids del Canonical Geospatial Layer Registry y separa evidencia medida,
// derivada, interpretada y propuesta antes de renderizar.
import { useEffect, useMemo, useRef, useState } from "react";
import maplibregl, { Map as MapLibreMap } from "maplibre-gl";
import { MapboxOverlay } from "@deck.gl/mapbox";
import { GeoJsonLayer, PolygonLayer } from "@deck.gl/layers";
import { SimpleMeshLayer } from "@deck.gl/mesh-layers";
import { COORDINATE_SYSTEM, type Layer } from "@deck.gl/core";
import { buildCadTerrainMesh } from "../cadTerrainMesh";
import { cadElevationSampler, drapeFeatureCollection, type ElevationSampler } from "../terrainDrape";
import { discRing, planeFromProperties } from "../structuralPlanes";
import { SPECTRAL_LAYER_IDS, spectralFill } from "../spectralStyle";
import { indexRange, rampColor, type ProcessedIndex } from "../processedSceneStyle";
import type { FeatureCollection } from "geojson";
import { Loader2 } from "lucide-react";
import type { ProjectView } from "@/lib/projects/navigation";
import { projectCamera } from "../cameraPolicy";
import { useAuth } from "@/hooks/useAuth";
import "maplibre-gl/dist/maplibre-gl.css";

import { useProjects } from "@/hooks/useProjects";
import type { GeoSnapshotViewState } from "@/lib/geospatial/snapshotManifest";
import { useTargetsLayer } from "./useTargetsLayer";
import { useDrillHolesLayer } from "./useDrillHolesLayer";
import { useDrillTrajectoriesLayer } from "./useDrillTrajectoriesLayer";
import { useGeophysAnomaliesLayer } from "./useGeophysAnomaliesLayer";
import { useSatAnomaliesLayer } from "./useSatAnomaliesLayer";
import { useWireframesLayer } from "./useWireframesLayer";
import { findAnchor } from "./anchorRegistry";
import { SCENE_FOCUS_EVENT, type SceneFocusDetail } from "../anchors";
import { sceneBindingsForMode, sceneLayerEnabled } from "../layerPolicy";
import type { GeoSceneFilters, GeoSceneMode } from "../types";
import { sceneFilterManifest } from "../filterPolicy";
import {
  evidenceColor,
  isDashedEvidence,
  projectLayerTooltip,
  resolveProjectLayers,
  type GeoSceneProject,
  type GeoSceneProjectLayer,
  type ResolvedProjectLayer,
} from "../projectLayers";

export interface ProcessedSceneOverlay {
  data: FeatureCollection;
  index: ProcessedIndex;
  opacity: number;
}

interface Props {
  view?: ProjectView;
  mode: GeoSceneMode;
  visibleLayerIds: ReadonlySet<string>;
  filters?: GeoSceneFilters;
  project?: GeoSceneProject;
  projectLayers?: GeoSceneProjectLayer[];
  layerOpacity?: Readonly<Record<string, number>>;
  processedScene?: ProcessedSceneOverlay | null;
}

// Base MapLibre + DEM Terrarium servido por proxy propio.
const MAP_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
  sources: {
    basemap: {
      type: "raster",
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
      attribution: "© Esri World Imagery",
      maxzoom: 19,
    },
    terrainDEM: {
      type: "raster-dem",
      tiles: ["/api/terrain/{z}/{x}/{y}"],
      tileSize: 256,
      encoding: "terrarium",
      maxzoom: 15,
      attribution: "© AWS Terrain Tiles",
    },
  },
  layers: [{ id: "basemap", type: "raster", source: "basemap" }],
  sky: {
    "sky-color": "#0a1224",
    "sky-horizon-blend": 0.5,
    "horizon-color": "#1a2a4a",
    "horizon-fog-blend": 0.5,
    "fog-color": "#0a1224",
    "fog-ground-blend": 0.1,
  },
};

function mapSnapshotViewState(map: MapLibreMap): GeoSnapshotViewState {
  const center = map.getCenter();
  const bounds = map.getBounds();
  return {
    center: { lng: center.lng, lat: center.lat },
    bounds: {
      west: bounds.getWest(),
      south: bounds.getSouth(),
      east: bounds.getEast(),
      north: bounds.getNorth(),
    },
    zoom: map.getZoom(),
    pitch: map.getPitch(),
    bearing: map.getBearing(),
  };
}

export function GeoSceneCanvas({
  view = "3d",
  mode,
  visibleLayerIds,
  filters,
  project,
  projectLayers,
  layerOpacity,
  processedScene,
}: Props) {
  const { active: activeProject } = useProjects();
  const { user } = useAuth();
  const active = project
    ? { id: project.id, center_lng: project.center[0], center_lat: project.center[1] }
    : activeProject;
  const mapDiv = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const overlayRef = useRef<MapboxOverlay | null>(null);
  const [ready, setReady] = useState(false);
  const [snapshotViewState, setSnapshotViewState] = useState<GeoSnapshotViewState | null>(null);

  const surfaceMode = mode === "surface";
  const subsurfaceMode = mode === "subsurface";
  const centerLng = Number(active?.center_lng ?? -70.5);
  const centerLat = Number(active?.center_lat ?? -30);

  const terrainVisible = sceneLayerEnabled(visibleLayerIds, "terrain");
  const targetsVisible =
    (surfaceMode || subsurfaceMode) && sceneLayerEnabled(visibleLayerIds, "targets");
  const satelliteVisible = surfaceMode && sceneLayerEnabled(visibleLayerIds, "satellite_anomalies");
  const completedDrillingVisible =
    subsurfaceMode && sceneLayerEnabled(visibleLayerIds, "drillholes_completed");
  const proposedDrillingVisible =
    subsurfaceMode && sceneLayerEnabled(visibleLayerIds, "drillholes_proposed");
  const interceptsVisible =
    subsurfaceMode && sceneLayerEnabled(visibleLayerIds, "drill_intercepts");
  const geophysicsVisible =
    subsurfaceMode && sceneLayerEnabled(visibleLayerIds, "geophysics_anomalies");
  const wireframesVisible =
    subsurfaceMode && sceneLayerEnabled(visibleLayerIds, "geology_wireframes");
  // Public bundles supply public evidence; private scene hooks stay session-scoped.
  const privateProjectId = user ? (active?.id ?? null) : null;
  const hasProjectLayer = (id: string) => projectLayers?.some((layer) => layer.id === id) ?? false;

  const { layer: targetsLayer } = useTargetsLayer(
    privateProjectId,
    targetsVisible && !hasProjectLayer("targets.exploration"),
    filters,
  );
  const {
    layers: holeColumnLayers,
    completedCount: completedCollarCount,
    proposedCount: proposedCollarCount,
  } = useDrillHolesLayer(
    privateProjectId,
    centerLng,
    centerLat,
    {
      completed: completedDrillingVisible,
      proposed: proposedDrillingVisible,
    },
    filters,
  );

  const {
    layers: trajectoryLayers,
    completedCount: completedTrajectoryCount,
    proposedCount: proposedTrajectoryCount,
    interceptCount,
  } = useDrillTrajectoriesLayer(
    privateProjectId,
    centerLng,
    centerLat,
    {
      completed: completedDrillingVisible,
      proposed: proposedDrillingVisible,
      intercepts: interceptsVisible,
    },
    filters,
  );

  const { layer: anomaliesLayer, count: anomaliesCount } = useGeophysAnomaliesLayer(
    privateProjectId,
    geophysicsVisible && !hasProjectLayer("geophysics.anomalies"),
  );
  const { layer: satAnomaliesLayer, count: satAnomaliesCount } = useSatAnomaliesLayer(
    privateProjectId,
    satelliteVisible && !hasProjectLayer("remote_sensing.sentinel2_alteration"),
  );
  const { layers: wireframeLayers, count: wireframeCount } = useWireframesLayer(
    privateProjectId,
    centerLng,
    centerLat,
    wireframesVisible,
  );

  const cadTerrain = project?.cadTerrain ?? null;
  const cadMesh = useMemo(
    () => (cadTerrain ? buildCadTerrainMesh(cadTerrain.tile, cadTerrain.imagery?.bbox) : null),
    [cadTerrain],
  );
  const cadTerrainLayer = useMemo(() => {
    if (!cadTerrain || !cadMesh || !terrainVisible || mode === "resource") return null;
    const { tile } = cadTerrain;
    return new SimpleMeshLayer({
      id: "project:cad-terrain",
      data: [{ position: [0, 0, 0] }],
      coordinateSystem: COORDINATE_SYSTEM.METER_OFFSETS,
      coordinateOrigin: [Number(tile.centerLng), Number(tile.centerLat), 0],
      mesh: {
        attributes: {
          positions: { value: cadMesh.positions, size: 3 },
          normals: { value: cadMesh.normals, size: 3 },
          ...(cadTerrain.imagery
            ? { texCoords: { value: cadMesh.texCoords, size: 2 } }
            : { colors: { value: cadMesh.colors, size: 4 } }),
        },
        indices: { value: cadMesh.indices, size: 1 },
      } as never,
      getPosition: (d: { position: [number, number, number] }) => d.position,
      texture: cadTerrain.imagery?.url,
      getColor: [255, 255, 255, 235],
      opacity: 0.92,
      material: { ambient: 0.45, diffuse: 0.6, shininess: 8, specularColor: [40, 40, 40] },
    });
  }, [cadTerrain, cadMesh, terrainVisible, mode]);

  // Elevation used to drape 2D layers onto the relief actually rendered.
  // CAD tile when present (absolute heights), MapLibre DEM otherwise; none in Planta.
  const [terrainEpoch, setTerrainEpoch] = useState(0);
  const demActive = terrainVisible && !cadTerrain && view === "3d";
  const drape = useMemo((): { sample: ElevationSampler; fallback: number } | null => {
    if (view !== "3d" || !terrainVisible) return null;
    if (cadTerrain) {
      const t = cadTerrain.tile;
      return { sample: cadElevationSampler(t), fallback: t.referenceElevationM + t.minH };
    }
    const map = mapRef.current as unknown as {
      terrain?: { getElevationForLngLatZoom?: (ll: maplibregl.LngLat, z: number) => number };
    } | null;
    const terrain = map?.terrain;
    if (!terrain?.getElevationForLngLatZoom || terrainEpoch === 0) return null;
    const zoom = Math.min(14, Math.max(8, Math.round(mapRef.current?.getZoom() ?? 12)));
    const sample: ElevationSampler = (lng, lat) => {
      const h = terrain.getElevationForLngLatZoom!(new maplibregl.LngLat(lng, lat), zoom);
      return Number.isFinite(h) && h !== 0 ? h : null;
    };
    return { sample, fallback: sample(centerLng, centerLat) ?? 0 };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, terrainVisible, cadTerrain, terrainEpoch, demActive]);

  const resolvedProjectLayers = useMemo(() => resolveProjectLayers(projectLayers), [projectLayers]);
  const projectGeoLayers = useMemo(() => {
    if (mode === "resource") return [];
    return resolvedProjectLayers
      .filter((layer) => visibleLayerIds.has(layer.id))
      .map((layer) => {
        const color = evidenceColor(layer.definition.evidence);
        const dashed = isDashedEvidence(layer.definition.evidence);
        const spectral = SPECTRAL_LAYER_IDS.has(layer.id);
        const rgb: [number, number, number] = [color[0], color[1], color[2]];
        const data = drape
          ? drapeFeatureCollection(layer.data as FeatureCollection, drape.sample, {
              fallback: drape.fallback,
            })
          : layer.data;
        return new GeoJsonLayer({
          id: `project:${layer.id}`,
          data: data as never,
          pickable: true,
          stroked: true,
          filled: true,
          opacity: layerOpacity?.[layer.id] ?? 1,
          getFillColor: spectral
            ? (f: { properties?: Record<string, unknown> }) => spectralFill(f.properties, rgb)
            : [color[0], color[1], color[2], dashed ? 20 : 45],
          getLineColor: spectral
            ? (f: { properties?: Record<string, unknown> }) => {
                const c = spectralFill(f.properties, rgb);
                return [c[0], c[1], c[2], 230];
              }
            : color,
          getLineWidth: dashed ? 1.5 : 2.5,
          lineWidthUnits: "pixels",
          pointType: "circle",
          getPointRadius: 6,
          pointRadiusUnits: "pixels",
          pointRadiusMinPixels: 4,
          parameters: { depthTest: false } as never,
          updateTriggers: { getLineColor: layer.definition.evidence },
          // keep a reference for tooltips
          ...({ geoProjectLayer: layer } as Record<string, unknown>),
        });
      });
  }, [mode, resolvedProjectLayers, visibleLayerIds, layerOpacity, drape]);

  // Discos estructurales: rumbo/manteo de terreno como planos orientados.
  const structurePlaneLayer = useMemo(() => {
    if (mode === "resource" || view !== "3d" || !visibleLayerIds.has("geology.structures")) return null;
    const source = resolvedProjectLayers.find((l) => l.id === "geology.structures");
    if (!source) return null;
    const discs: { code: string; ring: [number, number, number][]; label: string }[] = [];
    for (const f of (source.data as FeatureCollection).features) {
      const plane = planeFromProperties(f.properties as Record<string, unknown>);
      if (!plane || f.geometry?.type !== "LineString") continue;
      const c = f.geometry.coordinates;
      const lng = (c[0][0] + c[c.length - 1][0]) / 2;
      const lat = (c[0][1] + c[c.length - 1][1]) / 2;
      const z = (drape?.sample(lng, lat) ?? drape?.fallback ?? 0) + 4;
      discs.push({
        code: plane.code,
        ring: discRing([lng, lat, z], plane, 38),
        label: `${plane.code} · rumbo ${Math.round(plane.strikeDeg)}° · manteo ${plane.dipDeg}° → ${Math.round(plane.dipDirectionDeg)}°`,
      });
    }
    if (!discs.length) return null;
    const color = evidenceColor(source.definition.evidence);
    return new PolygonLayer({
      id: "geology.structure_planes",
      data: discs,
      getPolygon: (d: (typeof discs)[number]) => d.ring,
      filled: true,
      stroked: true,
      getFillColor: [color[0], color[1], color[2], 110],
      getLineColor: [color[0], color[1], color[2], 255],
      getLineWidth: 2,
      lineWidthUnits: "pixels",
      pickable: true,
      parameters: { depthTest: false } as never,
    });
  }, [mode, view, visibleLayerIds, resolvedProjectLayers, drape]);

  // Anomalías extruidas: la base se apoya en el relieve, no en cota 0.
  const drapedSatLayer = useMemo(() => {
    if (!satAnomaliesLayer || !drape) return satAnomaliesLayer;
    type P = { rings: number[][][]; centroidLng: number; centroidLat: number };
    return (satAnomaliesLayer as Layer).clone({
      getPolygon: (d: P) => {
        const z = drape.sample(d.centroidLng, d.centroidLat) ?? drape.fallback;
        return d.rings.map((r) => r.map((p) => [p[0], p[1], z]));
      },
      updateTriggers: { getPolygon: [drape] },
    } as never);
  }, [satAnomaliesLayer, drape]);

  // Escena Sentinel-2 procesada por el pipeline del proyecto (índices reales,
  // malla de visualización). Se drapea sobre DEM/CAD sin test de profundidad.
  const processedLayer = useMemo(() => {
    if (!processedScene || mode === "resource") return null;
    const { data, index, opacity } = processedScene;
    const range = indexRange(data, index);
    return new GeoJsonLayer({
      id: "project:sentinel2-processed",
      data: (drape
        ? drapeFeatureCollection(data, drape.sample, { fallback: drape.fallback, offsetM: 3 })
        : data) as never,
      pickable: true,
      stroked: false,
      filled: true,
      opacity,
      getFillColor: (f: { properties?: Record<string, unknown> }) => {
        const v = Number(f.properties?.[index]);
        if (!Number.isFinite(v) || v === -9999) return [0, 0, 0, 0];
        const c = rampColor(v, range);
        return [c[0], c[1], c[2], 210];
      },
      parameters: { depthTest: false } as never,
      updateTriggers: { getFillColor: [index, range[0], range[1]] },
    });
  }, [processedScene, mode, drape]);

  useEffect(() => {
    if (!mapDiv.current || mapRef.current) return;

    const center: [number, number] = [
      Number(active?.center_lng ?? -70.5),
      Number(active?.center_lat ?? -30),
    ];
    const map = new maplibregl.Map({
      container: mapDiv.current,
      style: MAP_STYLE,
      center,
      zoom: 11,
      ...projectCamera(view),
      maxPitch: 80,
      attributionControl: { compact: true },
    });

    const syncSnapshotViewState = () => setSnapshotViewState(mapSnapshotViewState(map));

    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "bottom-left");
    map.on("load", () => {
      const overlay = new MapboxOverlay({
        interleaved: false,
        layers: [],
        getTooltip: (info: {
          layer?: { props?: Record<string, unknown> } | null;
          object?: { properties?: Record<string, unknown> } | null;
        }) => {
          const projectLayer = info.layer?.props?.geoProjectLayer as
            ResolvedProjectLayer | undefined;
          if (!projectLayer || !info.object) return null;
          return projectLayerTooltip(projectLayer, info.object.properties);
        },
      } as never);
      map.addControl(overlay as unknown as maplibregl.IControl);
      overlayRef.current = overlay;
      if (project?.bbox) {
        const [w, so, e, n] = project.bbox;
        map.fitBounds(
          [
            [w, so],
            [e, n],
          ],
          { padding: 45, ...projectCamera(view), duration: 0 },
        );
      }
      syncSnapshotViewState();
      setReady(true);
    });
    map.on("moveend", syncSnapshotViewState);
    // Re-drape once DEM tiles for the current view have loaded.
    let lastDrapeKey = "";
    map.on("idle", () => {
      if (!map.getTerrain()) return;
      const c = map.getCenter();
      const key = `${c.lng.toFixed(4)},${c.lat.toFixed(4)},${Math.round(map.getZoom())}`;
      if (key === lastDrapeKey) return; // avoid idle → re-render → idle loops
      lastDrapeKey = key;
      setTerrainEpoch((n) => n + 1);
    });

    map.on("error", (event: { error?: { message?: string } }) => {
      const message = event?.error?.message ?? "";
      if (/terrain|raster-dem|terrainDEM/i.test(message)) {
        try {
          map.setTerrain(null);
        } catch {
          // El basemap con pitch sigue disponible si falla el DEM.
        }
      }
    });

    mapRef.current = map;
    return () => {
      map.off("moveend", syncSnapshotViewState);
      map.remove();
      mapRef.current = null;
      overlayRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    // Planta locks the camera to nadir so mouse/touch gestures cannot drift
    // the view into perspective while the selector says "Planta".
    const plan = view === "2d";
    map.setMaxPitch(plan ? 0 : 80);
    if (plan) {
      map.dragRotate.disable();
      map.touchZoomRotate.disableRotation();
      map.touchPitch.disable();
      map.keyboard.disableRotation();
    } else {
      map.dragRotate.enable();
      map.touchZoomRotate.enableRotation();
      map.touchPitch.enable();
      map.keyboard.enableRotation();
    }
    map.easeTo({
      ...projectCamera(view),
      duration: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 500,
    });
  }, [ready, view]);

  useEffect(() => {
    const element = mapDiv.current;
    if (!element) return;
    const observer = new ResizeObserver(() => mapRef.current?.resize());
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!ready || !mapRef.current) return;
    try {
      mapRef.current.setTerrain(
        // CAD terrain replaces the global DEM; the two are never fused.
        // In Planta the DEM is not rendered (layer selection is preserved).
        terrainVisible && !cadTerrain && view === "3d"
          ? { source: "terrainDEM", exaggeration: 1.5 }
          : null,
      );
    } catch {
      try {
        mapRef.current.setTerrain(null);
      } catch {
        // Fail-safe: canvas 2D con pitch.
      }
    }
  }, [ready, terrainVisible, cadTerrain, view]);

  useEffect(() => {
    if (project?.bbox) return;
    if (!mapRef.current || !active?.center_lat || !active?.center_lng) return;
    mapRef.current.flyTo({
      center: [Number(active.center_lng), Number(active.center_lat)],
      zoom: 11,
      ...projectCamera(view),
      duration: 1200,
    });
  }, [active?.id, active?.center_lat, active?.center_lng]);

  useEffect(() => {
    if (!ready || !overlayRef.current) return;
    const layers = [
      cadTerrainLayer,
      processedLayer,
      ...projectGeoLayers,
      structurePlaneLayer,
      targetsLayer,
      drapedSatLayer,
      ...holeColumnLayers,
      ...trajectoryLayers,
      ...wireframeLayers,
      anomaliesLayer,
    ].filter(Boolean);
    overlayRef.current.setProps({ layers });
  }, [
    ready,
    cadTerrainLayer,
    processedLayer,
    projectGeoLayers,
    structurePlaneLayer,
    targetsLayer,
    drapedSatLayer,
    holeColumnLayers,
    trajectoryLayers,
    wireframeLayers,
    anomaliesLayer,
  ]);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<SceneFocusDetail>).detail;
      if (!detail || !mapRef.current) return;
      const anchor = findAnchor(detail.kind, detail.code);
      if (!anchor) return;

      mapRef.current.flyTo({
        center: [anchor.lng, anchor.lat],
        zoom: 14.5,
        ...projectCamera(view),
        speed: 1.4,
        essential: true,
      });
    };
    window.addEventListener(SCENE_FOCUS_EVENT, handler);
    return () => window.removeEventListener(SCENE_FOCUS_EVENT, handler);
  }, [view]);

  const layerCount = useMemo(
    () =>
      [
        cadTerrainLayer,
        ...projectGeoLayers,
        targetsLayer,
        satAnomaliesLayer,
        ...holeColumnLayers,
        ...trajectoryLayers,
        ...wireframeLayers,
        anomaliesLayer,
      ].filter(Boolean).length,
    [
      cadTerrainLayer,
      projectGeoLayers,
      targetsLayer,
      satAnomaliesLayer,
      holeColumnLayers,
      trajectoryLayers,
      wireframeLayers,
      anomaliesLayer,
    ],
  );

  const canonicalManifest = useMemo(() => {
    const availableBindings: Record<string, boolean> = {
      terrain: terrainVisible,
      targets: Boolean(targetsLayer),
      satellite_anomalies: Boolean(satAnomaliesLayer),
      drillholes_completed: completedCollarCount + completedTrajectoryCount > 0,
      drillholes_proposed: proposedCollarCount + proposedTrajectoryCount > 0,
      drill_intercepts: interceptCount > 0,
      geophysics_anomalies: Boolean(anomaliesLayer),
      geology_wireframes: wireframeCount > 0,
    };
    const rendered = sceneBindingsForMode(mode)
      .filter(
        (binding) => visibleLayerIds.has(binding.canonicalId) && availableBindings[binding.key],
      )
      .map((binding) => binding.canonicalId as string);
    const projectIds =
      mode === "resource"
        ? []
        : resolvedProjectLayers.filter((l) => visibleLayerIds.has(l.id)).map((l) => l.id as string);
    return Array.from(new Set(["basemap.esri_imagery", ...rendered, ...projectIds]))
      .sort()
      .join(",");
  }, [
    mode,
    visibleLayerIds,
    resolvedProjectLayers,
    terrainVisible,
    targetsLayer,
    satAnomaliesLayer,
    completedCollarCount,
    completedTrajectoryCount,
    proposedCollarCount,
    proposedTrajectoryCount,
    interceptCount,
    anomaliesLayer,
    wireframeCount,
  ]);
  const filterManifest = useMemo(
    () => sceneFilterManifest(filters),
    [filters?.campaignId, filters?.highGradeOnly, filters?.timeCursor],
  );

  return (
    <div
      className="relative h-full w-full"
      data-geo-engine="deckgl"
      data-geo-mode={view}
      data-geo-project-id={active?.id ?? undefined}
      data-geo-crs="EPSG:4326"
      data-geo-layer-ids={canonicalManifest}
      data-geo-filters={filterManifest}
      data-geo-view-state={snapshotViewState ? JSON.stringify(snapshotViewState) : undefined}
      data-geo-scene-mode={mode}
      data-geo-terrain-source={
        cadTerrain && terrainVisible ? "cad_contours" : terrainVisible ? "aws_terrarium" : "none"
      }
    >
      <div className="absolute inset-0">
        <div ref={mapDiv} className="h-full w-full" />
      </div>
      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center bg-bg-panel/80 backdrop-blur">
          <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin text-gold" />
            Inicializando canvas 3D…
          </div>
        </div>
      )}
      {cadTerrainLayer && cadTerrain && (
        <details className="absolute bottom-12 right-3 z-10 max-w-[min(24rem,calc(100%-1.5rem))] max-h-[35%] overflow-auto rounded border border-border bg-bg-secondary/90 px-2 py-1.5 font-mono text-[9px] leading-snug text-muted-foreground backdrop-blur">
          <summary className="cursor-pointer font-semibold text-foreground">
            Relieve CAD · DERIVADO de curvas DECLARADAS
          </summary>
          <span className="block">{cadTerrain.notice}</span>
          {cadTerrain.imagery && (
            <span className="block mt-1">
              {cadTerrain.imagery.attribution} · {cadTerrain.imagery.notice}
            </span>
          )}
        </details>
      )}
      <div className="absolute bottom-3 right-3 z-10 rounded border border-border bg-bg-secondary/90 px-2 py-1 font-mono text-[10px] text-muted-foreground backdrop-blur">
        deck.gl · {layerCount} capa{layerCount === 1 ? "" : "s"} · modo {mode}
        {surfaceMode && satAnomaliesCount > 0 && (
          <span className="ml-1 text-gold">· {satAnomaliesCount} anomalías sat</span>
        )}
        {subsurfaceMode && (completedTrajectoryCount > 0 || completedCollarCount > 0) && (
          <span className="ml-1 text-gold">· {completedTrajectoryCount} sondajes ejecutados</span>
        )}
        {subsurfaceMode && (proposedTrajectoryCount > 0 || proposedCollarCount > 0) && (
          <span className="ml-1 text-amber-500">· {proposedTrajectoryCount} propuestos</span>
        )}
        {subsurfaceMode && interceptCount > 0 && (
          <span className="ml-1 text-gold">· {interceptCount} interceptos</span>
        )}
        {subsurfaceMode && wireframeCount > 0 && (
          <span className="ml-1 text-gold">· {wireframeCount} wireframes</span>
        )}
        {subsurfaceMode && anomaliesCount > 0 && (
          <span className="ml-1 text-gold">· {anomaliesCount} anomalías geofísicas</span>
        )}
      </div>
    </div>
  );
}
