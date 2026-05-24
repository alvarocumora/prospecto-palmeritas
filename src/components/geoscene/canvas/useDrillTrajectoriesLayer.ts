// Sprint 4.2 — Trayectorias reales de sondajes + intercepts coloreados por ley.
// drill_holes guarda easting/northing como metros locales relativos al centro
// del proyecto. Convertimos a lng/lat aquí y proyectamos la trayectoria 3D
// usando azimuth/dip y la profundidad real.
import { useEffect, useMemo, useState } from "react";
import { PathLayer } from "@deck.gl/layers";
import { supabase } from "@/integrations/supabase/client";
import { registerAnchors, type AnchorEntry } from "./anchorRegistry";

type Hole = {
  id?: string;
  hole_id: string;
  easting: number | null;
  northing: number | null;
  elevation: number | null;
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

function auColor(au: number): [number, number, number] {
  if (au >= 3) return [220, 38, 38];
  if (au >= 1) return [249, 115, 22];
  if (au >= 0.3) return [234, 179, 8];
  if (au > 0) return [34, 197, 94];
  return [120, 120, 120];
}

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

function holeCollarLngLat(
  hole: Hole,
  centerLng: number,
  centerLat: number,
): { lng: number; lat: number; alt: number } {
  const mPerDegLng = M_PER_DEG_LAT * Math.cos((centerLat * Math.PI) / 180);
  return {
    lng: centerLng + Number(hole.easting ?? 0) / mPerDegLng,
    lat: centerLat + Number(hole.northing ?? 0) / M_PER_DEG_LAT,
    alt: Number(hole.elevation ?? 0),
  };
}

function holeSegment(
  hole: Hole,
  centerLng: number,
  centerLat: number,
  fromM: number,
  toM: number,
): Vec3[] {
  const azRad = ((hole.azimuth ?? 0) * Math.PI) / 180;
  const dipRad = ((hole.dip ?? -90) * Math.PI) / 180;
  const horiz = Math.cos(dipRad);
  const vert = -Math.sin(dipRad);
  const ex = horiz * Math.sin(azRad);
  const ny = horiz * Math.cos(azRad);
  const { lng, lat, alt } = holeCollarLngLat(hole, centerLng, centerLat);
  return [
    offsetToLngLat(lng, lat, alt, ex * fromM, ny * fromM, vert * fromM),
    offsetToLngLat(lng, lat, alt, ex * toM, ny * toM, vert * toM),
  ];
}

type RealTrajectory = {
  hole_id: string;
  points: Array<{ md: number; x: number; y: number; z: number }>;
};

export function useDrillTrajectoriesLayer(
  projectId: string | null,
  centerLng: number,
  centerLat: number,
  visible = true,
) {
  const [holes, setHoles] = useState<Hole[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);
  const [real, setReal] = useState<Map<string, RealTrajectory["points"]>>(new Map());

  useEffect(() => {
    if (!projectId || !visible) {
      setHoles([]);
      setLogs([]);
      setReal(new Map());
      return;
    }
    let cancelled = false;
    (async () => {
      const [{ data: h }, { data: l }] = await Promise.all([
        supabase
          .from("drill_holes")
          .select(
            "id,hole_id,easting,northing,elevation,actual_depth,planned_depth,azimuth,dip,status",
          )
          .eq("project_id", projectId),
        supabase
          .from("drill_core_logs")
          .select("hole_id,depth_from,depth_to,au_gpt")
          .eq("project_id", projectId)
          .gt("au_gpt", 0),
      ]);
      if (cancelled) return;
      const holeRows = ((h ?? []) as (Hole & { id: string })[]).filter(
        (x) => x.easting != null && x.northing != null,
      );
      setHoles(holeRows);
      setLogs((l ?? []) as Log[]);

      const holeIds = holeRows.map((x) => x.id);
      if (holeIds.length > 0) {
        const { data: trajRows } = await supabase
          .from("drill_hole_trajectories")
          .select("hole_id,points")
          .in("hole_id", holeIds);
        if (cancelled) return;
        const m = new Map<string, RealTrajectory["points"]>();
        const codeByUuid = new Map(holeRows.map((x) => [x.id, x.hole_id] as const));
        for (const r of trajRows ?? []) {
          const code = codeByUuid.get(r.hole_id as string);
          const pts = r.points as RealTrajectory["points"] | null;
          if (code && Array.isArray(pts) && pts.length >= 2) m.set(code, pts);
        }
        setReal(m);
      } else {
        setReal(new Map());
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, visible]);

  // Si hay trayectoria real, la usamos. La engine devuelve x/y en el mismo
  // marco local (metros) que collar.easting/northing, y z absoluto. La
  // convertimos a lng/lat respecto al centro del proyecto.
  function realPath(h: Hole, pts: RealTrajectory["points"]): Vec3[] {
    const collarE = Number(h.easting ?? 0);
    const collarN = Number(h.northing ?? 0);
    const mPerDegLng = M_PER_DEG_LAT * Math.cos((centerLat * Math.PI) / 180);
    return pts.map((p) => [
      centerLng + p.x / mPerDegLng,
      centerLat + p.y / M_PER_DEG_LAT,
      p.z,
    ]).map(
      (v, i) =>
        // Si la engine devolvió coords relativas al collar (no globales),
        // ajustamos sumando el offset del collar. Para futuro-proofing
        // comprobamos por el primer punto.
        i === 0 && Math.hypot(pts[0].x - collarE, pts[0].y - collarN) > 1
          ? ([
              centerLng + (pts[i].x + collarE) / mPerDegLng,
              centerLat + (pts[i].y + collarN) / M_PER_DEG_LAT,
              pts[i].z,
            ] as Vec3)
          : (v as Vec3),
    );
  }

  const trajectories = useMemo(
    () =>
      holes.map((h) => {
        const total = Number(h.actual_depth ?? h.planned_depth ?? 100);
        const collar = holeCollarLngLat(h, centerLng, centerLat);
        const realPts = real.get(h.hole_id);
        const path = realPts && realPts.length >= 2
          ? realPath(h, realPts)
          : holeSegment(h, centerLng, centerLat, 0, total);
        return {
          code: h.hole_id,
          path,
          status: (h.status ?? "planned").toLowerCase(),
          collarLng: collar.lng,
          collarLat: collar.lat,
          isReal: Boolean(realPts && realPts.length >= 2),
        };
      }),
    // realPath uses centerLng/centerLat which are deps below
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [holes, centerLng, centerLat, real],
  );

  const intercepts = useMemo(() => {
    const byHole = new Map(holes.map((h) => [h.hole_id, h] as const));
    return logs
      .filter((l) => l.depth_from != null && l.depth_to != null && byHole.has(l.hole_id))
      .map((l, i) => {
        const h = byHole.get(l.hole_id)!;
        return {
          id: `${l.hole_id}-${i}`,
          path: holeSegment(h, centerLng, centerLat, Number(l.depth_from), Number(l.depth_to)),
          au: Number(l.au_gpt ?? 0),
        };
      });
  }, [holes, logs, centerLng, centerLat]);

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
    if (!visible) return [] as PathLayer[];
    const out: PathLayer[] = [];
    if (trajectories.length > 0) {
      out.push(
        new PathLayer({
          id: "geoscene-trajectories",
          data: trajectories,
          pickable: true,
          widthUnits: "pixels",
          getPath: (d: (typeof trajectories)[number]) => d.path,
          getColor: (d: (typeof trajectories)[number]) =>
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
          getPath: (d: (typeof intercepts)[number]) => d.path,
          getColor: (d: (typeof intercepts)[number]) =>
            [...auColor(d.au), 240] as [number, number, number, number],
          getWidth: 6,
        }),
      );
    }
    return out;
  }, [visible, trajectories, intercepts]);

  return { layers, holeCount: trajectories.length, interceptCount: intercepts.length };
}
