// GeoSceneCanvas — canvas unificado MapLibre + deck.gl con terreno 3D.
// Sustituye gradualmente a Geology3DViewer (three.js) y SatToSubsurface3DViewer (three.js).
//
// Sprint 4.0: terreno + targets + sondajes + flyTo desde anclajes del copilot.
// Sprint 4.1+: anomalías mag/sat extruidas, vetas, drape Sentinel.
import { useEffect, useMemo, useRef, useState } from "react";
import maplibregl, { Map as MapLibreMap } from "maplibre-gl";
import { MapboxOverlay } from "@deck.gl/mapbox";
import { Loader2 } from "lucide-react";
import "maplibre-gl/dist/maplibre-gl.css";

import { useProjects } from "@/hooks/useProjects";
import { useTargetsLayer } from "./useTargetsLayer";
import { useDrillHolesLayer } from "./useDrillHolesLayer";
import { findAnchor } from "./anchorRegistry";
import { SCENE_FOCUS_EVENT, type SceneFocusDetail } from "../anchors";
import type { GeoSceneMode } from "../types";

interface Props {
  mode: GeoSceneMode;
}

// Estilo MapLibre con base OpenFreeMap (sin API key) + DEM Terrarium de AWS Open Data.
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
      tiles: ["https://elevation-tiles-prod.s3.amazonaws.com/terrarium/{z}/{x}/{y}.png"],
      tileSize: 256,
      encoding: "terrarium",
      maxzoom: 15,
      attribution: "© AWS Terrain Tiles",
    },
  },
  layers: [{ id: "basemap", type: "raster", source: "basemap" }],
  terrain: { source: "terrainDEM", exaggeration: 1.5 },
  sky: {
    "sky-color": "#0a1224",
    "sky-horizon-blend": 0.5,
    "horizon-color": "#1a2a4a",
    "horizon-fog-blend": 0.5,
    "fog-color": "#0a1224",
    "fog-ground-blend": 0.1,
  },
};

export function GeoSceneCanvas({ mode }: Props) {
  const { active } = useProjects();
  const mapDiv = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const overlayRef = useRef<MapboxOverlay | null>(null);
  const [ready, setReady] = useState(false);

  // Capas por modo
  const surfaceMode = mode === "surface";
  const subsurfaceMode = mode === "subsurface";

  const { layer: targetsLayer } = useTargetsLayer(active?.id ?? null, surfaceMode);
  const { layer: holesLayer } = useDrillHolesLayer(active?.id ?? null, subsurfaceMode);

  // Init map
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
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "bottom-left");
    map.on("load", () => {
      const overlay = new MapboxOverlay({ interleaved: false, layers: [] });
      // @ts-expect-error — IControl typing entre maplibre y mapbox
      map.addControl(overlay);
      overlayRef.current = overlay;
      setReady(true);
    });
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      overlayRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Recentrar al cambiar de proyecto
  useEffect(() => {
    if (!mapRef.current || !active?.center_lat || !active?.center_lng) return;
    mapRef.current.flyTo({
      center: [Number(active.center_lng), Number(active.center_lat)],
      zoom: 11,
      pitch: 55,
      duration: 1200,
    });
  }, [active?.id, active?.center_lat, active?.center_lng]);

  // Empujar capas deck.gl
  useEffect(() => {
    if (!ready || !overlayRef.current) return;
    const layers = [targetsLayer, holesLayer].filter(Boolean);
    overlayRef.current.setProps({ layers });
  }, [ready, targetsLayer, holesLayer]);

  // Anclajes del copilot → flyTo
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<SceneFocusDetail>).detail;
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
    () => [targetsLayer, holesLayer].filter(Boolean).length,
    [targetsLayer, holesLayer],
  );

  return (
    <div className="relative h-full w-full">
      <div ref={mapDiv} className="absolute inset-0" />
      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center bg-bg-panel/80 backdrop-blur">
          <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin text-gold" />
            Inicializando canvas 3D…
          </div>
        </div>
      )}
      <div className="absolute bottom-3 right-3 z-10 text-[10px] font-mono text-muted-foreground bg-bg-secondary/90 backdrop-blur border border-border rounded px-2 py-1">
        deck.gl · {layerCount} capa{layerCount === 1 ? "" : "s"} · modo {mode}
      </div>
    </div>
  );
}
