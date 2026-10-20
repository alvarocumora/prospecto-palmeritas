// Capa deck.gl: marcadores georreferenciados de anomalías geofísicas.
// NO representan sólidos bajo superficie, sondajes ni profundidad medida.
// La posible profundidad ESTIMADA se conserva como metadato, nunca se
// sintetiza para extruir cilindros o aparentar cuerpos mineralizados.
import { useEffect, useMemo, useState } from "react";
import { ScatterplotLayer } from "@deck.gl/layers";
import { supabase } from "@/integrations/supabase/client";
import { registerAnchors, type AnchorEntry } from "./anchorRegistry";
import {
  GEOPHYSICS_SEVERITY_COLORS,
  normalizeGeophysicalAnomalies,
  type GeophysicsAnomalyRow,
} from "../geophysicsAnomalyPresentation";

export function useGeophysAnomaliesLayer(projectId: string | null, visible = true) {
  const [rows, setRows] = useState<GeophysicsAnomalyRow[]>([]);

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
      .then(({ data, error }) => {
        if (cancelled) return;
        // Do not show stale rows when the query fails or the project changes.
        setRows(error ? [] : ((data ?? []) as GeophysicsAnomalyRow[]));
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, visible]);

  const points = useMemo(() => normalizeGeophysicalAnomalies(rows), [rows]);

  useEffect(() => {
    const entries: AnchorEntry[] = points.map((point) => ({
      kind: "anomaly",
      code: point.code,
      lng: point.lng,
      lat: point.lat,
    }));
    return registerAnchors(entries);
  }, [points]);

  const layer = useMemo(
    () =>
      visible && points.length > 0
        ? new ScatterplotLayer({
            id: "geophysics.anomalies",
            data: points,
            pickable: true,
            filled: true,
            stroked: true,
            radiusUnits: "pixels",
            getRadius: 8,
            radiusMinPixels: 6,
            radiusMaxPixels: 12,
            lineWidthUnits: "pixels",
            getLineWidth: 2,
            getLineColor: [255, 255, 255, 220],
            getPosition: (point: (typeof points)[number]) => [point.lng, point.lat],
            getFillColor: (point: (typeof points)[number]) =>
              GEOPHYSICS_SEVERITY_COLORS[point.severity],
            parameters: { depthTest: false },
          })
        : null,
    [points, visible],
  );

  return { layer, count: points.length };
}
