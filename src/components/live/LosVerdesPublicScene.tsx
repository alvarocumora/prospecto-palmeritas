// Visor 3D público Los Verdes — Sprint B (MVP real).
// MapLibre + deck.gl con DEM real (terrarium AWS), basemap satelital,
// anomalías satelitales extruidas, vetas, targets, anomalías magnéticas.
// Sin importers activos: /live/losverdes migró a PublicCanonicalScene +
// buildLosVerdesPublicGeoBundle. Se conserva como referencia (ver
// legacyViewerRegistry.ts, id "losverdes-public-scene", reference_only).
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import maplibregl, { Map as MapLibreMap } from "maplibre-gl";
import { MapboxOverlay } from "@deck.gl/mapbox";
import { ScatterplotLayer, PolygonLayer, PathLayer } from "@deck.gl/layers";
import type { Layer } from "@deck.gl/core";
import { Loader2, Layers as LayersIcon, AlertTriangle } from "lucide-react";
import "maplibre-gl/dist/maplibre-gl.css";

import { getLosVerdesPublicLayers } from "@/lib/livemap-public.functions";
import { getLosVerdesAnomalies } from "@/lib/livemap-public.functions";
import { getLosVerdesMining } from "@/lib/losverdes-veins.functions";

const TILAMA_CENTER: [number, number] = [-71.18, -31.95];

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

const SEVERITY_RGB: Record<string, [number, number, number]> = {
  high: [239, 68, 68],
  medium: [249, 115, 22],
  low: [234, 179, 8],
};
const PRIORITY_RGB: Record<string, [number, number, number]> = {
  critical: [239, 68, 68],
  high: [249, 115, 22],
  medium: [234, 179, 8],
  low: [148, 163, 184],
};

type LayerKey = "satAnomalies" | "veins" | "targets" | "magTargets";

export function LosVerdesPublicScene({ height = 640 }: { height?: number }) {
  const mapDiv = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const overlayRef = useRef<MapboxOverlay | null>(null);
  const [ready, setReady] = useState(false);
  const [visible, setVisible] = useState<Record<LayerKey, boolean>>({
    satAnomalies: true,
    veins: true,
    targets: true,
    magTargets: true,
  });

  const fetchLayers = useServerFn(getLosVerdesPublicLayers);
  const fetchAnomalies = useServerFn(getLosVerdesAnomalies);
  const fetchMining = useServerFn(getLosVerdesMining);

  const layersQ = useQuery({
    queryKey: ["losverdes-pub", "layers"],
    queryFn: () => fetchLayers(),
    staleTime: 5 * 60_000,
  });
  const anomQ = useQuery({
    queryKey: ["losverdes-pub", "anomalies"],
    queryFn: () => fetchAnomalies(),
    staleTime: 5 * 60_000,
  });
  const miningQ = useQuery({
    queryKey: ["losverdes-pub", "mining"],
    queryFn: () => fetchMining(),
    staleTime: 5 * 60_000,
  });

  const center = useMemo<[number, number]>(() => {
    const lat = layersQ.data?.project.center_lat;
    const lng = layersQ.data?.project.center_lng;
    if (lat != null && lng != null) return [lng, lat];
    return TILAMA_CENTER;
  }, [layersQ.data]);

  // Init map (once)
  useEffect(() => {
    if (!mapDiv.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: mapDiv.current,
      style: MAP_STYLE,
      center: TILAMA_CENTER,
      zoom: 11.5,
      pitch: 60,
      bearing: -20,
      maxPitch: 80,
      attributionControl: { compact: true },
    });
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "bottom-left");
    map.on("load", () => {
      const overlay = new MapboxOverlay({ interleaved: false, layers: [] });
      map.addControl(overlay as unknown as maplibregl.IControl);
      overlayRef.current = overlay;
      setReady(true);
    });
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      overlayRef.current = null;
    };
  }, []);

  // Recentrar al recibir el centro del proyecto
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    mapRef.current.flyTo({ center, zoom: 12, pitch: 60, duration: 1200 });
  }, [ready, center]);

  // Compose deck.gl layers
  useEffect(() => {
    if (!ready || !overlayRef.current) return;

    const layers: Layer[] = [];

    // Anomalías satelitales — polígonos extruidos por severidad
    if (visible.satAnomalies && anomQ.data?.satAnomalies?.length) {
      const polys = anomQ.data.satAnomalies.filter((a) => a.polygon && a.polygon.length >= 3);
      if (polys.length) {
        layers.push(
          new PolygonLayer({
            id: "sat-anomalies-poly",
            data: polys,
            pickable: true,
            extruded: true,
            wireframe: false,
            getPolygon: (d: (typeof polys)[number]) => d.polygon as [number, number][],
            getElevation: (d: (typeof polys)[number]) =>
              80 + Math.max(0, d.score) * 200 + (d.severity === "high" ? 120 : 0),
            getFillColor: (d: (typeof polys)[number]) => [
              ...(SEVERITY_RGB[d.severity] ?? SEVERITY_RGB.medium),
              160,
            ],
            getLineColor: [255, 255, 255, 220],
            getLineWidth: 1,
            lineWidthUnits: "pixels",
          }),
        );
      }
      const pts = anomQ.data.satAnomalies.filter((a) => !a.polygon);
      if (pts.length) {
        layers.push(
          new ScatterplotLayer({
            id: "sat-anomalies-pts",
            data: pts,
            pickable: true,
            radiusUnits: "meters",
            getPosition: (d: (typeof pts)[number]) => [d.lng, d.lat],
            getRadius: (d: (typeof pts)[number]) => 120 + d.score * 200,
            getFillColor: (d: (typeof pts)[number]) => [
              ...(SEVERITY_RGB[d.severity] ?? SEVERITY_RGB.medium),
              200,
            ],
          }),
        );
      }
    }

    // Vetas — LineString como path 3D coloreado por commodity
    if (visible.veins && miningQ.data?.veins?.length) {
      const veinPaths = miningQ.data.veins
        .filter((v) => v.geometry && v.geometry.coordinates?.length >= 2)
        .map((v) => ({
          id: v.id,
          code: v.code,
          name: v.name,
          path: v.geometry!.coordinates,
          thickness: v.thickness_m ?? 5,
          commodity: (v.commodity ?? "Cu").toLowerCase(),
        }));
      if (veinPaths.length) {
        layers.push(
          new PathLayer({
            id: "veins",
            data: veinPaths,
            pickable: true,
            widthUnits: "meters",
            getPath: (d: (typeof veinPaths)[number]) => d.path,
            getWidth: (d: (typeof veinPaths)[number]) => Math.max(8, d.thickness * 2),
            getColor: (d: (typeof veinPaths)[number]) => {
              if (d.commodity.includes("au")) return [255, 215, 0, 230];
              if (d.commodity.includes("ag")) return [200, 200, 220, 230];
              return [184, 115, 51, 230]; // Cu
            },
            capRounded: true,
            jointRounded: true,
          }),
        );
      }
    }

    // Targets — scatter con halo dorado
    if (visible.targets && layersQ.data?.targets?.length) {
      const pts = layersQ.data.targets.filter((t) => t.lat != null && t.lng != null);
      if (pts.length) {
        layers.push(
          new ScatterplotLayer({
            id: "targets",
            data: pts,
            pickable: true,
            stroked: true,
            filled: true,
            radiusUnits: "meters",
            getPosition: (d: (typeof pts)[number]) => [Number(d.lng), Number(d.lat)],
            getRadius: (d: (typeof pts)[number]) => 140 + Number(d.score ?? 0) * 4,
            getFillColor: (d: (typeof pts)[number]) => [
              ...(PRIORITY_RGB[(d.priority ?? "medium").toLowerCase()] ?? PRIORITY_RGB.medium),
              200,
            ],
            getLineColor: [255, 215, 0, 230],
            getLineWidth: 2,
            lineWidthUnits: "pixels",
          }),
        );
      }
    }

    // Mag targets — anillos por rank
    if (visible.magTargets && anomQ.data?.magTargets?.length) {
      layers.push(
        new ScatterplotLayer({
          id: "mag-targets",
          data: anomQ.data.magTargets,
          pickable: true,
          stroked: true,
          filled: false,
          radiusUnits: "meters",
          getPosition: (d) => [d.lng, d.lat],
          getRadius: (d) => Math.max(200, d.radius_m),
          getLineColor: [56, 189, 248, 220],
          getLineWidth: 2,
          lineWidthUnits: "pixels",
        }),
      );
    }

    overlayRef.current.setProps({ layers });
  }, [ready, visible, anomQ.data, miningQ.data, layersQ.data]);

  const counts = {
    satAnomalies: anomQ.data?.satAnomalies.length ?? 0,
    veins: miningQ.data?.veins.length ?? 0,
    targets: layersQ.data?.targets.length ?? 0,
    magTargets: anomQ.data?.magTargets.length ?? 0,
  };

  const anyError = layersQ.error ?? anomQ.error ?? miningQ.error;
  const anyLoading = layersQ.isLoading || anomQ.isLoading || miningQ.isLoading;

  return (
    <div
      className="relative w-full rounded-lg overflow-hidden border border-border bg-bg-secondary"
      style={{ height }}
    >
      <div ref={mapDiv} className="absolute inset-0" />

      {/* HUD: capas */}
      <div className="absolute top-3 right-3 z-10 bg-bg-secondary/95 backdrop-blur border border-border rounded p-2 space-y-1.5 min-w-[180px]">
        <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-gold mb-1">
          <LayersIcon className="w-3 h-3" />
          Capas
        </div>
        {(
          [
            ["satAnomalies", "Anom. satelitales"],
            ["veins", "Vetas Cu-Au-Ag"],
            ["targets", "Targets"],
            ["magTargets", "Anom. magnéticas"],
          ] as Array<[LayerKey, string]>
        ).map(([key, label]) => (
          <label
            key={key}
            className="flex items-center justify-between gap-2 text-[11px] cursor-pointer"
          >
            <span className="flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={visible[key]}
                onChange={(e) => setVisible((v) => ({ ...v, [key]: e.target.checked }))}
                className="accent-gold"
              />
              <span className="text-foreground">{label}</span>
            </span>
            <span className="font-mono text-[10px] text-muted-foreground">{counts[key]}</span>
          </label>
        ))}
      </div>

      {/* Estado */}
      {anyLoading && (
        <div className="absolute bottom-3 right-3 z-10 flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground bg-bg-secondary/90 backdrop-blur border border-border rounded px-2 py-1">
          <Loader2 className="w-3 h-3 animate-spin text-gold" />
          Cargando datos…
        </div>
      )}
      {anyError && (
        <div className="absolute bottom-3 left-3 z-10 flex items-center gap-1.5 text-[10px] font-mono text-amber-300 bg-amber-950/80 backdrop-blur border border-amber-500/40 rounded px-2 py-1 max-w-md">
          <AlertTriangle className="w-3 h-3" />
          {anyError instanceof Error ? anyError.message : "Error cargando capas"}
        </div>
      )}
      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center bg-bg-panel/80 backdrop-blur">
          <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin text-gold" />
            Inicializando terreno 3D…
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 text-[10px] font-mono text-muted-foreground bg-bg-secondary/90 backdrop-blur border border-border rounded px-2 py-1">
        Los Verdes · Tilama · DEM AWS Terrarium · Esri World Imagery · datos reales Supabase
      </div>
    </div>
  );
}
