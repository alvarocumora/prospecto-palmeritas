// Server function: obtiene anomalías geofísicas + satelitales como puntos XYZV
// en coordenadas locales ENU (metros) listas para voxelizar.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const InputSchema = z.object({
  projectId: z.string().uuid(),
});

export type AnomalyPoint = {
  /** ENU metros desde el centro del bbox */
  x: number;
  y: number;
  /** Profundidad negativa hacia abajo (m) */
  z: number;
  /** Valor escalar 0..1 */
  v: number;
  kind: "geophysics" | "satellite";
};

export type AnomalyDataset = {
  points: AnomalyPoint[];
  bbox: { minLng: number; maxLng: number; minLat: number; maxLat: number };
  center: { lng: number; lat: number };
  stats: { count: number; vMin: number; vMax: number };
};

/** Conversión simple lng/lat → metros ENU sobre un centro local. */
function lngLatToMeters(
  lng: number,
  lat: number,
  centerLng: number,
  centerLat: number,
): { x: number; y: number } {
  const R = 6378137;
  const dLat = ((lat - centerLat) * Math.PI) / 180;
  const dLng = ((lng - centerLng) * Math.PI) / 180;
  const x = dLng * R * Math.cos((centerLat * Math.PI) / 180);
  const y = dLat * R;
  return { x, y };
}

export const getAnomalyPoints = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data }) => {
    const [geoRes, satRes] = await Promise.all([
      supabaseAdmin
        .from("geophysics_anomalies")
        .select("lat,lng,estimated_depth_m,peak_value,confidence_pct,severity")
        .eq("project_id", data.projectId),
      supabaseAdmin
        .from("satellite_anomalies")
        .select("geometry,score,severity,area_ha,index_code")
        .eq("project_id", data.projectId),
    ]);

    const geoRows = (geoRes.data ?? []).filter(
      (r: { lat: number | null; lng: number | null }): r is typeof r & { lat: number; lng: number } =>
        r.lat != null && r.lng != null,
    );
    const satRows = (satRes.data ?? []).filter(
      (r: { geometry: unknown }): r is typeof r & { geometry: unknown } => r.geometry != null,
    );

    // Extrae centro de cada punto
    const allLngLat: Array<{ lng: number; lat: number; v: number; depth: number; kind: "geophysics" | "satellite" }> = [];

    for (const row of geoRows) {
      const v = clamp01(
        row.peak_value != null
          ? Number(row.peak_value) / 1000
          : row.confidence_pct != null
            ? Number(row.confidence_pct) / 100
            : sevToVal(row.severity),
      );
      const depth = row.estimated_depth_m != null ? Math.max(0, Number(row.estimated_depth_m)) : 150;
      allLngLat.push({ lng: Number(row.lng), lat: Number(row.lat), v, depth, kind: "geophysics" });
    }

    for (const row of satRows) {
      const geom = row.geometry as { type?: string; coordinates?: unknown };
      const c = extractCenter(geom);
      if (!c) continue;
      const v = clamp01(row.score != null ? Number(row.score) : sevToVal(row.severity));
      // Satelital: profundidad sintética inversa al score (alta señal = somera)
      const depth = 20 + (1 - v) * 180;
      allLngLat.push({ lng: c.lng, lat: c.lat, v, depth, kind: "satellite" });
    }

    if (allLngLat.length === 0) {
      return {
        points: [],
        bbox: { minLng: 0, maxLng: 0, minLat: 0, maxLat: 0 },
        center: { lng: 0, lat: 0 },
        stats: { count: 0, vMin: 0, vMax: 1 },
      } satisfies AnomalyDataset;
    }

    const lngs = allLngLat.map((p) => p.lng);
    const lats = allLngLat.map((p) => p.lat);
    const bbox = {
      minLng: Math.min(...lngs),
      maxLng: Math.max(...lngs),
      minLat: Math.min(...lats),
      maxLat: Math.max(...lats),
    };
    const center = {
      lng: (bbox.minLng + bbox.maxLng) / 2,
      lat: (bbox.minLat + bbox.maxLat) / 2,
    };

    const points: AnomalyPoint[] = allLngLat.map((p) => {
      const { x, y } = lngLatToMeters(p.lng, p.lat, center.lng, center.lat);
      return { x, y, z: -p.depth, v: p.v, kind: p.kind };
    });

    const vs = points.map((p) => p.v);
    return {
      points,
      bbox,
      center,
      stats: { count: points.length, vMin: Math.min(...vs), vMax: Math.max(...vs) },
    } satisfies AnomalyDataset;
  });

function clamp01(x: number): number {
  if (!Number.isFinite(x)) return 0;
  return Math.min(1, Math.max(0, x));
}

function sevToVal(s: string | null | undefined): number {
  switch ((s ?? "").toLowerCase()) {
    case "high":
      return 0.9;
    case "medium":
      return 0.6;
    default:
      return 0.35;
  }
}

function extractCenter(
  geom: { type?: string; coordinates?: unknown } | null,
): { lng: number; lat: number } | null {
  if (!geom || !geom.coordinates) return null;
  const c = geom.coordinates as unknown;
  if (geom.type === "Point" && Array.isArray(c) && c.length >= 2) {
    return { lng: Number(c[0]), lat: Number(c[1]) };
  }
  if (geom.type === "Polygon" && Array.isArray(c) && Array.isArray(c[0])) {
    const ring = c[0] as Array<[number, number]>;
    let sx = 0;
    let sy = 0;
    for (const p of ring) {
      sx += Number(p[0]);
      sy += Number(p[1]);
    }
    return { lng: sx / ring.length, lat: sy / ring.length };
  }
  return null;
}
