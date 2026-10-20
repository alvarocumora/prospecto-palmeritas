// Trayectorias reales/planificadas de sondajes + interceptos coloreados por ley.
// La separación por evidencia evita mostrar un sondaje propuesto como dato medido.
import { useEffect, useMemo, useState } from "react";
import { PathLayer } from "@deck.gl/layers";
import { supabase } from "@/integrations/supabase/client";
import { registerAnchors, type AnchorEntry } from "./anchorRegistry";
import type { GeoSceneFilters } from "../types";
import { sceneHolePassesTime, sceneInterceptPassesGrade } from "../filterPolicy";
import { desurvey, sliceByDepth, type TrajectoryPoint } from "../drillGeometry";

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
  started_at: string | null;
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

export type DrillTrajectoryVisibility = {
  completed: boolean;
  proposed: boolean;
  intercepts: boolean;
};

export function useDrillTrajectoriesLayer(
  projectId: string | null,
  centerLng: number,
  centerLat: number,
  visibility: DrillTrajectoryVisibility,
  filters?: GeoSceneFilters,
) {
  const [holes, setHoles] = useState<Hole[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);
  const [real, setReal] = useState<Map<string, RealTrajectory["points"]>>(new Map());
  const anyVisible = visibility.completed || visibility.proposed || visibility.intercepts;

  useEffect(() => {
    if (!projectId || !anyVisible) {
      setHoles([]);
      setLogs([]);
      setReal(new Map());
      return;
    }

    let cancelled = false;
    (async () => {
      const [{ data: holeData }, { data: logData }] = await Promise.all([
        supabase
          .from("drill_holes")
          .select(
            "id,hole_id,easting,northing,elevation,actual_depth,planned_depth,azimuth,dip,status,started_at",
          )
          .eq("project_id", projectId),
        supabase
          .from("drill_core_logs")
          .select("hole_id,depth_from,depth_to,au_gpt")
          .eq("project_id", projectId)
          .gt("au_gpt", 0),
      ]);
      if (cancelled) return;

      const holeRows = ((holeData ?? []) as (Hole & { id: string })[]).filter((hole) => {
        if (hole.easting == null || hole.northing == null) return false;
        return sceneHolePassesTime(hole.started_at, filters?.timeCursor);
      });
      setHoles(holeRows);
      setLogs((logData ?? []) as Log[]);

      const holeIds = holeRows.map((hole) => hole.id);
      if (holeIds.length === 0) {
        setReal(new Map());
        return;
      }

      const { data: trajectoryRows } = await supabase
        .from("drill_hole_trajectories")
        .select("hole_id,points")
        .in("hole_id", holeIds);
      if (cancelled) return;

      const mapped = new Map<string, RealTrajectory["points"]>();
      const codeByUuid = new Map(holeRows.map((hole) => [hole.id, hole.hole_id] as const));
      for (const row of trajectoryRows ?? []) {
        const code = codeByUuid.get(row.hole_id as string);
        const points = row.points as RealTrajectory["points"] | null;
        if (code && Array.isArray(points) && points.length >= 2) mapped.set(code, points);
      }
      setReal(mapped);
    })();

    return () => {
      cancelled = true;
    };
  }, [projectId, anyVisible, filters?.timeCursor]);

  function realPath(points: RealTrajectory["points"]): Vec3[] {
    const mPerDegLng = M_PER_DEG_LAT * Math.cos((centerLat * Math.PI) / 180);
    return points.map(
      (point) =>
        [centerLng + point.x / mPerDegLng, centerLat + point.y / M_PER_DEG_LAT, point.z] as Vec3,
    );
  }

  const trajectories = useMemo(
    () =>
      holes.map((hole) => {
        const total = Number(hole.actual_depth ?? hole.planned_depth ?? 100);
        const collar = holeCollarLngLat(hole, centerLng, centerLat);
        const realPoints = real.get(hole.hole_id);
        const path =
          realPoints && realPoints.length >= 2
            ? realPath(realPoints)
            : holeSegment(hole, centerLng, centerLat, 0, total);
        return {
          code: hole.hole_id,
          path,
          status: (hole.status ?? "planned").toLowerCase(),
          collarLng: collar.lng,
          collarLat: collar.lat,
          isReal: Boolean(realPoints && realPoints.length >= 2),
        };
      }),
    // realPath uses centerLng/centerLat which are deps below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [holes, centerLng, centerLat, real],
  );

  const completedTrajectories = useMemo(
    () => trajectories.filter((trajectory) => trajectory.status !== "planned"),
    [trajectories],
  );
  const proposedTrajectories = useMemo(
    () => trajectories.filter((trajectory) => trajectory.status === "planned"),
    [trajectories],
  );

  const intercepts = useMemo(() => {
    const byHole = new Map(holes.map((hole) => [hole.hole_id, hole] as const));
    const mPerDegLng = M_PER_DEG_LAT * Math.cos((centerLat * Math.PI) / 180);
    const localPath = (hole: Hole): TrajectoryPoint[] => {
      const measured = real.get(hole.hole_id);
      if (measured && measured.length >= 2) return measured;
      const total = Number(hole.actual_depth ?? hole.planned_depth ?? 100);
      return desurvey(
        {
          x: Number(hole.easting ?? 0),
          y: Number(hole.northing ?? 0),
          z: Number(hole.elevation ?? 0),
        },
        [{ md: 0, azimuth: hole.azimuth ?? 0, dip: hole.dip ?? -90 }],
        total,
      );
    };
    const paths = new Map<string, TrajectoryPoint[]>();
    return logs
      .filter(
        (log) =>
          log.depth_from != null &&
          log.depth_to != null &&
          byHole.has(log.hole_id) &&
          sceneInterceptPassesGrade(log.au_gpt, filters?.highGradeOnly),
      )
      .map((log, index) => {
        const hole = byHole.get(log.hole_id)!;
        if (!paths.has(hole.hole_id)) paths.set(hole.hole_id, localPath(hole));
        const seg = sliceByDepth(
          paths.get(hole.hole_id)!,
          Number(log.depth_from),
          Number(log.depth_to),
        );
        return {
          id: `${log.hole_id}-${index}`,
          path: seg.map(
            (p) => [centerLng + p.x / mPerDegLng, centerLat + p.y / M_PER_DEG_LAT, p.z] as Vec3,
          ),
          au: Number(log.au_gpt ?? 0),
        };
      })
      .filter((intercept) => intercept.path.length >= 2);
  }, [holes, logs, real, centerLng, centerLat, filters?.highGradeOnly]);

  useEffect(() => {
    const entries: AnchorEntry[] = trajectories.map((trajectory) => ({
      kind: "hole",
      code: trajectory.code,
      lng: trajectory.collarLng,
      lat: trajectory.collarLat,
    }));
    return registerAnchors(entries);
  }, [trajectories]);

  const layers = useMemo(() => {
    const output: PathLayer[] = [];

    if (visibility.completed && completedTrajectories.length > 0) {
      output.push(
        new PathLayer({
          id: "drilling.completed:trajectory",
          data: completedTrajectories,
          pickable: true,
          widthUnits: "pixels",
          getPath: (trajectory: (typeof completedTrajectories)[number]) => trajectory.path,
          getColor: (trajectory: (typeof completedTrajectories)[number]) =>
            trajectory.status === "in_progress" ? [96, 165, 250, 220] : [180, 180, 200, 220],
          getWidth: 2.5,
        }),
      );
    }

    if (visibility.proposed && proposedTrajectories.length > 0) {
      output.push(
        new PathLayer({
          id: "drilling.proposed:trajectory",
          data: proposedTrajectories,
          pickable: true,
          widthUnits: "pixels",
          getPath: (trajectory: (typeof proposedTrajectories)[number]) => trajectory.path,
          getColor: [245, 158, 11, 175],
          getWidth: 2,
        }),
      );
    }

    if (visibility.intercepts && intercepts.length > 0) {
      output.push(
        new PathLayer({
          id: "sampling.drill_intercepts",
          data: intercepts,
          pickable: true,
          widthUnits: "pixels",
          getPath: (intercept: (typeof intercepts)[number]) => intercept.path,
          getColor: (intercept: (typeof intercepts)[number]) =>
            [...auColor(intercept.au), 240] as [number, number, number, number],
          getWidth: 6,
        }),
      );
    }

    return output;
  }, [
    visibility.completed,
    visibility.proposed,
    visibility.intercepts,
    completedTrajectories,
    proposedTrajectories,
    intercepts,
  ]);

  return {
    layers,
    completedCount: completedTrajectories.length,
    proposedCount: proposedTrajectories.length,
    interceptCount: intercepts.length,
  };
}
