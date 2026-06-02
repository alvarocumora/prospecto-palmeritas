import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const PROJECT_ID = "7a499b02-ecdf-447b-8956-b106fe4ec087";

export type FC = {
  type: "FeatureCollection";
  features: Array<{
    type: "Feature";
    id?: string | number;
    geometry: GeoJSON.Geometry;
    properties: Record<string, unknown>;
  }>;
};

export type LosVerdesMapData = {
  bbox: [number, number, number, number] | null; // [minLng, minLat, maxLng, maxLat]
  center: [number, number];
  concessions: FC;
  targets: FC;
  satAnomalies: FC;
  magAnomalies: FC;
  veins: FC;
  counts: {
    concessions: number;
    targets: number;
    satAnomalies: number;
    magAnomalies: number;
    veins: number;
  };
};

// Helper: build FeatureCollection from rows with raw GeoJSON strings
function asFC(rows: Array<{ geom_json: string | null; [k: string]: any }>): FC {
  const features: FC["features"] = [];
  for (const r of rows) {
    if (!r.geom_json) continue;
    let geometry: GeoJSON.Geometry | null = null;
    try {
      geometry = JSON.parse(r.geom_json);
    } catch {
      continue;
    }
    if (!geometry) continue;
    const { geom_json: _g, ...props } = r;
    features.push({ type: "Feature", id: r.id as any, geometry, properties: props });
  }
  return { type: "FeatureCollection", features };
}

export const getLosVerdesMapData = createServerFn({ method: "GET" }).handler(
  async (): Promise<LosVerdesMapData> => {
    // 1) Concesiones — usa geometry_geojson (texto) ya en EPSG:4326
    const { data: cons, error: cErr } = await supabaseAdmin
      .from("mining_concessions")
      .select(
        "id, code, name, holder, concession_type, status, area_ha, region, commune, granted_at, expires_at, geometry_geojson",
      )
      .eq("project_id", PROJECT_ID);
    if (cErr) throw new Error(`concessions: ${cErr.message}`);

    const concessions: FC = {
      type: "FeatureCollection",
      features: (cons ?? []).flatMap((c: any) => {
        if (!c.geometry_geojson) return [];
        let geom: GeoJSON.Geometry | null = null;
        try {
          geom = typeof c.geometry_geojson === "string" ? JSON.parse(c.geometry_geojson) : c.geometry_geojson;
        } catch {
          return [];
        }
        if (!geom) return [];
        return [
          {
            type: "Feature" as const,
            id: c.id,
            geometry: geom,
            properties: {
              layer: "concession",
              id: c.id,
              code: c.code,
              name: c.name,
              holder: c.holder,
              concession_type: c.concession_type,
              status: c.status,
              area_ha: c.area_ha,
              region: c.region,
              commune: c.commune,
              granted_at: c.granted_at,
              expires_at: c.expires_at,
            },
          },
        ];
      }),
    };

    // 2) Targets — lat/lng (puntos)
    const { data: tgts, error: tErr } = await supabaseAdmin
      .from("exploration_targets")
      .select(
        "id, code, name, target_type, commodity, lat, lng, elevation_m, stage, priority, score, confidence_pct, rationale",
      )
      .eq("project_id", PROJECT_ID)
      .neq("stage", "closed");
    if (tErr) throw new Error(`targets: ${tErr.message}`);

    const targets: FC = {
      type: "FeatureCollection",
      features: (tgts ?? []).flatMap((t: any) => {
        if (t.lng == null || t.lat == null) return [];
        return [
          {
            type: "Feature" as const,
            id: t.id,
            geometry: { type: "Point" as const, coordinates: [Number(t.lng), Number(t.lat)] },
            properties: {
              layer: "target",
              id: t.id,
              code: t.code,
              name: t.name,
              target_type: t.target_type,
              commodity: t.commodity,
              elevation_m: t.elevation_m,
              stage: t.stage,
              priority: t.priority,
              score: t.score,
              confidence_pct: t.confidence_pct,
              rationale: t.rationale,
            },
          },
        ];
      }),
    };

    // 3) Satellite anomalies — geometría PostGIS (geometry); usar ST_AsGeoJSON
    const { data: satRows, error: sErr } = await supabaseAdmin.rpc("lv_sat_anomalies_geojson", {
      p_project: PROJECT_ID,
    });
    let satAnomalies: FC = { type: "FeatureCollection", features: [] };
    if (sErr || !satRows) {
      // Fallback: leer raw y derivar centroide a partir de bbox si está
      const { data: raw } = await supabaseAdmin
        .from("satellite_anomalies")
        .select("id, index_code, severity, score, bbox")
        .eq("project_id", PROJECT_ID);
      satAnomalies = {
        type: "FeatureCollection",
        features: (raw ?? []).flatMap((s: any) => {
          if (!s.bbox) return [];
          // bbox espera [minLng,minLat,maxLng,maxLat] o GeoJSON
          let center: [number, number] | null = null;
          if (Array.isArray(s.bbox) && s.bbox.length >= 4) {
            center = [(Number(s.bbox[0]) + Number(s.bbox[2])) / 2, (Number(s.bbox[1]) + Number(s.bbox[3])) / 2];
          }
          if (!center) return [];
          return [
            {
              type: "Feature" as const,
              id: s.id,
              geometry: { type: "Point" as const, coordinates: center },
              properties: {
                layer: "sat_anomaly",
                id: s.id,
                index_code: s.index_code,
                severity: s.severity,
                score: s.score,
              },
            },
          ];
        }),
      };
    } else {
      satAnomalies = asFC(satRows as any);
      // anota layer
      for (const f of satAnomalies.features) (f.properties as any).layer = "sat_anomaly";
    }

    // 4) Magnetic anomalies — lat/lon directo
    const { data: mags, error: mErr } = await supabaseAdmin
      .from("mag_targets")
      .select("id, name, lat, lon, mag_nt, rank, radius_m")
      .eq("project_id", PROJECT_ID);
    if (mErr) throw new Error(`mag: ${mErr.message}`);
    const magAnomalies: FC = {
      type: "FeatureCollection",
      features: (mags ?? []).flatMap((m: any) => {
        if (m.lat == null || m.lon == null) return [];
        return [
          {
            type: "Feature" as const,
            id: m.id,
            geometry: { type: "Point" as const, coordinates: [Number(m.lon), Number(m.lat)] },
            properties: {
              layer: "mag_anomaly",
              id: m.id,
              name: m.name,
              mag_nt: m.mag_nt,
              rank: m.rank,
              radius_m: m.radius_m,
            },
          },
        ];
      }),
    };

    // 5) Veins — geometry PostGIS
    const { data: veinRows, error: vErr } = await supabaseAdmin.rpc("lv_veins_geojson", {
      p_project: PROJECT_ID,
    });
    let veins: FC = { type: "FeatureCollection", features: [] };
    if (!vErr && veinRows) {
      veins = asFC(veinRows as any);
      for (const f of veins.features) (f.properties as any).layer = "vein";
    }

    // Compute bbox & center
    const allCoords: Array<[number, number]> = [];
    const collect = (g: GeoJSON.Geometry | null) => {
      if (!g) return;
      const walk = (c: any) => {
        if (typeof c[0] === "number") allCoords.push([c[0], c[1]]);
        else for (const x of c) walk(x);
      };
      if ("coordinates" in g) walk((g as any).coordinates);
    };
    for (const fc of [concessions, targets, satAnomalies, magAnomalies, veins]) {
      for (const f of fc.features) collect(f.geometry);
    }
    let bbox: LosVerdesMapData["bbox"] = null;
    let center: [number, number] = [-71.05, -31.95];
    if (allCoords.length > 0) {
      let minLng = Infinity,
        minLat = Infinity,
        maxLng = -Infinity,
        maxLat = -Infinity;
      for (const [lng, lat] of allCoords) {
        if (lng < minLng) minLng = lng;
        if (lng > maxLng) maxLng = lng;
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
      }
      bbox = [minLng, minLat, maxLng, maxLat];
      center = [(minLng + maxLng) / 2, (minLat + maxLat) / 2];
    }

    return {
      bbox,
      center,
      concessions,
      targets,
      satAnomalies,
      magAnomalies,
      veins,
      counts: {
        concessions: concessions.features.length,
        targets: targets.features.length,
        satAnomalies: satAnomalies.features.length,
        magAnomalies: magAnomalies.features.length,
        veins: veins.features.length,
      },
    };
  },
);
