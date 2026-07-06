import { useEffect, useRef, useState, useMemo } from "react";
import maplibregl, { type Map as MLMap } from "maplibre-gl";
import { MapboxOverlay } from "@deck.gl/mapbox";
import { ColumnLayer, ScatterplotLayer, PolygonLayer } from "@deck.gl/layers";
import "maplibre-gl/dist/maplibre-gl.css";
import type { DrillHole, DrillCoreLog } from "@/hooks/useDrilling";
import type { ExplorationTarget } from "@/hooks/useExplorationTargets";
import { Box } from "lucide-react";

const _STYLE_URL =
  "https://api.maptiler.com/maps/hybrid/style.json?key=get_your_own_OpIi9ZULNHzrESv6T2vL";

const FALLBACK_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors",
      maxzoom: 19,
    },
    terrain: {
      type: "raster-dem",
      tiles: ["/api/terrain/{z}/{x}/{y}"],
      tileSize: 256,
      encoding: "terrarium",
      maxzoom: 15,
      attribution: "© Mapzen / AWS Terrain Tiles",
    },
  },
  layers: [{ id: "osm", type: "raster", source: "osm" }],
  terrain: { source: "terrain", exaggeration: 1.5 },
  sky: {
    "sky-color": "#0a1828",
    "sky-horizon-blend": 0.5,
    "horizon-color": "#1a2838",
    "horizon-fog-blend": 0.5,
    "fog-color": "#0a1828",
    "fog-ground-blend": 0.2,
  },
};

const PRIORITY_COLOR: Record<string, [number, number, number]> = {
  low: [120, 120, 120],
  medium: [80, 160, 220],
  high: [240, 180, 60],
  critical: [220, 60, 60],
};

function auToColor(au: number): [number, number, number] {
  if (au >= 5) return [220, 30, 30];
  if (au >= 1) return [240, 180, 40];
  if (au >= 0.3) return [220, 220, 90];
  if (au >= 0.1) return [120, 200, 120];
  return [90, 130, 180];
}

export type Map3DViewProps = {
  centerLat: number;
  centerLng: number;
  holes: DrillHole[];
  logsByHole: Record<string, DrillCoreLog[]>;
  targets: ExplorationTarget[];
  aoi?: GeoJSON.Feature<GeoJSON.Polygon> | null;
};

export function Map3DView({
  centerLat,
  centerLng,
  holes,
  logsByHole,
  targets,
  aoi,
}: Map3DViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const overlayRef = useRef<MapboxOverlay | null>(null);
  const [exaggeration, setExaggeration] = useState(1.5);
  const [showHoles, setShowHoles] = useState(true);
  const [showTargets, setShowTargets] = useState(true);
  const [styleReady, setStyleReady] = useState(false);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: FALLBACK_STYLE,
      center: [centerLng, centerLat],
      zoom: 13,
      pitch: 60,
      bearing: -20,
      maxPitch: 85,
      attributionControl: { compact: true },
    });
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");
    map.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-left");

    map.on("load", () => {
      map.setTerrain({ source: "terrain", exaggeration: 1.5 });
      setStyleReady(true);
    });

    const overlay = new MapboxOverlay({ interleaved: false, layers: [] });
    map.addControl(overlay as unknown as maplibregl.IControl);
    overlayRef.current = overlay;
    mapRef.current = map;

    return () => {
      overlayRef.current = null;
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const m = mapRef.current;
    if (!m) return;
    m.flyTo({ center: [centerLng, centerLat], zoom: 13, pitch: 60, bearing: -20 });
  }, [centerLat, centerLng]);

  useEffect(() => {
    const m = mapRef.current;
    if (!m || !styleReady) return;
    try {
      m.setTerrain({ source: "terrain", exaggeration });
    } catch {
      /* ignore */
    }
  }, [exaggeration, styleReady]);

  const holeData = useMemo(() => {
    if (!showHoles) return [];
    return holes
      .filter((h) => h.northing != null && h.easting != null)
      .map((h) => {
        const logs = logsByHole[h.id] ?? [];
        const maxAu = logs.reduce((m, l) => Math.max(m, l.au_gpt ?? 0), 0);
        const depth = h.actual_depth ?? h.planned_depth ?? 100;
        return {
          position: [h.easting!, h.northing!] as [number, number],
          elevation: depth,
          color: auToColor(maxAu),
          name: h.hole_id,
          au: maxAu,
          depth,
          status: h.status,
        };
      });
  }, [holes, logsByHole, showHoles]);

  const targetData = useMemo(() => {
    if (!showTargets) return [];
    return targets
      .filter((t) => t.lat != null && t.lng != null)
      .map((t) => ({
        position: [t.lng!, t.lat!] as [number, number],
        radius: 30 + (t.score ?? 50) * 1.5,
        color: PRIORITY_COLOR[t.priority] ?? [180, 180, 180],
        name: `${t.code} · ${t.name}`,
        priority: t.priority,
        score: t.score,
      }));
  }, [targets, showTargets]);

  const aoiData = useMemo(() => {
    if (!aoi?.geometry?.coordinates?.[0]) return [];
    return [{ contour: aoi.geometry.coordinates[0] as [number, number][] }];
  }, [aoi]);

  useEffect(() => {
    const ov = overlayRef.current;
    if (!ov) return;
    ov.setProps({
      layers: [
        new PolygonLayer({
          id: "aoi-3d",
          data: aoiData,
          getPolygon: (d: { contour: [number, number][] }) => d.contour,
          getFillColor: [212, 175, 55, 25],
          getLineColor: [212, 175, 55, 200],
          getLineWidth: 3,
          lineWidthUnits: "pixels",
          extruded: false,
          stroked: true,
          pickable: false,
        }),
        new ColumnLayer({
          id: "drill-holes-3d",
          data: holeData,
          diskResolution: 12,
          radius: 8,
          extruded: true,
          pickable: true,
          elevationScale: -1,
          getPosition: (d: { position: [number, number] }) => d.position,
          getElevation: (d: { elevation: number }) => d.elevation,
          getFillColor: (d: { color: [number, number, number] }) =>
            [...d.color, 220] as [number, number, number, number],
          getLineColor: [10, 10, 10, 255],
        }),
        new ScatterplotLayer({
          id: "targets-3d",
          data: targetData,
          pickable: true,
          stroked: true,
          filled: true,
          radiusUnits: "meters",
          radiusMinPixels: 6,
          radiusMaxPixels: 40,
          lineWidthMinPixels: 2,
          getPosition: (d: { position: [number, number] }) => d.position,
          getRadius: (d: { radius: number }) => d.radius,
          getFillColor: (d: { color: [number, number, number] }) =>
            [...d.color, 180] as [number, number, number, number],
          getLineColor: [255, 255, 255, 255],
        }),
      ],
      getTooltip: (info) => {
        const object = info.object as Record<string, unknown> | undefined;
        const layer = info.layer;
        if (!object || !layer) return null;
        if (layer.id === "drill-holes-3d") {
          const o = object as { name: string; au: number; depth: number; status: string };
          return {
            html: `<div style="font-family:monospace;font-size:11px;padding:4px"><b>${o.name}</b><br/>${o.status} · ${o.depth.toFixed(0)} m<br/>Au max: ${o.au.toFixed(2)} g/t</div>`,
            style: { background: "rgba(20,20,20,0.92)", color: "#fff", borderRadius: "4px" },
          };
        }
        if (layer.id === "targets-3d") {
          const o = object as { name: string; priority: string; score: number | null };
          return {
            html: `<div style="font-family:monospace;font-size:11px;padding:4px"><b>${o.name}</b><br/>Prioridad: ${o.priority}<br/>Score: ${o.score ?? "—"}</div>`,
            style: { background: "rgba(20,20,20,0.92)", color: "#fff", borderRadius: "4px" },
          };
        }
        return null;
      },
    });
  }, [holeData, targetData, aoiData]);

  return (
    <div className="absolute inset-0">
      <div ref={containerRef} className="absolute inset-0" />

      <div className="absolute top-3 left-3 z-10 bg-bg-secondary/95 border border-border rounded p-3 backdrop-blur shadow-md w-56 space-y-2.5">
        <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase text-muted-foreground border-b border-border pb-1.5">
          <Box className="w-3 h-3 text-gold" /> Vista 3D · Mission Control
        </div>

        <div>
          <div className="flex justify-between text-[10px] font-mono text-muted-foreground mb-1">
            <span>Exageración terreno</span>
            <span className="text-foreground">{exaggeration.toFixed(1)}×</span>
          </div>
          <input
            type="range"
            min={0}
            max={5}
            step={0.1}
            value={exaggeration}
            onChange={(e) => setExaggeration(parseFloat(e.target.value))}
            className="w-full accent-gold h-1"
          />
        </div>

        <label className="flex items-center gap-1.5 text-[11px] font-mono text-foreground cursor-pointer">
          <input
            type="checkbox"
            checked={showHoles}
            onChange={(e) => setShowHoles(e.target.checked)}
            className="accent-gold"
          />
          Sondajes ({holes.length})
        </label>

        <label className="flex items-center gap-1.5 text-[11px] font-mono text-foreground cursor-pointer">
          <input
            type="checkbox"
            checked={showTargets}
            onChange={(e) => setShowTargets(e.target.checked)}
            className="accent-gold"
          />
          Targets ({targets.length})
        </label>

        <div className="pt-1.5 border-t border-border space-y-1">
          <div className="text-[9px] font-mono uppercase text-muted-foreground">Au sondajes</div>
          {[
            { c: "rgb(220,30,30)", l: "≥5 g/t" },
            { c: "rgb(240,180,40)", l: "1-5 g/t" },
            { c: "rgb(120,200,120)", l: "0.1-0.3" },
            { c: "rgb(90,130,180)", l: "<0.1" },
          ].map((x) => (
            <div key={x.l} className="flex items-center gap-1.5 text-[10px] font-mono">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ background: x.c }} />
              <span>{x.l}</span>
            </div>
          ))}
        </div>

        <div className="pt-1 text-[9px] font-mono text-muted-foreground">
          Click + arrastrar = rotar · Shift = pan · Scroll = zoom
        </div>
      </div>
    </div>
  );
}
