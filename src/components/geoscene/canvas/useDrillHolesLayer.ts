// Capa deck.gl: collares de sondajes del proyecto activo.
// Renderiza como columnas verticales para dar sensación 3D mientras integramos
// trayectorias e intercepts en sprints siguientes.
import { useEffect, useMemo } from "react";
import { ColumnLayer } from "@deck.gl/layers";
import { useDrillHoles } from "@/hooks/useDrilling";
import { registerAnchors, type AnchorEntry } from "./anchorRegistry";

// drill_holes ya viene con (easting, northing) en metros del proyecto, pero
// para el canvas necesitamos lng/lat. Aprovechamos las columnas opcionales
// `collar_lng` / `collar_lat` si existen; si no, descartamos el sondaje.
type LooseHole = {
  hole_id: string;
  status?: string | null;
  actual_depth?: number | null;
  planned_depth?: number | null;
  collar_lng?: number | null;
  collar_lat?: number | null;
};

const STATUS_COLOR: Record<string, [number, number, number]> = {
  completed: [34, 197, 94],
  in_progress: [59, 130, 246],
  planned: [148, 163, 184],
  abandoned: [239, 68, 68],
};

export function useDrillHolesLayer(projectId: string | null, visible = true) {
  const { data: holes } = useDrillHoles(projectId);

  const points = useMemo(() => {
    const list = (holes ?? []) as unknown as LooseHole[];
    return list
      .filter((h) => h.collar_lng != null && h.collar_lat != null)
      .map((h) => ({
        code: h.hole_id,
        lng: Number(h.collar_lng),
        lat: Number(h.collar_lat),
        depth: Number(h.actual_depth ?? h.planned_depth ?? 100),
        status: (h.status ?? "planned").toLowerCase(),
      }));
  }, [holes]);

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
