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
import { cadElevationSampler, drapeFeatureCollection, hybridElevationSampler, type ElevationSampler } from "../terrainDrape";
import { discRing, planeFromProperties } from "../structuralPlanes";
import { sectionAzimuth, sectionLength, structuresInSection, terrainProfile, type LngLat } from "../sectionProfile";
import { SectionProfilePanel } from "../controls/SectionProfilePanel";
import { FeatureInspector } from "../controls/FeatureInspector";
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
  featureLabel,
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
  // Regional DEM stays on around CAD surveys so concessions beyond the survey
  // never drop to sea level. CAD wins inside its coverage (selection, not blend).
  const demActive = terrainVisible && view === "3d";
  const drape = useMemo((): { sample: ElevationSampler; fallback: number } | null => {
    if (view !== "3d" || !terrainVisible) return null;
    const map = mapRef.current as unknown as {
      terrain?: { getElevationForLngLatZoom?: (ll: maplibregl.LngLat, z: number) => number };
    } | null;
    const terrain = map?.terrain;
    const zoom = Math.min(14, Math.max(8, Math.round(mapRef.current?.getZoom() ?? 12)));
    const dem: ElevationSampler | null =
      terrain?.getElevationForLngLatZoom && terrainEpoch > 0
        ? (lng, lat) => {
            const h = terrain.getElevationForLngLatZoom!(new maplibregl.LngLat(lng, lat), zoom);
            return Number.isFinite(h) && h !== 0 ? h : null;
          }
        : null;
    if (cadTerrain) {
      const cad = cadElevationSampler(cadTerrain.tile);
      const sample = dem ? hybridElevationSampler(cad, dem) : cad;
      return { sample, fallback: sample(centerLng, centerLat) ?? cadTerrain.tile.referenceElevationM };
    }
    if (!dem) return null;
    return { sample: dem, fallback: dem(centerLng, centerLat) ?? 0 };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, terrainVisible, cadTerrain, terrainEpoch, demActive]);

  const resolvedProjectLayers = useMemo(() => resolveProjectLayers(projectLayers), [projectLayers]);

  // Corte transversal A-A' (estándar global: cualquier proyecto con relieve).
  const [sectionOn, setSectionOn] = useState(false);
  const [selected, setSelected] = useState<{
    layer: ResolvedProjectLayer;
    properties: Record<string, unknown>;
  } | null>(null);
  const [sectionPts, setSectionPts] = useState<LngLat[]>([]);
  const [corridor, setCorridor] = useState(50);
  const sectionRef = useRef(sectionOn);
  sectionRef.current = sectionOn;
  const section = useMemo(() => {
    if (sectionPts.length < 2) return null;
    const [a, b] = sectionPts;
    const structures = resolvedProjectLayers.find((l) => l.id === "geology.structures")?.data as
      | FeatureCollection
      | undefined;
    return {
      length: sectionLength(a, b),
      azimuth: sectionAzimuth(a, b),
      profile: drape
        ? terrainProfile(a, b, drape.sample)
        : cadTerrain
          ? terrainProfile(a, b, cadElevationSampler(cadTerrain.tile))
          : [],
      structures: structuresInSection(a, b, structures, corridor),
    };
  }, [sectionPts, drape, cadTerrain, resolvedProjectLayers, corridor]);
  const sectionLayer = useMemo(() => {
    if (!sectionOn || !sectionPts.length) return null;
    const z = (p: LngLat) => (drape?.sample(p[0], p[1]) ?? drape?.fallback ?? 0) + 6;
    return new GeoJsonLayer({
      id: "tool.section",
      data: {
        type: "FeatureCollection",
        features: [
          ...sectionPts.map((p, i) => ({
            type: "Feature" as const,
            properties: { label: i ? "A′" : "A" },
            geometry: { type: "Point" as const, coordinates: [p[0], p[1], z(p)] },
          })),
          ...(sectionPts.length === 2
            ? [{
                type: "Feature" as const,
                properties: {},
                geometry: { type: "LineString" as const, coordinates: sectionPts.map((p) => [p[0], p[1], z(p)]) },
              }]
            : []),
        ],
      } as never,
      getLineColor: [43, 74, 203, 255],
      getFillColor: [247, 245, 240, 255],
      getLineWidth: 3,
      lineWidthUnits: "pixels",
      pointRadiusUnits: "pixels",
      getPointRadius: 6,
      stroked: true,
      parameters: { depthTest: false } as never,
    });
  }, [sectionOn, sectionPts, drape]);
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
              offsetM: 8,
            })
          : layer.data;
        return new GeoJsonLayer({
          id: `project:${layer.id}`,
          data: data as never,
          pickable: true,
          stroked: true,
          filled: true,
          opacity: layerOpacity?.[layer.id] ?? 1,
          getFillColor: layer.id === "territory.cadastre"
            ? [color[0], color[1], color[2], 0]
            : spectral
            ? (f: { properties?: Record<string, unknown> }) => spectralFill(f.properties, rgb)
            : [color[0], color[1], color[2], dashed ? 6 : 12],
          getLineColor: spectral
            ? (f: { properties?: Record<string, unknown> }) => {
                const c = spectralFill(f.properties, rgb);
                return [c[0], c[1], c[2], 230];
              }
            : layer.id === "territory.cadastre"
              ? [color[0], color[1], color[2], 150]
              : color,
          getLineWidth: layer.id === "territory.cadastre" ? 1 : dashed ? 1.25 : 1.75,
          lineWidthUnits: "pixels",
          pointType: "circle",
          // Píxel satelital a escala real (EMIT ~60 m, ASTER ~90 m) en 3D;
          // en Planta se mantiene legible en píxeles.
          getPointRadius: spectral && view === "3d" ? (layer.id.includes("aster") ? 45 : 30) : 6,
          pointRadiusUnits: spectral && view === "3d" ? "meters" : "pixels",
          pointRadiusMinPixels: spectral && view === "3d" ? 1 : 4,
          pointRadiusMaxPixels: 14,
          // El relieve del primer plano oculta lo que está detrás.
          parameters: { depthTest: view === "3d" } as never,
          updateTriggers: { getLineColor: layer.definition.evidence },
          // keep a reference for tooltips
          ...({ geoProjectLayer: layer } as Record<string, unknown>),
        });
      });
  }, [mode, view, resolvedProjectLayers, visibleLayerIds, layerOpacity, drape]);

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
      getFillColor: [color[0], color[1], color[2], 60],
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
          return featureLabel(info.object.properties) + " · clic para ficha";
        },
        onClick: (info: {
          layer?: { props?: Record<string, unknown> } | null;
          object?: { properties?: Record<string, unknown> } | null;
        }) => {
          if (sectionRef.current) return false;
          const projectLayer = info.layer?.props?.geoProjectLayer as
            ResolvedProjectLayer | undefined;
          if (!projectLayer || !info.object) return false;
          setSelected({ layer: projectLayer, properties: info.object.properties ?? {} });
          return true;
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
    map.on("click", (e) => {
      if (!sectionRef.current) return;
      const p: LngLat = [e.lngLat.lng, e.lngLat.lat];
      setSectionPts((prev) => (prev.length >= 2 ? [p] : [...prev, p]));
    });
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
        // Regional DEM is the continuous base in Perspectiva. With a CAD survey it
        // runs at true scale so the CAD mesh (absolute heights) sits on it.
        terrainVisible && view === "3d"
          ? { source: "terrainDEM", exaggeration: cadTerrain ? 1 : 1.5 }
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
      sectionLayer,
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
    sectionLayer,
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
        cadTerrain && terrainVisible ? "cad_contours+aws_terrarium" : terrainVisible ? "aws_terrarium" : "none"
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
      <button
        type="button"
        aria-pressed={sectionOn}
        onClick={() => {
          setSectionOn((v) => !v);
          setSectionPts([]);
        }}
        className={`absolute bottom-3 left-3 z-30 min-h-11 rounded border px-3 font-mono text-[11px] uppercase tracking-wider shadow-sm backdrop-blur focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-brand ${
          sectionOn ? "border-accent-brand bg-accent-brand text-primary-foreground" : "border-border bg-bg-secondary/90 text-foreground"
        }`}
      >
        {sectionOn ? (sectionPts.length < 2 ? `Corte: toca ${sectionPts.length ? "A′" : "A"}` : "Corte activo") : "Corte A–A′"}
      </button>
      {selected && (
        <FeatureInspector
          layer={selected.layer}
          properties={selected.properties}
          onClose={() => setSelected(null)}
        />
      )}
      {sectionOn && section && (
        <SectionProfilePanel
          {...section}
          corridor={corridor}
          onCorridor={setCorridor}
          onClose={() => {
            setSectionOn(false);
            setSectionPts([]);
          }}
        />
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
