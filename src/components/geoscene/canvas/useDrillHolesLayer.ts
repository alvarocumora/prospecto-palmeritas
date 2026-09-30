// Capa deck.gl: collares de sondajes del proyecto activo.
// Separa ejecutados/medidos de planificados para mantener la evidencia 3D explícita.
import { useEffect, useMemo } from "react";
import { ColumnLayer } from "@deck.gl/layers";
import { useDrillHoles } from "@/hooks/useDrilling";
import { registerAnchors, type AnchorEntry } from "./anchorRegistry";
import type { GeoSceneFilters } from "../types";
import { sceneHolePassesTime } from "../filterPolicy";

type LooseHole = {
  hole_id: string;
  status?: string | null;
  actual_depth?: number | null;
  planned_depth?: number | null;
  easting?: number | null;
  northing?: number | null;
  started_at?: string | null;
};

const STATUS_COLOR: Record<string, [number, number, number]> = {
  completed: [34, 197, 94],
  in_progress: [59, 130, 246],
  planned: [148, 163, 184],
  abandoned: [239, 68, 68],
};

const M_PER_DEG_LAT = 111320;

export type DrillHoleLayerVisibility = {
  completed: boolean;
  proposed: boolean;
};

export function useDrillHolesLayer(
  projectId: string | null,
  centerLng: number,
  centerLat: number,
  visibility: DrillHoleLayerVisibility,
  filters?: GeoSceneFilters,
) {
  const { data: holes } = useDrillHoles(projectId);

  const points = useMemo(() => {
    const mPerDegLng = M_PER_DEG_LAT * Math.cos((centerLat * Math.PI) / 180);
    const list = (holes ?? []) as unknown as LooseHole[];
    return list
      .filter((hole) => {
        if (hole.easting == null || hole.northing == null) return false;
        return sceneHolePassesTime(hole.started_at, filters?.timeCursor);
      })
      .map((hole) => ({
        code: hole.hole_id,
        lng: centerLng + Number(hole.easting) / mPerDegLng,
        lat: centerLat + Number(hole.northing) / M_PER_DEG_LAT,
        depth: Number(hole.actual_depth ?? hole.planned_depth ?? 100),
        status: (hole.status ?? "planned").toLowerCase(),
      }));
  }, [holes, centerLng, centerLat, filters?.timeCursor]);

  useEffect(() => {
    const entries: AnchorEntry[] = points.map((point) => ({
      kind: "hole",
      code: point.code,
      lng: point.lng,
      lat: point.lat,
    }));
    return registerAnchors(entries);
  }, [points]);

  const completedPoints = useMemo(
    () => points.filter((point) => point.status !== "planned"),
    [points],
  );
  const proposedPoints = useMemo(
    () => points.filter((point) => point.status === "planned"),
    [points],
  );

  const completedLayer = useMemo(
    () =>
      visibility.completed && completedPoints.length > 0
        ? new ColumnLayer({
            id: "drilling.completed:collars",
            data: completedPoints,
            pickable: true,
            diskResolution: 16,
            radius: 25,
            extruded: true,
            elevationScale: 1,
            getPosition: (point: (typeof completedPoints)[number]) => [point.lng, point.lat],
            getElevation: (point: (typeof completedPoints)[number]) => point.depth,
            getFillColor: (point: (typeof completedPoints)[number]) => [
              ...(STATUS_COLOR[point.status] ?? STATUS_COLOR.completed),
              210,
            ],
          })
        : null,
    [completedPoints, visibility.completed],
  );

  const proposedLayer = useMemo(
    () =>
      visibility.proposed && proposedPoints.length > 0
        ? new ColumnLayer({
            id: "drilling.proposed:collars",
            data: proposedPoints,
            pickable: true,
            diskResolution: 12,
            radius: 20,
            extruded: true,
            elevationScale: 1,
            getPosition: (point: (typeof proposedPoints)[number]) => [point.lng, point.lat],
            getElevation: (point: (typeof proposedPoints)[number]) => point.depth,
            getFillColor: [148, 163, 184, 130],
            getLineColor: [245, 158, 11, 220],
            stroked: true,
            lineWidthUnits: "pixels",
            getLineWidth: 1.5,
          })
        : null,
    [proposedPoints, visibility.proposed],
  );

  return {
    layers: [completedLayer, proposedLayer].filter(Boolean),
    completedCount: completedPoints.length,
    proposedCount: proposedPoints.length,
    points,
  };
}
