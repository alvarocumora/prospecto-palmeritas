// Sprint 1+ — Visor 3D "Satélite → Subsuelo" enriquecido para plan de mina.
// Capas: anomalías (columnas), VETAS inclinadas (planos 3D), PÓRFIDOS (cilindros profundos),
// SONDAJES propuestos (PathLayer 3D) y FOOTPRINT de rajo abierto.
import { useEffect, useMemo, useRef, useState } from "react";
import maplibregl, { type Map as MLMap } from "maplibre-gl";
import { MapboxOverlay } from "@deck.gl/mapbox";
import {
  ColumnLayer,
  ScatterplotLayer,
  SolidPolygonLayer,
  PathLayer,
  PolygonLayer,
} from "@deck.gl/layers";
import "maplibre-gl/dist/maplibre-gl.css";
import { Box, Layers, Loader2, Mountain, Pickaxe, Crosshair } from "lucide-react";
import { useProjects } from "@/hooks/useProjects";
import {
  useProjectSatelliteAnomalies,
  type SatIndexCode,
  type AnomalyRow,
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
      tiles: ["https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"],
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
  IRON_OXIDE: [220, 90, 40],
  CLAY_MINERALS: [220, 200, 80],
  HYDROTHERMAL_ALTERATION: [200, 60, 200],
  STRUCTURAL_LINEAMENTS: [80, 200, 230],
};
const INDEX_LABEL: Record<SatIndexCode, string> = {
  IRON_OXIDE: "Óxidos Fe",
  CLAY_MINERALS: "Arcillas",
  HYDROTHERMAL_ALTERATION: "Hidrotermal",
  STRUCTURAL_LINEAMENTS: "Lineamientos",
};
const SEVERITY_ALPHA = { low: 100, medium: 170, high: 230 } as const;

function centroidOfGeometry(geom: GeoJSON.Geometry): [number, number] | null {
  let sx = 0, sy = 0, n = 0;
  const walk = (c: unknown): void => {
    if (!Array.isArray(c)) return;
    if (typeof c[0] === "number" && typeof c[1] === "number") {
      sx += c[0] as number; sy += c[1] as number; n += 1; return;
    }
    for (const item of c) walk(item);
  };
  walk((geom as { coordinates: unknown }).coordinates);
  if (n === 0) return null;
  return [sx / n, sy / n];
}

// Extrae todos los segmentos LineString de una geometría
function extractSegments(geom: GeoJSON.Geometry): Array<[[number, number], [number, number]]> {
  const segs: Array<[[number, number], [number, number]]> = [];
  const pushLine = (coords: number[][]) => {
    for (let i = 0; i < coords.length - 1; i++) {
      segs.push([
        [coords[i][0], coords[i][1]],
        [coords[i + 1][0], coords[i + 1][1]],
      ]);
    }
  };
  if (geom.type === "LineString") pushLine(geom.coordinates);
  else if (geom.type === "MultiLineString") geom.coordinates.forEach(pushLine);
  return segs;
}

// Convierte metros → grados (lat, lng) en una latitud dada
function metersToDegrees(meters: number, lat: number) {
  const dLat = meters / 111320;
  const dLng = meters / (111320 * Math.cos((lat * Math.PI) / 180));
  return { dLat, dLng };
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
  const [depthScale, setDepthScale] = useState(1.0);
  const [dipDeg, setDipDeg] = useState(70); // buzamiento veta
  const [veinDepthM, setVeinDepthM] = useState(400);
  const [porphyryDepthM, setPorphyryDepthM] = useState(1200);
  const [drillLengthM, setDrillLengthM] = useState(500);
  const [drillDipDeg, setDrillDipDeg] = useState(70);
  const [enabled, setEnabled] = useState<Record<SatIndexCode, boolean>>({
    IRON_OXIDE: true,
    CLAY_MINERALS: true,
    HYDROTHERMAL_ALTERATION: true,
    STRUCTURAL_LINEAMENTS: true,
  });
  const [showColumns, setShowColumns] = useState(true);
  const [showVeins, setShowVeins] = useState(true);
  const [showPorphyry, setShowPorphyry] = useState(true);
  const [showDrillPlan, setShowDrillPlan] = useState(true);
  const [showPit, setShowPit] = useState(true);
  const [showTargets, setShowTargets] = useState(true);
  const [styleReady, setStyleReady] = useState(false);

  const center = useMemo<[number, number]>(() => {
    if (active?.center_lng != null && active?.center_lat != null) {
      return [active.center_lng, active.center_lat];
    }
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
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");
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
    try { m.setTerrain({ source: "terrain", exaggeration }); } catch { /* ignore */ }
  }, [exaggeration, styleReady]);

  // ---------- COLUMNAS de anomalías ----------
  const columnData = useMemo(() => {
    if (!anomGrouped || !showColumns) return [];
    const out: Array<{
      position: [number, number]; depth: number;
      color: [number, number, number, number];
      name: string; index: SatIndexCode; severity: string; score: number;
    }> = [];
    (Object.keys(anomGrouped) as SatIndexCode[]).forEach((idx) => {
      if (!enabled[idx]) return;
      // Lineamientos los renderizamos como vetas, no como columnas
      if (idx === "STRUCTURAL_LINEAMENTS") return;
      for (const a of anomGrouped[idx]) {
        const c = centroidOfGeometry(a.geometry);
        if (!c) continue;
        const score = a.score ?? 50;
        const depth = Math.max(40, score * 5 * depthScale);
        const rgb = INDEX_COLOR[idx];
        const alpha = SEVERITY_ALPHA[a.severity] ?? 180;
        out.push({
          position: c, depth,
          color: [...rgb, alpha] as [number, number, number, number],
          name: a.notes ?? INDEX_LABEL[idx],
          index: idx, severity: a.severity, score,
        });
      }
    });
    return out;
  }, [anomGrouped, enabled, depthScale, showColumns]);

  // ---------- VETAS: planos inclinados 3D desde lineamientos ----------
  const veinPolygons = useMemo(() => {
    if (!anomGrouped || !showVeins || !enabled.STRUCTURAL_LINEAMENTS) return [];
    const dipRad = (dipDeg * Math.PI) / 180;
    // Offset horizontal de la traza inferior: D / tan(dip)
    const horizOffsetM = veinDepthM / Math.tan(dipRad);
    const polys: Array<{
      polygon: [number, number, number][];
      name: string; score: number; color: [number, number, number, number];
    }> = [];
    for (const a of anomGrouped.STRUCTURAL_LINEAMENTS) {
      const segs = extractSegments(a.geometry);
      for (const [p1, p2] of segs) {
        // vector segmento
        const midLat = (p1[1] + p2[1]) / 2;
        const dx = p2[0] - p1[0];
        const dy = p2[1] - p1[1];
        const len = Math.hypot(dx, dy);
        if (len < 1e-7) continue;
        // perpendicular unitario (en grados, sin corregir longitud aún)
        let nx = -dy / len;
        let ny = dx / len;
        // convertir offset en metros a grados sobre la dirección perpendicular
        const { dLat, dLng } = metersToDegrees(horizOffsetM, midLat);
        // escalar nx/ny (que están en "grados normalizados" tras dividir por len de grados)
        // Aproximación: aplicamos offset perpendicular en lng/lat directamente
        const offLng = nx * dLng;
        const offLat = ny * dLat;
        const z0 = 0;
        const zBot = -veinDepthM;
        const score = a.score ?? 60;
        const alpha = Math.min(220, 120 + score);
        polys.push({
          polygon: [
            [p1[0], p1[1], z0],
            [p2[0], p2[1], z0],
            [p2[0] + offLng, p2[1] + offLat, zBot],
            [p1[0] + offLng, p1[1] + offLat, zBot],
          ],
          name: a.notes ?? "Veta inferida",
          score,
          color: [80, 220, 230, alpha] as [number, number, number, number],
        });
      }
    }
    return polys;
  }, [anomGrouped, showVeins, enabled.STRUCTURAL_LINEAMENTS, dipDeg, veinDepthM]);

  // ---------- PÓRFIDOS: cilindros profundos en clusters de alteración ----------
  const porphyryData = useMemo(() => {
    if (!anomGrouped || !showPorphyry) return [];
    // Heurística: una "raíz porfídica" por anomalía hidrotermal con score ≥ 65
    // y radio escalado por área o score.
    const hydros = (anomGrouped.HYDROTHERMAL_ALTERATION ?? []).filter(
      (a: AnomalyRow) => (a.score ?? 0) >= 65,
    );
    const out: Array<{
      position: [number, number]; depth: number; radius: number;
      color: [number, number, number, number]; name: string; score: number;
    }> = [];
    for (const a of hydros) {
      const c = centroidOfGeometry(a.geometry);
      if (!c) continue;
      const score = a.score ?? 70;
      const radius = 120 + score * 2.5; // 200–370 m
      const depth = porphyryDepthM * (0.6 + score / 250);
      out.push({
        position: c, depth, radius,
        color: [180, 60, 200, 150],
        name: a.notes ?? "Raíz porfídica inferida",
        score,
      });
    }
    return out;
  }, [anomGrouped, showPorphyry, porphyryDepthM]);

  // ---------- PLAN DE MINA: sondajes propuestos como paths 3D ----------
  const drillPaths = useMemo(() => {
    if (!showDrillPlan) return [];
    const dipRad = (drillDipDeg * Math.PI) / 180;
    const horiz = drillLengthM * Math.cos(dipRad);
    const vert = drillLengthM * Math.sin(dipRad);
    const out: Array<{
      path: [number, number, number][]; color: [number, number, number]; name: string;
    }> = [];
    for (const t of targets) {
      if (t.lat == null || t.lng == null) return out;
      // dirección perpendicular al norte aproximado (azimut 90° E)
      const { dLng } = metersToDegrees(horiz, t.lat);
      const color: [number, number, number] =
        t.priority === "critical" ? [230, 60, 60]
        : t.priority === "high" ? [240, 180, 60]
        : [120, 180, 240];
      out.push({
        path: [
          [t.lng, t.lat, 0],
          [t.lng + dLng, t.lat, -vert],
        ],
        color,
        name: `${t.code} · ${t.name}`,
      });
    }
    return out;
  }, [targets, showDrillPlan, drillLengthM, drillDipDeg]);

  // ---------- FOOTPRINT de rajo abierto en superficie ----------
  const pitPolygons = useMemo(() => {
    if (!showPit) return [];
    const out: Array<{ polygon: [number, number][]; name: string; priority: string }> = [];
    const criticals = targets.filter(
      (t) => t.lat != null && t.lng != null && (t.priority === "critical" || t.priority === "high"),
    );
    for (const t of criticals) {
      // Círculo aproximado de 300 m
      const { dLat, dLng } = metersToDegrees(300, t.lat!);
      const ring: [number, number][] = [];
      for (let i = 0; i < 32; i++) {
        const ang = (i / 32) * Math.PI * 2;
        ring.push([t.lng! + Math.cos(ang) * dLng, t.lat! + Math.sin(ang) * dLat]);
      }
      ring.push(ring[0]);
      out.push({ polygon: ring, name: `Rajo conceptual · ${t.code}`, priority: t.priority ?? "" });
    }
    return out;
  }, [targets, showPit]);

  const targetData = useMemo(() => {
    if (!showTargets) return [];
    return targets
      .filter((t) => t.lat != null && t.lng != null)
      .map((t) => ({
        position: [t.lng!, t.lat!] as [number, number],
        radius: 40 + (t.score ?? 50) * 1.5,
        color:
          t.priority === "critical" ? [220, 60, 60]
          : t.priority === "high" ? [240, 180, 60]
          : t.priority === "medium" ? [80, 160, 220]
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
        // Footprint rajo (superficie, sin extrudir)
        new PolygonLayer({
          id: "open-pit-footprint",
          data: pitPolygons,
          pickable: true,
          stroked: true,
          filled: true,
          getPolygon: (d) => d.polygon,
          getFillColor: [255, 200, 60, 50],
          getLineColor: [255, 200, 60, 220],
          getLineWidth: 4,
          lineWidthMinPixels: 2,
        }),
        // Pórfidos (cilindros profundos)
        new ColumnLayer({
          id: "porphyry-bodies",
          data: porphyryData,
          diskResolution: 24,
          extruded: true,
          pickable: true,
          elevationScale: -1,
          radiusUnits: "meters",
          getPosition: (d) => d.position,
          getElevation: (d) => d.depth,
          getFillColor: (d) => d.color,
          getLineColor: [40, 10, 40, 255],
          getRadius: (d) => d.radius,
        }),
        // Vetas (planos inclinados 3D)
        new SolidPolygonLayer({
          id: "vein-planes",
          data: veinPolygons,
          pickable: true,
          extruded: false,
          filled: true,
          wireframe: true,
          _normalize: false,
          getPolygon: (d) => d.polygon,
          getFillColor: (d) => d.color,
          getLineColor: [220, 240, 255, 255],
        }),
        // Anomalías (columnas extruidas)
        new ColumnLayer({
          id: "sat-columns-3d",
          data: columnData,
          diskResolution: 16,
          radius: 60,
          extruded: true,
          pickable: true,
          elevationScale: -1,
          getPosition: (d) => d.position,
          getElevation: (d) => d.depth,
          getFillColor: (d) => d.color,
          getLineColor: [10, 10, 10, 255],
        }),
        // Sondajes propuestos
        new PathLayer({
          id: "drill-plan",
          data: drillPaths,
          pickable: true,
          widthUnits: "pixels",
          getPath: (d) => d.path,
          getColor: (d) => d.color,
          getWidth: 4,
          capRounded: true,
          jointRounded: true,
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
          getPosition: (d) => d.position,
          getRadius: (d) => d.radius,
          getFillColor: (d) => [...d.color, 180] as [number, number, number, number],
          getLineColor: [255, 255, 255, 255],
        }),
      ],
      getTooltip: (info) => {
        const object = info.object as Record<string, unknown> | undefined;
        const layer = info.layer;
        if (!object || !layer) return null;
        const wrap = (html: string) => ({
          html: `<div style="font-family:monospace;font-size:11px;padding:4px">${html}</div>`,
          style: { background: "rgba(20,20,20,0.92)", color: "#fff", borderRadius: "4px" },
        });
        if (layer.id === "sat-columns-3d") {
          const o = object as { name: string; index: SatIndexCode; severity: string; score: number; depth: number };
          return wrap(`<b>${INDEX_LABEL[o.index]}</b><br/>${o.severity} · score ${o.score.toFixed(0)}<br/>Prof. inferida: ${o.depth.toFixed(0)} m<br/><i>${o.name}</i>`);
        }
        if (layer.id === "vein-planes") {
          const o = object as { name: string; score: number };
          return wrap(`<b>Veta</b> (dip ${dipDeg}°, prof. ${veinDepthM} m)<br/>${o.name}<br/>score ${o.score.toFixed(0)}`);
        }
        if (layer.id === "porphyry-bodies") {
          const o = object as { name: string; score: number; depth: number; radius: number };
          return wrap(`<b>Pórfido (raíz)</b><br/>${o.name}<br/>radio ${o.radius.toFixed(0)} m · prof. ${o.depth.toFixed(0)} m · score ${o.score.toFixed(0)}`);
        }
        if (layer.id === "drill-plan") {
          const o = object as { name: string };
          return wrap(`<b>Sondaje propuesto</b><br/>${o.name}<br/>${drillLengthM} m @ ${drillDipDeg}°`);
        }
        if (layer.id === "open-pit-footprint") {
          const o = object as { name: string };
          return wrap(`<b>${o.name}</b><br/>Footprint preliminar (radio 300 m)`);
        }
        if (layer.id === "targets-surface") {
          const o = object as { name: string; score: number | null };
          return wrap(`<b>${o.name}</b><br/>Score: ${o.score ?? "—"}`);
        }
        return null;
      },
    });
  }, [columnData, veinPolygons, porphyryData, drillPaths, pitPolygons, targetData, dipDeg, veinDepthM, drillLengthM, drillDipDeg]);

  return (
    <div className={`relative ${className ?? "absolute inset-0"}`}>
      <div ref={containerRef} className="absolute inset-0" />

      <div className="absolute top-3 left-3 z-10 bg-bg-secondary/95 border border-border rounded p-3 backdrop-blur shadow-md w-72 space-y-2.5 max-h-[calc(100%-1.5rem)] overflow-auto">
        <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase text-muted-foreground border-b border-border pb-1.5">
          <Box className="w-3 h-3 text-gold" /> Plan de mina · 3D
        </div>

        {anomLoading ? (
          <div className="flex items-center gap-1.5 text-[11px] font-mono text-muted-foreground">
            <Loader2 className="w-3 h-3 animate-spin" /> Cargando anomalías…
          </div>
        ) : (
          <div className="text-[10px] font-mono text-muted-foreground">
            {columnData.length} anomalías · {veinPolygons.length} vetas · {porphyryData.length} pórfidos · proyecto {active?.code ?? "—"}
          </div>
        )}

        {/* Sliders globales */}
        <Slider label="Exageración relieve" value={exaggeration} min={0} max={5} step={0.1} suffix="×" onChange={setExaggeration} />
        <Slider label="Escala prof. anomalías" value={depthScale} min={0.2} max={3} step={0.1} suffix="×" onChange={setDepthScale} />

        {/* Vetas */}
        <div className="pt-1.5 border-t border-border space-y-1.5">
          <label className="flex items-center gap-1.5 text-[10px] font-mono uppercase text-muted-foreground cursor-pointer">
            <input type="checkbox" checked={showVeins} onChange={(e) => setShowVeins(e.target.checked)} className="accent-gold" />
            <Mountain className="w-3 h-3" /> Vetas (desde lineamientos)
          </label>
          {showVeins && (
            <>
              <Slider label="Buzamiento" value={dipDeg} min={30} max={90} step={1} suffix="°" onChange={setDipDeg} />
              <Slider label="Profundidad veta" value={veinDepthM} min={100} max={1200} step={50} suffix=" m" onChange={setVeinDepthM} />
            </>
          )}
        </div>

        {/* Pórfidos */}
        <div className="pt-1.5 border-t border-border space-y-1.5">
          <label className="flex items-center gap-1.5 text-[10px] font-mono uppercase text-muted-foreground cursor-pointer">
            <input type="checkbox" checked={showPorphyry} onChange={(e) => setShowPorphyry(e.target.checked)} className="accent-gold" />
            <Box className="w-3 h-3" /> Pórfidos (raíces inferidas)
          </label>
          {showPorphyry && (
            <Slider label="Prof. máx. pórfido" value={porphyryDepthM} min={400} max={2500} step={100} suffix=" m" onChange={setPorphyryDepthM} />
          )}
        </div>

        {/* Plan de sondajes + rajo */}
        <div className="pt-1.5 border-t border-border space-y-1.5">
          <label className="flex items-center gap-1.5 text-[10px] font-mono uppercase text-muted-foreground cursor-pointer">
            <input type="checkbox" checked={showDrillPlan} onChange={(e) => setShowDrillPlan(e.target.checked)} className="accent-gold" />
            <Pickaxe className="w-3 h-3" /> Sondajes propuestos
          </label>
          {showDrillPlan && (
            <>
              <Slider label="Largo sondaje" value={drillLengthM} min={100} max={1500} step={50} suffix=" m" onChange={setDrillLengthM} />
              <Slider label="Inclinación sondaje" value={drillDipDeg} min={45} max={90} step={1} suffix="°" onChange={setDrillDipDeg} />
            </>
          )}
          <label className="flex items-center gap-1.5 text-[10px] font-mono uppercase text-muted-foreground cursor-pointer">
            <input type="checkbox" checked={showPit} onChange={(e) => setShowPit(e.target.checked)} className="accent-gold" />
            <Crosshair className="w-3 h-3" /> Footprint rajo conceptual
          </label>
        </div>

        {/* Capas satelitales */}
        <div className="pt-1.5 border-t border-border space-y-1.5">
          <label className="flex items-center gap-1.5 text-[10px] font-mono uppercase text-muted-foreground cursor-pointer">
            <input type="checkbox" checked={showColumns} onChange={(e) => setShowColumns(e.target.checked)} className="accent-gold" />
            <Layers className="w-3 h-3" /> Columnas anomalías
          </label>
          {(Object.keys(INDEX_LABEL) as SatIndexCode[]).map((idx) => {
            const count = anomGrouped?.[idx]?.length ?? 0;
            const rgb = INDEX_COLOR[idx];
            return (
              <label key={idx} className="flex items-center gap-1.5 text-[11px] font-mono text-foreground cursor-pointer pl-3">
                <input type="checkbox" checked={enabled[idx]} onChange={(e) => setEnabled((s) => ({ ...s, [idx]: e.target.checked }))} className="accent-gold" />
                <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: `rgb(${rgb[0]},${rgb[1]},${rgb[2]})` }} />
                {INDEX_LABEL[idx]} ({count})
              </label>
            );
          })}
          <label className="flex items-center gap-1.5 text-[11px] font-mono text-foreground cursor-pointer pt-1 border-t border-border/50">
            <input type="checkbox" checked={showTargets} onChange={(e) => setShowTargets(e.target.checked)} className="accent-gold" />
            Targets superficie ({targets.length})
          </label>
        </div>

        <div className="pt-1 text-[9px] font-mono text-muted-foreground leading-snug">
          Vetas se proyectan desde lineamientos satelitales con el buzamiento configurado.
          Pórfidos se infieren desde anomalías hidrotermales score ≥ 65. Sondajes propuestos
          parten desde cada target con la inclinación seleccionada. Drag = rotar · Shift+drag = pan.
        </div>
      </div>
    </div>
  );
}

function Slider({
  label, value, min, max, step, suffix, onChange,
}: {
  label: string; value: number; min: number; max: number; step: number; suffix: string;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex justify-between text-[10px] font-mono text-muted-foreground mb-1">
        <span>{label}</span>
        <span className="text-foreground">{value.toFixed(step < 1 ? 1 : 0)}{suffix}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full accent-gold h-1"
      />
    </div>
  );
}
