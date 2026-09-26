/**
 * Anomalías satelitales de Cholqui + malla de sondajes propuesta.
 * Lectura pública: sólo el proyecto Cholqui, sólo campos no sensibles.
 */
import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  buildDrillGrid,
  distanceM,
  polygonCentroid,
  totalMeters,
  type ProposedCollar,
  type SatelliteAnomaly,
} from "./drillGrid";

const CHOLQUI_PROJECT_ID = "e5360f13-1647-4e44-bb13-c0614e6f39fe";
const CHOLQUI_CENTER = { lat: -33.8543, lng: -71.043 };

export type AnomalyRing = Array<[number, number]>;

export type CholquiAnomaly = SatelliteAnomaly & {
  /** Anillo exterior del polígono en [lng, lat], para dibujarlo en el mapa. */
  ring: AnomalyRing;
  /** Distancia al centro del distrito, en metros. */
  distanceToCenterM: number;
};

export type CholquiSatelliteTargets = {
  runDate: string;
  anomalies: CholquiAnomaly[];
  collars: ProposedCollar[];
  summary: {
    anomalies: number;
    drillable: number;
    collars: number;
    totalMeters: number;
    maxScore: number | null;
    indexes: Array<{ code: string; count: number }>;
  };
};

export const getCholquiSatelliteTargets = createServerFn({ method: "GET" }).handler(
  async (): Promise<CholquiSatelliteTargets> => {
    const { data, error } = await supabaseAdmin
      .from("satellite_anomalies")
      .select("id, index_code, severity, score, area_ha, notes, detected_at, geometry")
      .eq("project_id", CHOLQUI_PROJECT_ID)
      .order("score", { ascending: false, nullsFirst: false });
    if (error) throw new Error(error.message);

    const anomalies: CholquiAnomaly[] = [];
    for (const row of data ?? []) {
      const centroid = polygonCentroid(row.geometry);
      if (!centroid) continue;
      const g = row.geometry as { coordinates?: unknown } | null;
      const ring = (Array.isArray(g?.coordinates) ? g?.coordinates[0] : []) as AnomalyRing;
      anomalies.push({
        id: row.id,
        indexCode: row.index_code ?? "SIN_INDICE",
        severity: row.severity ?? "s/d",
        score: row.score != null ? Number(row.score) : null,
        areaHa: row.area_ha != null ? Number(row.area_ha) : null,
        notes: row.notes ?? null,
        detectedAt: row.detected_at ?? null,
        lat: centroid.lat,
        lng: centroid.lng,
        ring: Array.isArray(ring) ? ring : [],
        distanceToCenterM: distanceM(
          CHOLQUI_CENTER.lat,
          CHOLQUI_CENTER.lng,
          centroid.lat,
          centroid.lng,
        ),
      });
    }

    const collars = buildDrillGrid(anomalies, CHOLQUI_CENTER);

    const counts = new Map<string, number>();
    for (const a of anomalies) counts.set(a.indexCode, (counts.get(a.indexCode) ?? 0) + 1);

    const dates = anomalies.map((a) => a.detectedAt).filter((d): d is string => Boolean(d));
    const scores = anomalies.map((a) => a.score).filter((s): s is number => s != null);

    return {
      runDate: dates.length ? dates.slice().sort().reverse()[0]!.slice(0, 10) : "",
      anomalies,
      collars,
      summary: {
        anomalies: anomalies.length,
        drillable: anomalies.filter((a) => (a.score ?? 0) >= 0.55 && a.indexCode !== "NDVI").length,
        collars: collars.length,
        totalMeters: totalMeters(collars),
        maxScore: scores.length ? Math.max(...scores) : null,
        indexes: [...counts.entries()]
          .map(([code, count]) => ({ code, count }))
          .sort((a, b) => b.count - a.count),
      },
    };
  },
);
