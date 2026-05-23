// Capa deck.gl: collares de sondajes del proyecto activo.
// drill_holes guarda easting/northing como metros locales relativos al centro
// del proyecto, así que convertimos a lng/lat aquí.
import { useEffect, useMemo } from "react";
import { ColumnLayer } from "@deck.gl/layers";
import { useDrillHoles } from "@/hooks/useDrilling";
import { registerAnchors, type AnchorEntry } from "./anchorRegistry";

type LooseHole = {
  hole_id: string;
  status?: string | null;
  actual_depth?: number | null;
  planned_depth?: number | null;
  easting?: number | null;
  northing?: number | null;
};

const STATUS_COLOR: Record<string, [number, number, number]> = {
  completed: [34, 197, 94],
  in_progress: [59, 130, 246],
  planned: [148, 163, 184],
  abandoned: [239, 68, 68],
};

const M_PER_DEG_LAT = 111320;

export function useDrillHolesLayer(
  projectId: string | null,
  centerLng: number,
  centerLat: number,
  visible = true,
) {
  const { data: holes } = useDrillHoles(projectId);

  const points = useMemo(() => {
    const mPerDegLng = M_PER_DEG_LAT * Math.cos((centerLat * Math.PI) / 180);
    const list = (holes ?? []) as unknown as LooseHole[];
    return list
      .filter((h) => h.easting != null && h.northing != null)
      .map((h) => ({
        code: h.hole_id,
        lng: centerLng + Number(h.easting) / mPerDegLng,
        lat: centerLat + Number(h.northing) / M_PER_DEG_LAT,
        depth: Number(h.actual_depth ?? h.planned_depth ?? 100),
        status: (h.status ?? "planned").toLowerCase(),
      }));
  }, [holes, centerLng, centerLat]);

  useEffect(() => {
    const entries: AnchorEntry[] = points.map((p) => ({
      kind: "hole",
      code: p.code,
      lng: p.lng,
      lat: p.lat,
    }));
    return registerAnchors(entries);
  }, [points]);

  const layer = useMemo(
    () =>
      visible && points.length > 0
        ? new ColumnLayer({
            id: "geoscene-holes",
            data: points,
            pickable: true,
            diskResolution: 16,
            radius: 25,
            extruded: true,
            elevationScale: 1,
            getPosition: (d: (typeof points)[number]) => [d.lng, d.lat],
            getElevation: (d: (typeof points)[number]) => d.depth,
            getFillColor: (d: (typeof points)[number]) => [
              ...(STATUS_COLOR[d.status] ?? STATUS_COLOR.planned),
              200,
            ],
          })
        : null,
    [points, visible],
  );

  return { layer, points };
}
