// Sprint 4.2 — Trayectorias reales de sondajes + intercepts coloreados por ley.
// Calcula la polilínea 3D del sondaje a partir de collar + az/dip + depth y
// renderiza un PathLayer para la trayectoria y un segundo PathLayer para los
// intercepts (segmentos coloreados por Au g/t).
import { useEffect, useMemo, useState } from "react";
import { PathLayer } from "@deck.gl/layers";
import { supabase } from "@/integrations/supabase/client";
import { registerAnchors, type AnchorEntry } from "./anchorRegistry";

type Hole = {
  hole_id: string;
  collar_lng: number | null;
  collar_lat: number | null;
  collar_elevation: number | null;
  actual_depth: number | null;
  planned_depth: number | null;
  azimuth: number | null;
  dip: number | null;
  status: string | null;
};

type Log = {
  hole_id: string;
  depth_from: number | null;
  depth_to: number | null;
  au_gpt: number | null;
};

type Vec3 = [number, number, number];

const M_PER_DEG_LAT = 111320;

// Color rampa por ley de Au (g/t). Verde<0.3, amarillo 0.3-1, naranja 1-3, rojo>3.
function auColor(au: number): [number, number, number] {
  if (au >= 3) return [220, 38, 38];
  if (au >= 1) return [249, 115, 22];
  if (au >= 0.3) return [234, 179, 8];
  if (au > 0) return [34, 197, 94];
  return [120, 120, 120];
}

// Proyecta un offset (este, norte, vertical) en metros a delta lng/lat/alt.
function offsetToLngLat(
  collarLng: number,
  collarLat: number,
  collarAlt: number,
  east: number,
  north: number,
  down: number,
): Vec3 {
  const mPerDegLng = M_PER_DEG_LAT * Math.cos((collarLat * Math.PI) / 180);
  return [collarLng + east / mPerDegLng, collarLat + north / M_PER_DEG_LAT, collarAlt - down];
}

// Genera los puntos de la trayectoria desde from→to metros a lo largo de az/dip.
function holeSegment(hole: Hole, fromM: number, toM: number): Vec3[] {
  const azRad = ((hole.azimuth ?? 0) * Math.PI) / 180;
  const dipRad = ((hole.dip ?? -90) * Math.PI) / 180; // dip negativo = hacia abajo
  // Vector unitario (este, norte, abajo) por metro avanzado en el hoyo.
  const horiz = Math.cos(dipRad);
  const vert = -Math.sin(dipRad); // dip=-90 → vert=+1 (todo hacia abajo)
  const ex = horiz * Math.sin(azRad);
  const ny = horiz * Math.cos(azRad);
  const lng = Number(hole.collar_lng);
  const lat = Number(hole.collar_lat);
  const alt = Number(hole.collar_elevation ?? 0);
  return [
    offsetToLngLat(lng, lat, alt, ex * fromM, ny * fromM, vert * fromM),
    offsetToLngLat(lng, lat, alt, ex * toM, ny * toM, vert * toM),
  ];
}

export function useDrillTrajectoriesLayer(projectId: string | null, visible = true) {
  const [holes, setHoles] = useState<Hole[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);

  useEffect(() => {
    if (!projectId || !visible) {
      setHoles([]);
      setLogs([]);
      return;
    }
    let cancelled = false;
    Promise.all([
      supabase
        .from("drill_holes")
        .select(
          "hole_id,collar_lng,collar_lat,collar_elevation,actual_depth,planned_depth,azimuth,dip,status",
        )
        .eq("project_id", projectId),
      supabase
        .from("drill_core_logs")
        .select("hole_id,depth_from,depth_to,au_gpt")
        .eq("project_id", projectId)
        .gt("au_gpt", 0),
    ]).then(([h, l]) => {
      if (cancelled) return;
      setHoles(((h.data ?? []) as Hole[]).filter((x) => x.collar_lng != null && x.collar_lat != null));
      setLogs((l.data ?? []) as Log[]);
    });
    return () => {
      cancelled = true;
    };
  }, [projectId, visible]);

  // Trayectorias completas (collar → EOH)
  const trajectories = useMemo(
    () =>
      holes.map((h) => {
        const total = Number(h.actual_depth ?? h.planned_depth ?? 100);
        const path = holeSegment(h, 0, total);
        return {
          code: h.hole_id,
          path,
          status: (h.status ?? "planned").toLowerCase(),
          collarLng: Number(h.collar_lng),
          collarLat: Number(h.collar_lat),
        };
      }),
    [holes],
  );

  // Intercepts: para cada log con Au, generar segmento sobre la trayectoria.
  const intercepts = useMemo(() => {
    const byHole = new Map(holes.map((h) => [h.hole_id, h] as const));
    return logs
      .filter((l) => l.depth_from != null && l.depth_to != null && byHole.has(l.hole_id))
      .map((l, i) => {
        const h = byHole.get(l.hole_id)!;
        const path = holeSegment(h, Number(l.depth_from), Number(l.depth_to));
        return {
          id: `${l.hole_id}-${i}`,
          path,
          au: Number(l.au_gpt ?? 0),
        };
      });
  }, [holes, logs]);

  // Registro de anclajes: usa el collar como punto de foco del sondaje.
  useEffect(() => {
    const entries: AnchorEntry[] = trajectories.map((t) => ({
      kind: "hole",
      code: t.code,
      lng: t.collarLng,
      lat: t.collarLat,
    }));
    return registerAnchors(entries);
  }, [trajectories]);

  const layers = useMemo(() => {
    if (!visible) return [] as ReturnType<typeof buildLayers>;
    return buildLayers(trajectories, intercepts);
  }, [visible, trajectories, intercepts]);

  return { layers, holeCount: trajectories.length, interceptCount: intercepts.length };
}

function buildLayers(
  trajectories: Array<{ code: string; path: Vec3[]; status: string }>,
  intercepts: Array<{ id: string; path: Vec3[]; au: number }>,
) {
  const out: PathLayer[] = [];
  if (trajectories.length > 0) {
    out.push(
      new PathLayer({
        id: "geoscene-trajectories",
        data: trajectories,
        pickable: true,
        widthUnits: "pixels",
        getPath: (d) => d.path,
        getColor: (d) =>
          d.status === "completed"
            ? [180, 180, 200, 220]
            : d.status === "in_progress"
              ? [96, 165, 250, 220]
              : [148, 163, 184, 180],
        getWidth: 2.5,
      }),
    );
  }
  if (intercepts.length > 0) {
    out.push(
      new PathLayer({
        id: "geoscene-intercepts",
        data: intercepts,
        pickable: true,
        widthUnits: "pixels",
        getPath: (d) => d.path,
        getColor: (d) => [...auColor(d.au), 240] as [number, number, number, number],
        getWidth: 6,
      }),
    );
  }
  return out;
}
