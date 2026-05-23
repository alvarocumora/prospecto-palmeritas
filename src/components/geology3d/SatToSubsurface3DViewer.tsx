// Sprint 1 — Visor 3D "Satélite → Subsuelo" (genérico, todos los proyectos).
// Cubo geo-referenciado: cara superior = Esri World Imagery sobre DEM real,
// columnas hacia abajo = anomalías satelitales extruidas por score (estilo OKM/Map Your Mining).
import { useEffect, useMemo, useRef, useState } from "react";
import maplibregl, { type Map as MLMap } from "maplibre-gl";
import { MapboxOverlay } from "@deck.gl/mapbox";
import { ColumnLayer, ScatterplotLayer } from "@deck.gl/layers";
import "maplibre-gl/dist/maplibre-gl.css";
import { Box, Layers, Loader2 } from "lucide-react";
import { useProjects } from "@/hooks/useProjects";
import {
  useProjectSatelliteAnomalies,
  type SatIndexCode,
} from "@/hooks/useProjectSatelliteAnomalies";
import { useExplorationTargets } from "@/hooks/useExplorationTargets";

const ESRI_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    esri: {
      type: "raster",
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
      attribution: "Tiles © Esri",
      maxzoom: 19,
    },
    terrain: {
      type: "raster-dem",
      tiles: [
        "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png",
      ],
      tileSize: 256,
      encoding: "terrarium",
      maxzoom: 15,
      attribution: "© Mapzen / AWS Terrain Tiles",
    },
  },
  layers: [{ id: "esri", type: "raster", source: "esri" }],
  terrain: { source: "terrain", exaggeration: 1.6 },
  sky: {
    "sky-color": "#0a1828",
    "sky-horizon-blend": 0.5,
    "horizon-color": "#1a2838",
    "horizon-fog-blend": 0.5,
    "fog-color": "#0a1828",
    "fog-ground-blend": 0.2,
  },
};

const INDEX_COLOR: Record<SatIndexCode, [number, number, number]> = {
  IRON_OXIDE: [220, 90, 40], // rojo-naranja
  CLAY_MINERALS: [220, 200, 80], // amarillo
  HYDROTHERMAL_ALTERATION: [200, 60, 200], // magenta
  STRUCTURAL_LINEAMENTS: [80, 200, 230], // cian
};

const INDEX_LABEL: Record<SatIndexCode, string> = {
  IRON_OXIDE: "Óxidos Fe",
  CLAY_MINERALS: "Arcillas",
  HYDROTHERMAL_ALTERATION: "Hidrotermal",
  STRUCTURAL_LINEAMENTS: "Lineamientos",
};

const SEVERITY_ALPHA = { low: 100, medium: 170, high: 230 } as const;

function centroidOfGeometry(geom: GeoJSON.Geometry): [number, number] | null {
  // Centroide aproximado: promedio simple de coords.
  let sx = 0;
  let sy = 0;
  let n = 0;
  const walk = (c: unknown): void => {
    if (!Array.isArray(c)) return;
    if (typeof c[0] === "number" && typeof c[1] === "number") {
      sx += c[0] as number;
      sy += c[1] as number;
      n += 1;
      return;
    }
    for (const item of c) walk(item);
  };
  walk((geom as { coordinates: unknown }).coordinates);
  if (n === 0) return null;
  return [sx / n, sy / n];
}

type Props = { className?: string };

export function SatToSubsurface3DViewer({ className }: Props) {
  const { active } = useProjects();
  const projectId = active?.id ?? null;
  const { data: anomGrouped, isLoading: anomLoading } =
    useProjectSatelliteAnomalies(projectId);
  const { targets } = useExplorationTargets(projectId);

  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const overlayRef = useRef<MapboxOverlay | null>(null);
  const [exaggeration, setExaggeration] = useState(1.6);
  const [depthScale, setDepthScale] = useState(1.0); // 1.0 = score(100) → 500m
  const [enabled, setEnabled] = useState<Record<SatIndexCode, boolean>>({
    IRON_OXIDE: true,
    CLAY_MINERALS: true,
    HYDROTHERMAL_ALTERATION: true,
    STRUCTURAL_LINEAMENTS: true,
  });
  const [showTargets, setShowTargets] = useState(true);
  const [styleReady, setStyleReady] = useState(false);

  const center = useMemo<[number, number]>(() => {
    if (active?.center_lng != null && active?.center_lat != null) {
      return [active.center_lng, active.center_lat];
    }
    // fallback Chile central
    return [-71.0, -31.5];
  }, [active]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: ESRI_STYLE,
      center,
      zoom: 13,
      pitch: 65,
      bearing: -25,
      maxPitch: 85,
      attributionControl: { compact: true },
    });
    map.addControl(
      new maplibregl.NavigationControl({ visualizePitch: true }),
      "top-right",
    );
    map.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-left");
    map.on("load", () => {
      map.setTerrain({ source: "terrain", exaggeration: 1.6 });
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
    mapRef.current?.flyTo({ center, zoom: 13, pitch: 65, bearing: -25 });
  }, [center]);

  useEffect(() => {
    const m = mapRef.current;
    if (!m || !styleReady) return;
    try {
      m.setTerrain({ source: "terrain", exaggeration });
    } catch {
      /* ignore */
    }
  }, [exaggeration, styleReady]);

  // Datos a columnas 3D extruidas hacia abajo
  const columnData = useMemo(() => {
    if (!anomGrouped) return [];
    const out: Array<{
      position: [number, number];
      depth: number;
      color: [number, number, number, number];
      name: string;
      index: SatIndexCode;
      severity: string;
      score: number;
    }> = [];
    (Object.keys(anomGrouped) as SatIndexCode[]).forEach((idx) => {
      if (!enabled[idx]) return;
      for (const a of anomGrouped[idx]) {
        const c = centroidOfGeometry(a.geometry);
        if (!c) continue;
        const score = a.score ?? 50;
        // score (0-100) → profundidad 0–500 m
        const depth = Math.max(40, score * 5 * depthScale);
        const rgb = INDEX_COLOR[idx];
        const alpha = SEVERITY_ALPHA[a.severity] ?? 180;
        out.push({
          position: c,
          depth,
          color: [...rgb, alpha] as [number, number, number, number],
          name: a.notes ?? INDEX_LABEL[idx],
          index: idx,
          severity: a.severity,
          score,
        });
      }
    });
    return out;
  }, [anomGrouped, enabled, depthScale]);

  const targetData = useMemo(() => {
    if (!showTargets) return [];
    return targets
      .filter((t) => t.lat != null && t.lng != null)
      .map((t) => ({
        position: [t.lng!, t.lat!] as [number, number],
        radius: 40 + (t.score ?? 50) * 1.5,
        color:
          t.priority === "critical"
            ? [220, 60, 60]
            : t.priority === "high"
              ? [240, 180, 60]
              : t.priority === "medium"
                ? [80, 160, 220]
                : [160, 160, 160],
        name: `${t.code} · ${t.name}`,
        score: t.score,
      }));
  }, [targets, showTargets]);

  useEffect(() => {
    const ov = overlayRef.current;
    if (!ov) return;
    ov.setProps({
      layers: [
        new ColumnLayer({
          id: "sat-columns-3d",
          data: columnData,
          diskResolution: 16,
          radius: 60,
          extruded: true,
          pickable: true,
          elevationScale: -1, // hacia abajo
          getPosition: (d: { position: [number, number] }) => d.position,
          getElevation: (d: { depth: number }) => d.depth,
          getFillColor: (d: { color: [number, number, number, number] }) => d.color,
          getLineColor: [10, 10, 10, 255],
        }),
        new ScatterplotLayer({
          id: "targets-surface",
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
        if (layer.id === "sat-columns-3d") {
          const o = object as {
            name: string;
            index: SatIndexCode;
            severity: string;
            score: number;
            depth: number;
          };
          return {
            html: `<div style="font-family:monospace;font-size:11px;padding:4px"><b>${INDEX_LABEL[o.index]}</b><br/>${o.severity} · score ${o.score.toFixed(0)}<br/>Profundidad inferida: ${o.depth.toFixed(0)} m<br/><i>${o.name}</i></div>`,
            style: {
              background: "rgba(20,20,20,0.92)",
              color: "#fff",
              borderRadius: "4px",
            },
          };
        }
        if (layer.id === "targets-surface") {
          const o = object as { name: string; score: number | null };
          return {
            html: `<div style="font-family:monospace;font-size:11px;padding:4px"><b>${o.name}</b><br/>Score: ${o.score ?? "—"}</div>`,
            style: {
              background: "rgba(20,20,20,0.92)",
              color: "#fff",
              borderRadius: "4px",
            },
          };
        }
        return null;
      },
    });
  }, [columnData, targetData]);

  const totalAnoms = columnData.length;

  return (
    <div className={`relative ${className ?? "absolute inset-0"}`}>
      <div ref={containerRef} className="absolute inset-0" />

      <div className="absolute top-3 left-3 z-10 bg-bg-secondary/95 border border-border rounded p-3 backdrop-blur shadow-md w-64 space-y-2.5 max-h-[calc(100%-1.5rem)] overflow-auto">
        <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase text-muted-foreground border-b border-border pb-1.5">
          <Box className="w-3 h-3 text-gold" /> Sat → Subsuelo · 3D
        </div>

        {anomLoading ? (
          <div className="flex items-center gap-1.5 text-[11px] font-mono text-muted-foreground">
            <Loader2 className="w-3 h-3 animate-spin" /> Cargando anomalías…
          </div>
        ) : (
          <div className="text-[10px] font-mono text-muted-foreground">
            {totalAnoms} columnas activas · proyecto {active?.code ?? "—"}
          </div>
        )}

        <div>
          <div className="flex justify-between text-[10px] font-mono text-muted-foreground mb-1">
            <span>Exageración relieve</span>
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

        <div>
          <div className="flex justify-between text-[10px] font-mono text-muted-foreground mb-1">
            <span>Escala profundidad</span>
            <span className="text-foreground">{depthScale.toFixed(1)}×</span>
          </div>
          <input
            type="range"
            min={0.2}
            max={3}
            step={0.1}
            value={depthScale}
            onChange={(e) => setDepthScale(parseFloat(e.target.value))}
            className="w-full accent-gold h-1"
          />
        </div>

        <div className="pt-1.5 border-t border-border space-y-1.5">
          <div className="flex items-center gap-1 text-[10px] font-mono uppercase text-muted-foreground">
            <Layers className="w-3 h-3" /> Capas satelitales
          </div>
          {(Object.keys(INDEX_LABEL) as SatIndexCode[]).map((idx) => {
            const count = anomGrouped?.[idx]?.length ?? 0;
            const rgb = INDEX_COLOR[idx];
            return (
              <label
                key={idx}
                className="flex items-center gap-1.5 text-[11px] font-mono text-foreground cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={enabled[idx]}
                  onChange={(e) =>
                    setEnabled((s) => ({ ...s, [idx]: e.target.checked }))
                  }
                  className="accent-gold"
                />
                <span
                  className="inline-block w-2.5 h-2.5 rounded-sm"
                  style={{ background: `rgb(${rgb[0]},${rgb[1]},${rgb[2]})` }}
                />
                {INDEX_LABEL[idx]} ({count})
              </label>
            );
          })}
          <label className="flex items-center gap-1.5 text-[11px] font-mono text-foreground cursor-pointer pt-1 border-t border-border/50">
            <input
              type="checkbox"
              checked={showTargets}
              onChange={(e) => setShowTargets(e.target.checked)}
              className="accent-gold"
            />
            Targets superficie ({targets.length})
          </label>
        </div>

        <div className="pt-1 text-[9px] font-mono text-muted-foreground leading-snug">
          Columnas extruidas hacia abajo desde la superficie satelital real
          (DEM Copernicus + Esri Imagery). Profundidad ∝ score de la anomalía.
          Drag = rotar · Shift+drag = pan · Scroll = zoom.
        </div>
      </div>
    </div>
  );
}
