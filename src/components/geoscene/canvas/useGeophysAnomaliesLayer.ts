// Capa deck.gl: anomalías geofísicas extruidas en profundidad.
// Altura ∝ estimated_depth_m, radio ∝ peak_value, color por severidad.
// Registra cada anomalía como `anomaly:<code>` para que el copilot pueda enfocarla.
import { useEffect, useMemo, useState } from "react";
import { ColumnLayer } from "@deck.gl/layers";
import { supabase } from "@/integrations/supabase/client";
import { registerAnchors, type AnchorEntry } from "./anchorRegistry";

type Row = {
  code: string;
  lat: number | null;
  lng: number | null;
  severity: string | null;
  estimated_depth_m: number | null;
  peak_value: number | null;
  anomaly_type: string | null;
};

const SEVERITY_COLOR: Record<string, [number, number, number]> = {
  critical: [217, 70, 239],
  high: [239, 68, 68],
  medium: [249, 115, 22],
  low: [234, 179, 8],
};

export function useGeophysAnomaliesLayer(projectId: string | null, visible = true) {
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    if (!projectId || !visible) {
      setRows([]);
      return;
    }
    let cancelled = false;
    supabase
      .from("geophysics_anomalies")
      .select("code,lat,lng,severity,estimated_depth_m,peak_value,anomaly_type")
      .eq("project_id", projectId)
      .neq("status", "dismissed")
      .then(({ data }) => {
        if (!cancelled)
          setRows(((data ?? []) as Row[]).filter((r) => r.lat != null && r.lng != null));
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, visible]);

  const points = useMemo(
    () =>
      rows.map((r) => ({
        code: r.code,
        lng: Number(r.lng),
        lat: Number(r.lat),
        depth: Math.max(50, Number(r.estimated_depth_m ?? 150)),
        severity: (r.severity ?? "medium").toLowerCase(),
        peak: Number(r.peak_value ?? 0),
        type: r.anomaly_type ?? "other",
      })),
    [rows],
  );

  useEffect(() => {
    const entries: AnchorEntry[] = points.map((p) => ({
      kind: "anomaly",
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
            id: "geophysics.anomalies",
            data: points,
            pickable: true,
            diskResolution: 24,
            extruded: true,
            // Anomalías se extruden HACIA ABAJO (profundidad estimada).
            // ColumnLayer extruye hacia arriba por defecto, así que invertimos
            // colocándolas con elevación negativa.
            getPosition: (d: (typeof points)[number]) => [d.lng, d.lat, -d.depth],
            getElevation: (d: (typeof points)[number]) => d.depth,
            getFillColor: (d: (typeof points)[number]) => [
              ...(SEVERITY_COLOR[d.severity] ?? SEVERITY_COLOR.medium),
              170,
            ],
            radius: 40,
            elevationScale: 1,
          })
        : null,
    [points, visible],
  );

  return { layer, count: points.length };
}
