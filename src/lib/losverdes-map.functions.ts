import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const PROJECT_ID = "7a499b02-ecdf-447b-8956-b106fe4ec087";

type PropValue = string | number | boolean | null;
type Props = Record<string, PropValue>;

export type MapFeature = {
  type: "Feature";
  id?: string | number;
  geometry: GeoJSON.Geometry;
  properties: Props;
};

export type FC = {
  type: "FeatureCollection";
  features: MapFeature[];
};

export type LosVerdesMapData = {
  bbox: [number, number, number, number] | null;
  center: [number, number];
  concessions: FC;
  targets: FC;
  satAnomalies: FC;
  magAnomalies: FC;
  counts: {
    concessions: number;
    concessionsWithGeom: number;
    targets: number;
    satAnomalies: number;
    magAnomalies: number;
  };
};

export const getLosVerdesMapData = createServerFn({ method: "GET" }).handler(
  async (): Promise<LosVerdesMapData> => {
    // 1) Concesiones
    const { data: cons, error: cErr } = await supabaseAdmin
      .from("mining_concessions")
      .select(
        "id, code, name, holder, concession_type, status, area_ha, region, commune, granted_at, expires_at, geometry_geojson",
      )
      .eq("project_id", PROJECT_ID);
    if (cErr) throw new Error(`concessions: ${cErr.message}`);

    const concessions: FC = {
      type: "FeatureCollection",
      features: (cons ?? []).flatMap((c): MapFeature[] => {
        if (!c.geometry_geojson) return [];
        let geom: GeoJSON.Geometry | null = null;
        try {
          geom =
            typeof c.geometry_geojson === "string"
              ? JSON.parse(c.geometry_geojson)
              : (c.geometry_geojson as unknown as GeoJSON.Geometry);
        } catch {
          return [];
        }
        if (!geom) return [];
        const props: Props = {
          layer: "concession",
          id: String(c.id),
          code: c.code ?? null,
          name: c.name ?? null,
          holder: c.holder ?? null,
          concession_type: c.concession_type ?? null,
          status: c.status ?? null,
          area_ha: c.area_ha != null ? Number(c.area_ha) : null,
          region: c.region ?? null,
          commune: c.commune ?? null,
          granted_at: c.granted_at ?? null,
          expires_at: c.expires_at ?? null,
        };
        return [{ type: "Feature", id: String(c.id), geometry: geom, properties: props }];
      }),
    };

    // 2) Targets
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
      features: (tgts ?? []).flatMap((t): MapFeature[] => {
        if (t.lng == null || t.lat == null) return [];
        const props: Props = {
          layer: "target",
          id: String(t.id),
          code: t.code ?? null,
          name: t.name ?? null,
          target_type: t.target_type ?? null,
          commodity: t.commodity ?? null,
          elevation_m: t.elevation_m != null ? Number(t.elevation_m) : null,
          stage: t.stage ?? null,
          priority: t.priority ?? null,
          score: t.score != null ? Number(t.score) : null,
          confidence_pct: t.confidence_pct != null ? Number(t.confidence_pct) : null,
          rationale: t.rationale ?? null,
        };
        return [
          {
            type: "Feature",
            id: String(t.id),
            geometry: { type: "Point", coordinates: [Number(t.lng), Number(t.lat)] },
            properties: props,
          },
        ];
      }),
    };

    // 3) Satellite anomalies — usar bbox centroide (sin PostGIS RPC)
    const { data: sats, error: sErr } = await supabaseAdmin
      .from("satellite_anomalies")
      .select("id, index_code, severity, score, bbox")
      .eq("project_id", PROJECT_ID);
    if (sErr) throw new Error(`sat: ${sErr.message}`);
    const satAnomalies: FC = {
      type: "FeatureCollection",
      features: (sats ?? []).flatMap((s): MapFeature[] => {
        // bbox puede venir como array [minLng,minLat,maxLng,maxLat] o como GeoJSON {type,coordinates}
        let center: [number, number] | null = null;
        const bb = s.bbox;
        if (Array.isArray(bb) && bb.length >= 4) {
          const [a, b, c, d] = (bb as number[]).map(Number);
          center = [(a + c) / 2, (b + d) / 2];
        } else if (bb && typeof bb === "object" && "coordinates" in bb) {
          const coords = (bb as { coordinates?: number[][][] }).coordinates;
          // intentamos polygon
          if (Array.isArray(coords?.[0]?.[0])) {
            let mnx = Infinity,
              mny = Infinity,
              mxx = -Infinity,
              mxy = -Infinity;
            for (const ring of coords as number[][][]) {
              for (const [x, y] of ring) {
                if (x < mnx) mnx = x;
                if (x > mxx) mxx = x;
                if (y < mny) mny = y;
                if (y > mxy) mxy = y;
              }
            }
            center = [(mnx + mxx) / 2, (mny + mxy) / 2];
          }
        }
        if (!center) return [];
        const props: Props = {
          layer: "sat_anomaly",
          id: String(s.id),
          index_code: s.index_code ?? null,
          severity: s.severity ?? null,
          score: s.score != null ? Number(s.score) : null,
        };
        return [
          {
            type: "Feature",
            id: String(s.id),
            geometry: { type: "Point", coordinates: center },
            properties: props,
          },
        ];
      }),
    };

    // 4) Mag anomalies
    const { data: mags, error: mErr } = await supabaseAdmin
      .from("mag_targets")
      .select("id, name, lat, lon, mag_nt, rank, radius_m")
      .eq("project_id", PROJECT_ID);
    if (mErr) throw new Error(`mag: ${mErr.message}`);
    const magAnomalies: FC = {
      type: "FeatureCollection",
      features: (mags ?? []).flatMap((m): MapFeature[] => {
        if (m.lat == null || m.lon == null) return [];
        const props: Props = {
          layer: "mag_anomaly",
          id: String(m.id),
          name: m.name ?? null,
          mag_nt: m.mag_nt != null ? Number(m.mag_nt) : null,
          rank: m.rank != null ? Number(m.rank) : null,
          radius_m: m.radius_m != null ? Number(m.radius_m) : null,
        };
        return [
          {
            type: "Feature",
            id: String(m.id),
            geometry: { type: "Point", coordinates: [Number(m.lon), Number(m.lat)] },
            properties: props,
          },
        ];
      }),
    };

    // BBox
    const allCoords: Array<[number, number]> = [];
    const walk = (c: unknown) => {
      if (!Array.isArray(c)) return;
      if (typeof c[0] === "number") allCoords.push([c[0], c[1]]);
      else for (const x of c) walk(x);
    };
    for (const fc of [concessions, targets, satAnomalies, magAnomalies]) {
      for (const f of fc.features) {
        if ("coordinates" in f.geometry) walk((f.geometry as { coordinates: unknown }).coordinates);
      }
    }
    let bbox: LosVerdesMapData["bbox"] = null;
    let center: [number, number] = [-71.05, -31.95];
    if (allCoords.length) {
      let mnx = Infinity,
        mny = Infinity,
        mxx = -Infinity,
        mxy = -Infinity;
      for (const [x, y] of allCoords) {
        if (x < mnx) mnx = x;
        if (x > mxx) mxx = x;
        if (y < mny) mny = y;
        if (y > mxy) mxy = y;
      }
      bbox = [mnx, mny, mxx, mxy];
      center = [(mnx + mxx) / 2, (mny + mxy) / 2];
    }

    return {
      bbox,
      center,
      concessions,
      targets,
      satAnomalies,
      magAnomalies,
      counts: {
        concessions: cons?.length ?? 0,
        concessionsWithGeom: concessions.features.length,
        targets: targets.features.length,
        satAnomalies: satAnomalies.features.length,
        magAnomalies: magAnomalies.features.length,
      },
    };
  },
);
