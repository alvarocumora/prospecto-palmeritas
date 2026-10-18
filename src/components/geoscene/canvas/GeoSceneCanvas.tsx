// GeoSceneCanvas — canvas unificado MapLibre + deck.gl con terreno 3D.
// Consume ids del Canonical Geospatial Layer Registry y separa evidencia medida,
// derivada, interpretada y propuesta antes de renderizar.
import { useEffect, useMemo, useRef, useState } from "react";
import maplibregl, { Map as MapLibreMap } from "maplibre-gl";
import { MapboxOverlay } from "@deck.gl/mapbox";
import { GeoJsonLayer } from "@deck.gl/layers";
import { Loader2 } from "lucide-react";
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

interface Props {
  mode: GeoSceneMode;
  visibleLayerIds: ReadonlySet<string>;
  filters?: GeoSceneFilters;
  project?: GeoSceneProject;
  projectLayers?: GeoSceneProjectLayer[];
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
  mode,
  visibleLayerIds,
  filters,
  project,
  projectLayers,
}: Props) {
  const { active: activeProject } = useProjects();
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

  const { layer: targetsLayer } = useTargetsLayer(active?.id ?? null, targetsVisible, filters);
  const {
    layers: holeColumnLayers,
    completedCount: completedCollarCount,
    proposedCount: proposedCollarCount,
  } = useDrillHolesLayer(
    active?.id ?? null,
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
    active?.id ?? null,
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
    active?.id ?? null,
    geophysicsVisible,
  );
  const { layer: satAnomaliesLayer, count: satAnomaliesCount } = useSatAnomaliesLayer(
    active?.id ?? null,
    satelliteVisible,
  );
  const { layers: wireframeLayers, count: wireframeCount } = useWireframesLayer(
    active?.id ?? null,
    centerLng,
    centerLat,
    wireframesVisible,
  );

  const resolvedProjectLayers = useMemo(() => resolveProjectLayers(projectLayers), [projectLayers]);
  const projectGeoLayers = useMemo(() => {
    if (mode === "resource") return [];
    return resolvedProjectLayers
      .filter((layer) => visibleLayerIds.has(layer.id))
      .map((layer) => {
        const color = evidenceColor(layer.definition.evidence);
        const dashed = isDashedEvidence(layer.definition.evidence);
        return new GeoJsonLayer({
          id: `project:${layer.id}`,
          data: layer.data as never,
          pickable: true,
          stroked: true,
          filled: true,
          getFillColor: [color[0], color[1], color[2], dashed ? 20 : 45],
          getLineColor: color,
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
  }, [mode, resolvedProjectLayers, visibleLayerIds]);

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
      pitch: 55,
      bearing: -20,
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
          const projectLayer = info.layer?.props?.geoProjectLayer as ResolvedProjectLayer | undefined;
          if (!projectLayer || !info.object) return null;
          return projectLayerTooltip(projectLayer, info.object.properties);
        },
      } as never);
      map.addControl(overlay as unknown as maplibregl.IControl);
      overlayRef.current = overlay;
      if (project?.bbox) {
        const [w, so, e, n] = project.bbox;
        map.fitBounds([[w, so], [e, n]], { padding: 60, pitch: 55, bearing: -20, duration: 0 });
      }
      syncSnapshotViewState();
      setReady(true);
    });
    map.on("moveend", syncSnapshotViewState);

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
    if (!ready || !mapRef.current) return;
    try {
      mapRef.current.setTerrain(
        terrainVisible ? { source: "terrainDEM", exaggeration: 1.5 } : null,
      );
    } catch {
      try {
        mapRef.current.setTerrain(null);
      } catch {
        // Fail-safe: canvas 2D con pitch.
      }
    }
  }, [ready, terrainVisible]);

  useEffect(() => {
    if (project?.bbox) return;
    if (!mapRef.current || !active?.center_lat || !active?.center_lng) return;
    mapRef.current.flyTo({
      center: [Number(active.center_lng), Number(active.center_lat)],
      zoom: 11,
      pitch: 55,
      duration: 1200,
    });
  }, [active?.id, active?.center_lat, active?.center_lng]);

  useEffect(() => {
    if (!ready || !overlayRef.current) return;
    const layers = [
      ...projectGeoLayers,
      targetsLayer,
      satAnomaliesLayer,
      ...holeColumnLayers,
      ...trajectoryLayers,
      ...wireframeLayers,
      anomaliesLayer,
    ].filter(Boolean);
    overlayRef.current.setProps({ layers });
  }, [
    ready,
    projectGeoLayers,
    targetsLayer,
    satAnomaliesLayer,
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
        pitch: 65,
        speed: 1.4,
        essential: true,
      });
    };
    window.addEventListener(SCENE_FOCUS_EVENT, handler);
    return () => window.removeEventListener(SCENE_FOCUS_EVENT, handler);
  }, []);

  const layerCount = useMemo(
    () =>
      [
        ...projectGeoLayers,
        targetsLayer,
        satAnomaliesLayer,
        ...holeColumnLayers,
        ...trajectoryLayers,
        ...wireframeLayers,
        anomaliesLayer,
      ].filter(Boolean).length,
    [
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
    const rendered = sceneBindingsForMode(mode)
      .filter((binding) => visibleLayerIds.has(binding.canonicalId))
      .map((binding) => binding.canonicalId as string);
    const projectIds =
      mode === "resource"
        ? []
        : resolvedProjectLayers.filter((l) => visibleLayerIds.has(l.id)).map((l) => l.id as string);
    return Array.from(new Set(["basemap.esri_imagery", ...rendered, ...projectIds]))
      .sort()
      .join(",");
  }, [mode, visibleLayerIds, resolvedProjectLayers]);
  const filterManifest = useMemo(
    () => sceneFilterManifest(filters),
    [filters?.campaignId, filters?.highGradeOnly, filters?.timeCursor],
  );

  return (
    <div
      className="relative h-full w-full"
      data-geo-engine="deckgl"
      data-geo-mode="3d"
      data-geo-project-id={active?.id ?? undefined}
      data-geo-crs="EPSG:4326"
      data-geo-layer-ids={canonicalManifest}
      data-geo-filters={filterManifest}
      data-geo-view-state={snapshotViewState ? JSON.stringify(snapshotViewState) : undefined}
      data-geo-scene-mode={mode}
    >
      <div ref={mapDiv} className="absolute inset-0" />
      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center bg-bg-panel/80 backdrop-blur">
          <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin text-gold" />
            Inicializando canvas 3D…
          </div>
        </div>
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
