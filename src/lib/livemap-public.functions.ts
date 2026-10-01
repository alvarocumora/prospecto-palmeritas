import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { buildPublicGeoManifest, type PublicGeoManifest } from "@/lib/geospatial/publicGeoContract";

const LOSVERDES_PROJECT_ID = "7a499b02-ecdf-447b-8956-b106fe4ec087";

export type PublicTarget = {
  id: string;
  code: string;
  name: string;
  target_type: string;
  commodity: string | null;
  lat: number | null;
  lng: number | null;
  elevation_m: number | null;
  stage: string;
  priority: string;
  score: number | null;
  rationale: string | null;
};

export type PublicProjectConcession = {
  code: string;
  name: string;
  holder: string | null;
};

export type PublicProjectLayers = {
  project: { id: string; name: string; center_lat: number | null; center_lng: number | null };
  targets: PublicTarget[];
  concessions: PublicProjectConcession[];
  canonical: PublicGeoManifest;
};

export const getLosVerdesPublicLayers = createServerFn({ method: "GET" }).handler(
  async (): Promise<PublicProjectLayers> => {
    const { data: project, error: pErr } = await supabaseAdmin
      .from("projects")
      .select("id, name, center_lat, center_lng")
      .eq("id", LOSVERDES_PROJECT_ID)
      .maybeSingle();
    if (pErr) throw new Error(pErr.message);
    if (!project) throw new Error("Proyecto no encontrado");

    const { data: targets, error: tErr } = await supabaseAdmin
      .from("exploration_targets")
      .select(
        "id, code, name, target_type, commodity, lat, lng, elevation_m, stage, priority, score, rationale",
      )
      .eq("project_id", LOSVERDES_PROJECT_ID)
      .neq("stage", "closed")
      .order("priority", { ascending: false })
      .order("score", { ascending: false });
    if (tErr) throw new Error(tErr.message);

    const { data: concessions, error: cErr } = await supabaseAdmin
      .from("mining_concessions")
      .select("code, name, holder")
      .eq("project_id", LOSVERDES_PROJECT_ID)
      .order("code", { ascending: true });
    if (cErr) throw new Error(cErr.message);

    const publicProject = {
      id: project.id,
      name: project.name,
      center_lat: project.center_lat != null ? Number(project.center_lat) : null,
      center_lng: project.center_lng != null ? Number(project.center_lng) : null,
    };

    return {
      project: publicProject,
      targets: (targets ?? []) as PublicTarget[],
      concessions: (concessions ?? []) as PublicProjectConcession[],
      canonical: buildPublicGeoManifest(publicProject),
    };
  },
);

// ============ Anomalías + lineamientos ============

export type MagAnomalyPoint = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  mag_nt: number;
  rank: number;
  radius_m: number;
};

export type SatAnomalyPoint = {
  id: string;
  index_code: string;
  severity: "low" | "medium" | "high";
  score: number;
  area_ha: number | null;
  lat: number;
  lng: number;
  /** Polygon outer ring as [lng,lat] pairs (deck.gl convention). Null for point geometries. */
  polygon: [number, number][] | null;
};

export type Lineament = {
  id: string;
  severity: "low" | "medium" | "high";
  score: number;
  /** Polyline as [lat,lng] coords */
  path: [number, number][];
};

export type LosVerdesAnomalies = {
  magTargets: MagAnomalyPoint[];
  satAnomalies: SatAnomalyPoint[];
  lineaments: Lineament[];
};

type RingCoord = [number, number];

function ringCentroid(ring: RingCoord[]): [number, number] {
  let lng = 0;
  let lat = 0;
  let n = 0;
  for (const c of ring) {
    if (!Array.isArray(c) || c.length < 2) continue;
    lng += Number(c[0]);
    lat += Number(c[1]);
    n++;
  }
  if (n === 0) return [0, 0];
  return [lat / n, lng / n];
}

export const getLosVerdesAnomalies = createServerFn({ method: "GET" }).handler(
  async (): Promise<LosVerdesAnomalies> => {
    const [magRes, satRes] = await Promise.all([
      supabaseAdmin
        .from("mag_targets")
        .select("id, name, lat, lon, mag_nt, rank, radius_m")
        .eq("project_id", LOSVERDES_PROJECT_ID)
        .order("rank", { ascending: true }),
      supabaseAdmin
        .from("satellite_anomalies")
        .select("id, index_code, severity, score, area_ha, geometry")
        .eq("project_id", LOSVERDES_PROJECT_ID),
    ]);

    if (magRes.error) throw new Error(magRes.error.message);
    if (satRes.error) throw new Error(satRes.error.message);

    const magTargets: MagAnomalyPoint[] = (magRes.data ?? []).map((r) => ({
      id: String(r.id),
      name: String(r.name),
      lat: Number(r.lat),
      lng: Number(r.lon),
      mag_nt: Number(r.mag_nt),
      rank: Number(r.rank),
      radius_m: Number(r.radius_m),
    }));

    const satAnomalies: SatAnomalyPoint[] = [];
    const lineaments: Lineament[] = [];

    for (const row of satRes.data ?? []) {
      const geom = row.geometry as { type?: string; coordinates?: unknown } | null;
      if (!geom?.type) continue;
      const severity = (row.severity ?? "medium") as "low" | "medium" | "high";
      const score = Number(row.score ?? 0);

      let lat = 0;
      let lng = 0;
      let path: [number, number][] = [];
      let polygonLngLat: [number, number][] | null = null;

      if (geom.type === "Point" && Array.isArray(geom.coordinates)) {
        const [glng, glat] = geom.coordinates as [number, number];
        lng = Number(glng);
        lat = Number(glat);
      } else if (geom.type === "Polygon" && Array.isArray(geom.coordinates)) {
        const rings = geom.coordinates as RingCoord[][];
        const outer = rings[0] ?? [];
        const [clat, clng] = ringCentroid(outer);
        lat = clat;
        lng = clng;
        path = outer.map(([x, y]) => [Number(y), Number(x)] as [number, number]);
        polygonLngLat = outer.map(([x, y]) => [Number(x), Number(y)] as [number, number]);
      } else {
        continue;
      }

      satAnomalies.push({
        id: String(row.id),
        index_code: String(row.index_code),
        severity,
        score,
        area_ha: row.area_ha != null ? Number(row.area_ha) : null,
        lat,
        lng,
        polygon: polygonLngLat,
      });

      if (row.index_code === "STRUCTURAL_LINEAMENTS" && path.length >= 2) {
        lineaments.push({
          id: String(row.id),
          severity,
          score,
          path,
        });
      }
    }

    return { magTargets, satAnomalies, lineaments };
  },
);

// ============ Escena 3D ============

export type Scene3DTarget = {
  id: string;
  code: string;
  name: string;
  lat: number;
  lng: number;
  score: number;
  priority: string;
};

export type Scene3DMagAnomaly = {
  id: string;
  lat: number;
  lng: number;
  intensity: number; // 0..1
  rank: number;
};

export type Scene3DLineament = {
  id: string;
  path: [number, number][];
  /** Strike (azimuth, degrees) inferred from path direction */
  strike_deg: number;
  /** Default dip 70° for visualization */
  dip_deg: number;
  score: number;
};

export type Scene3DResponse = {
  bbox: { minLat: number; minLng: number; maxLat: number; maxLng: number };
  center: { lat: number; lng: number };
  targets: Scene3DTarget[];
  magAnomalies: Scene3DMagAnomaly[];
  lineaments: Scene3DLineament[];
};

function strikeFromPath(path: [number, number][]): number {
  if (path.length < 2) return 0;
  // Use first and last point
  const [lat1, lng1] = path[0];
  const [lat2, lng2] = path[path.length - 1];
  const dLng = lng2 - lng1;
  const dLat = lat2 - lat1;
  // azimuth: 0° = North, clockwise
  const rad = Math.atan2(dLng, dLat);
  let deg = (rad * 180) / Math.PI;
  if (deg < 0) deg += 360;
  return deg;
}

export const getLosVerdes3DScene = createServerFn({ method: "GET" }).handler(
  async (): Promise<Scene3DResponse> => {
    const [layers, anomalies] = await Promise.all([
      getLosVerdesPublicLayers(),
      getLosVerdesAnomalies(),
    ]);

    const lats: number[] = [];
    const lngs: number[] = [];
    const targets: Scene3DTarget[] = [];
    for (const t of layers.targets) {
      if (t.lat == null || t.lng == null) continue;
      lats.push(t.lat);
      lngs.push(t.lng);
      targets.push({
        id: t.id,
        code: t.code,
        name: t.name,
        lat: t.lat,
        lng: t.lng,
        score: t.score ?? 50,
        priority: t.priority,
      });
    }
    for (const m of anomalies.magTargets) {
      lats.push(m.lat);
      lngs.push(m.lng);
    }
    for (const l of anomalies.lineaments) {
      for (const [lat, lng] of l.path) {
        lats.push(lat);
        lngs.push(lng);
      }
    }

    // Fallback bbox if no data
    const center = {
      lat: layers.project.center_lat ?? -32.04,
      lng: layers.project.center_lng ?? -71.11,
    };
    const minLat = lats.length ? Math.min(...lats) : center.lat - 0.02;
    const maxLat = lats.length ? Math.max(...lats) : center.lat + 0.02;
    const minLng = lngs.length ? Math.min(...lngs) : center.lng - 0.02;
    const maxLng = lngs.length ? Math.max(...lngs) : center.lng + 0.02;

    // Normalize mag intensity
    const magVals = anomalies.magTargets.map((m) => Math.abs(m.mag_nt));
    const maxMag = magVals.length ? Math.max(...magVals) : 1;
    const magAnomalies: Scene3DMagAnomaly[] = anomalies.magTargets.map((m) => ({
      id: m.id,
      lat: m.lat,
      lng: m.lng,
      intensity: maxMag > 0 ? Math.abs(m.mag_nt) / maxMag : 0,
      rank: m.rank,
    }));

    const lineaments: Scene3DLineament[] = anomalies.lineaments.map((l) => ({
      id: l.id,
      path: l.path,
      strike_deg: strikeFromPath(l.path),
      dip_deg: 70,
      score: l.score,
    }));

    return {
      bbox: { minLat, minLng, maxLat, maxLng },
      center,
      targets,
      magAnomalies,
      lineaments,
    };
  },
);
