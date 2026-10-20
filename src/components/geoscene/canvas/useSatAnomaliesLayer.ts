// Capa deck.gl: anomalías satelitales extruidas como PolygonLayer.
// Altura ∝ score (0..1) escalado a metros; color por severidad + tono por índice.
// Registra cada polígono como `anomaly:<index_code>-<id8>` para que el copilot
// pueda enfocarlas (centroide del bbox o de la geometría).
import { useEffect, useMemo, useState } from "react";
import { PolygonLayer } from "@deck.gl/layers";
import { supabase } from "@/integrations/supabase/client";
import { registerAnchors, type AnchorEntry } from "./anchorRegistry";

type GeoJsonGeom =
  | { type: "Polygon"; coordinates: number[][][] }
  | { type: "MultiPolygon"; coordinates: number[][][][] };

type Row = {
  id: string;
  index_code: string;
  severity: string | null;
  score: number | null;
  area_ha: number | null;
  geometry: GeoJsonGeom | null;
  bbox: number[] | null;
};

const SEVERITY_COLOR: Record<string, [number, number, number]> = {
  high: [239, 68, 68],
  medium: [249, 115, 22],
  low: [234, 179, 8],
};

const INDEX_TINT: Record<string, [number, number, number]> = {
  IRON_OXIDE: [217, 119, 6],
  CLAY_MINERALS: [180, 140, 90],
  HYDROTHERMAL_ALTERATION: [217, 70, 239],
  STRUCTURAL_LINEAMENTS: [125, 211, 252],
  NDVI: [34, 197, 94],
  NDWI: [56, 189, 248],
  HISTORICAL_CHANGE: [244, 114, 182],
};

type Poly = {
  code: string;
  rings: number[][][]; // [outerRing, ...holes][]; deck.gl PolygonLayer acepta polígono simple o multi via array
  polygons: number[][][][]; // siempre array de polígonos
  centroidLng: number;
  centroidLat: number;
  elevation: number;
  severity: string;
  index: string;
  score: number;
  areaHa: number;
};

// Anillo válido: array de pares [lng, lat] numéricos. Geometrías malformadas
// en la base (proyectos de usuarios) no pueden tumbar el visor del dashboard.
function isValidRing(ring: unknown): ring is number[][] {
  return (
    Array.isArray(ring) &&
    ring.length >= 3 &&
    ring.every(
      (p) => Array.isArray(p) && p.length >= 2 && Number.isFinite(p[0]) && Number.isFinite(p[1]),
    )
  );
}

function centroidOfRing(ring: number[][]): [number, number] {
  let sx = 0;
  let sy = 0;
  for (const [x, y] of ring) {
    sx += x;
    sy += y;
  }
  return [sx / ring.length, sy / ring.length];
}

function toPolygons(g: GeoJsonGeom): number[][][][] {
  if (g.type === "Polygon") return [g.coordinates];
  return Array.isArray(g.coordinates) ? g.coordinates : [];
}

export function useSatAnomaliesLayer(projectId: string | null, visible = true) {
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    if (!projectId || !visible) {
      setRows([]);
      return;
    }
    let cancelled = false;
    supabase
      .from("satellite_anomalies")
      .select("id,index_code,severity,score,area_ha,geometry,bbox")
      .eq("project_id", projectId)
      .order("score", { ascending: false })
      .limit(500)
      .then(({ data }) => {
        if (!cancelled) setRows(((data ?? []) as Row[]).filter((r) => r.geometry));
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, visible]);

  const polys: Poly[] = useMemo(() => {
    const out: Poly[] = [];
    for (const r of rows) {
      if (!r.geometry) continue;
      const polygons = toPolygons(r.geometry);
      if (polygons.length === 0) continue;
      // Centroide aproximado: del primer anillo exterior del primer polígono.
      const outer = polygons[0]?.[0];
      if (!isValidRing(outer)) continue;
      const [cLng, cLat] = centroidOfRing(outer);
      const score = Math.max(0, Math.min(1, Number(r.score ?? 0)));
      const elevation = 80 + score * 520; // 80m..600m de altura visual
      out.push({
        code: `${r.index_code}-${r.id.slice(0, 8)}`,
        rings: polygons[0], // primer polígono (deck.gl maneja holes vía rings[])
        polygons,
        centroidLng: cLng,
        centroidLat: cLat,
        elevation,
        severity: (r.severity ?? "medium").toLowerCase(),
        index: r.index_code,
        score,
        areaHa: Number(r.area_ha ?? 0),
      });
    }
    return out;
  }, [rows]);

  useEffect(() => {
    const entries: AnchorEntry[] = polys.map((p) => ({
      kind: "anomaly",
      code: p.code,
      lng: p.centroidLng,
      lat: p.centroidLat,
    }));
    return registerAnchors(entries);
  }, [polys]);

  const layer = useMemo(
    () =>
      visible && polys.length > 0
        ? new PolygonLayer({
            id: "remote_sensing.sentinel2_alteration",
            data: polys,
            pickable: true,
            extruded: true,
            wireframe: false,
            filled: true,
            stroked: true,
            getPolygon: (d: Poly) => d.rings,
            getElevation: (d: Poly) => d.elevation,
            getFillColor: (d: Poly) => {
              const sev = SEVERITY_COLOR[d.severity] ?? SEVERITY_COLOR.medium;
              const tint = INDEX_TINT[d.index] ?? sev;
              // Mezcla 60% severidad + 40% índice para mantener legibilidad de prioridad.
              return [
                Math.round(sev[0] * 0.6 + tint[0] * 0.4),
                Math.round(sev[1] * 0.6 + tint[1] * 0.4),
                Math.round(sev[2] * 0.6 + tint[2] * 0.4),
                70,
              ];
            },
            getLineColor: [247, 245, 240, 200],
            getLineWidth: 1,
            lineWidthUnits: "pixels",
            elevationScale: 1,
          })
        : null,
    [polys, visible],
  );

  return { layer, count: polys.length };
}
