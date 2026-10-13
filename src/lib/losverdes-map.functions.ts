import { createServerFn } from "@tanstack/react-start";
import proj4 from "proj4";
import integratedRaw from "@/data/geo/losverdes_proyecto_integrado.geojson?raw";

const PROJECT_ID = "7a499b02-ecdf-447b-8956-b106fe4ec087";

type PropValue = string | number | boolean | null;
type Props = Record<string, PropValue>;

export type MapFeature = {
  type: "Feature";
  id?: string | number;
  geometry: GeoJSON.Geometry | null;
  properties: Props;
};

export type FC = {
  type: "FeatureCollection";
  features: MapFeature[];
};

export type LosVerdesMapData = {
  geometryLookupWarning?: string;
  bbox: [number, number, number, number] | null;
  center: [number, number];
  concessions: FC;
  targets: FC;
  satAnomalies: FC;
  magAnomalies: FC;
  samples: FC;
  tenure: { ownHa: number; ownCount: number; neighborHa: number; neighborCount: number; targetHa: number };
  counts: {
    concessions: number;
    concessionsWithGeom: number;
    targets: number;
    satAnomalies: number;
    magAnomalies: number;
    samples: number;
  };
};

export const getLosVerdesMapData = createServerFn({ method: "GET" }).handler(
  async (): Promise<LosVerdesMapData> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // 1) Concesiones
    const { data: cons, error: cErr } = await supabaseAdmin
      .from("mining_concessions")
      .select(
        "id, code, name, holder, rut_holder, concession_type, status, area_ha, region, commune, granted_at, expires_at, geometry_geojson",
      )
      .eq("project_id", PROJECT_ID);
    if (cErr) throw new Error(`concessions: ${cErr.message}`);

    // Recover only an exact official rol match. A holder or a centroid is not a polygon.
    const missingCodes = (cons ?? []).filter((c) => !c.geometry_geojson).map((c) => c.code);
    const officialGeometry = new Map<string, unknown>();
    let geometryLookupWarning: string | undefined;
    if (missingCodes.length) {
      const cached = await supabaseAdmin
        .from("cadastre_national")
        .select("rol, geometry_geojson")
        .is("archived_at", null)
        .in("rol", missingCodes);
      if (cached.error)
        geometryLookupWarning = "No se pudo consultar la geometría oficial por rol.";
      else {
        const ambiguous = new Set<string>();
        for (const row of cached.data ?? []) {
          if (!row.rol || !row.geometry_geojson) continue;
          if (officialGeometry.has(row.rol)) ambiguous.add(row.rol);
          officialGeometry.set(row.rol, row.geometry_geojson);
        }
        for (const code of ambiguous) officialGeometry.delete(code);
      }
    }

    const concessions: FC = {
      type: "FeatureCollection",
      features: (cons ?? []).map((c): MapFeature => {
        let geom: GeoJSON.Geometry | null = null;
        const rawGeometry = c.geometry_geojson ?? officialGeometry.get(c.code);
        if (rawGeometry) {
          try {
            geom =
              typeof rawGeometry === "string"
                ? JSON.parse(rawGeometry)
                : (rawGeometry as GeoJSON.Geometry);
            if (!geom || !["Polygon", "MultiPolygon"].includes(geom.type)) geom = null;
          } catch {
            geom = null;
          }
        }
        const props: Props = {
          layer: "concession",
          project_id: PROJECT_ID,
          es_tenencia_proyecto: true,
          tenencia_procedencia: "declared",
          tenencia_asociacion: "project_id",
          hasGeometry: Boolean(geom),
          geometry_source: c.geometry_geojson
            ? "project_record"
            : geom
              ? "cadastre_national_exact_rol"
              : null,
          id: String(c.id),
          code: c.code ?? null,
          name: c.name ?? null,
          holder: c.holder ?? null,
          rut_holder: c.rut_holder ?? null,
          rol: c.code ?? null,
          nombre: c.name ?? null,
          titular: c.holder ?? null,
          situacion: c.status ?? null,
          tipo: c.concession_type ?? null,
          hectareas: c.area_ha != null ? Number(c.area_ha) : null,
          comuna: c.commune ?? null,
          concession_type: c.concession_type ?? null,
          status: c.status ?? null,
          area_ha: c.area_ha != null ? Number(c.area_ha) : null,
          region: c.region ?? null,
          commune: c.commune ?? null,
          granted_at: c.granted_at ?? null,
          expires_at: c.expires_at ?? null,
        };
        return { type: "Feature", id: String(c.id), geometry: geom, properties: props };
      }),
    };

    // Paquete integrado SERNAGEOMIN (polígonos declarados). Se agrega solo lo que falte por nombre.
    const norm = (s: unknown) =>
      String(s ?? "")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");
    const known = new Set(
      concessions.features.filter((f) => f.geometry).map((f) => norm(f.properties.nombre)),
    );
    const integrated = JSON.parse(integratedRaw) as {
      features: Array<{ geometry: GeoJSON.Geometry; properties: Record<string, PropValue> }>;
    };
    const tenure = { ownHa: 0, ownCount: 0, neighborHa: 0, neighborCount: 0, targetHa: 2600 };
    integrated.features.forEach((f, i) => {
      const p = f.properties;
      const own = p.grupo === "proyecto";
      const ha = Number(p.hectareas ?? 0);
      if (own) {
        tenure.ownHa += ha;
        tenure.ownCount += 1;
      } else {
        tenure.neighborHa += ha;
        tenure.neighborCount += 1;
      }
      if (own && known.has(norm(p.nombre))) return;
      concessions.features.push({
        type: "Feature",
        id: `sngm-${i}`,
        geometry: f.geometry,
        properties: {
          layer: "concession",
          es_tenencia_proyecto: own,
          tenencia_procedencia: "declared",
          tenencia_asociacion: own ? "proyecto_integrado" : "vecino_major",
          hasGeometry: true,
          geometry_source: "sernageomin_catastro",
          rol: p.rol ?? null,
          code: p.rol ?? null,
          nombre: p.nombre ?? null,
          name: p.nombre ?? null,
          titular: p.titular ?? null,
          holder: p.titular ?? null,
          situacion: p.situacion ?? null,
          status: p.situacion ?? null,
          tipo: p.tipo ?? null,
          hectareas: ha,
          area_ha: ha,
          comuna: p.comuna ?? null,
          fase: p.fase ?? null,
        },
      });
    });

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

    // 5) Muestreo geoquímico — UTM WGS84 19S a coordenadas geográficas.
    const { data: sampleRows, error: sampleErr } = await supabaseAdmin
      .from("sampling_results")
      .select(
        "id,sample_code,sample_type,easting,northing,cu_pct,au_gpt,ag_gpt,lab,certificate,record_status",
      )
      .eq("project_id", PROJECT_ID)
      .limit(500);
    if (sampleErr) throw new Error(`samples: ${sampleErr.message}`);
    const samples: FC = {
      type: "FeatureCollection",
      features: (sampleRows ?? []).flatMap((sample): MapFeature[] => {
        if (sample.easting == null || sample.northing == null) return [];
        const [lng, lat] = proj4(
          "+proj=utm +zone=19 +south +datum=WGS84 +units=m +no_defs",
          "EPSG:4326",
          [Number(sample.easting), Number(sample.northing)],
        );
        return [
          {
            type: "Feature",
            id: String(sample.id),
            geometry: { type: "Point", coordinates: [lng, lat] },
            properties: {
              layer: "sample",
              id: String(sample.id),
              sample_code: sample.sample_code,
              sample_type: sample.sample_type,
              easting: Number(sample.easting),
              northing: Number(sample.northing),
              cu_pct: sample.cu_pct == null ? null : Number(sample.cu_pct),
              au_gpt: sample.au_gpt == null ? null : Number(sample.au_gpt),
              ag_gpt: sample.ag_gpt == null ? null : Number(sample.ag_gpt),
              lab: sample.lab,
              certificate: sample.certificate,
              record_status: sample.record_status,
            },
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
    for (const fc of [concessions, targets, satAnomalies, magAnomalies, samples]) {
      for (const f of fc.features) {
        if (f.geometry && "coordinates" in f.geometry)
          walk((f.geometry as { coordinates: unknown }).coordinates);
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
      geometryLookupWarning,
      bbox,
      center,
      concessions,
      targets,
      satAnomalies,
      magAnomalies,
      samples,
      tenure,
      counts: {
        concessions: concessions.features.filter((f) => f.properties.es_tenencia_proyecto).length,
        concessionsWithGeom: concessions.features.filter((f) => f.geometry != null).length,
        targets: targets.features.length,
        satAnomalies: satAnomalies.features.length,
        magAnomalies: magAnomalies.features.length,
        samples: samples.features.length,
      },
    };
  },
);
