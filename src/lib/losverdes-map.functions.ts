import { createServerFn } from "@tanstack/react-start";
import proj4 from "proj4";
import integratedTenureRaw from "@/data/geo/losverdes_proyecto_integrado.geojson?raw";

const PROJECT_ID = "7a499b02-ecdf-447b-8956-b106fe4ec087";
const integratedTenure = JSON.parse(integratedTenureRaw) as {
  features: Array<{
    id?: string | number;
    geometry: GeoJSON.Geometry | null;
    properties: Props;
  }>;
  metadata: { objetivo_ha: number };
};

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
  counts: {
    concessions: number;
    concessionsWithGeom: number;
    projectPackage?: number;
    projectPackageHa?: number;
    arranqueHa?: number;
    annexHa?: number;
    annexPendingHa?: number;
    neighbours?: number;
    objectiveHa?: number;
    unconfirmedHa?: number;
    targets: number;
    satAnomalies: number;
    magAnomalies: number;
    samples: number;
  };
};

export const getLosVerdesMapData = createServerFn({ method: "GET" }).handler(
  async (): Promise<LosVerdesMapData> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Paquete geoespacial oficial integrado, con asociación declarada y fases explícitas.
    // No inferir propiedad legal desde titular/RUT: la cartera es multi-titular.
    const packageFeatures = integratedTenure.features;
    const concessions: FC = {
      type: "FeatureCollection",
      features: packageFeatures.map((feature, index): MapFeature => {
        const p = feature.properties;
        const isProjectPackage = p.grupo === "proyecto";
        return {
          type: "Feature",
          id: feature.id ?? String(p.rol ?? index),
          geometry: feature.geometry,
          properties: {
            ...p,
            layer: "concession",
            project_id: PROJECT_ID,
            es_tenencia_proyecto: isProjectPackage,
            tenencia_procedencia: isProjectPackage ? "declared" : null,
            tenencia_asociacion: isProjectPackage
              ? "integrated_project_package"
              : "official_neighbour_context",
            contrato_verificado: false,
            hasGeometry: Boolean(feature.geometry),
            geometry_source: p.fuente ?? null,
            id: String(p.rol ?? index),
            code: p.rol ?? null,
            name: p.nombre ?? null,
            holder: p.titular ?? null,
            rut_holder: null,
            fase: p.fase ?? null,
            grupo: p.grupo ?? null,
            rol: p.rol ?? null,
            hectareas: p.hectareas ?? null,
            comuna: p.comuna ?? null,
            status: p.situacion ?? null,
            area_ha: p.hectareas ?? null,
          },
        };
      }),
    };
    const projectFeatures = concessions.features.filter(
      (feature) => feature.properties.grupo === "proyecto",
    );
    const arranqueHa = projectFeatures
      .filter((feature) => feature.properties.fase === "arranque")
      .reduce((sum, feature) => sum + Number(feature.properties.hectareas ?? 0), 0);
    const annexes = projectFeatures.filter((feature) => feature.properties.fase === "anexo");
    const annexHa = annexes.reduce(
      (sum, feature) => sum + Number(feature.properties.hectareas ?? 0),
      0,
    );
    const annexPendingHa = annexes
      .filter((feature) =>
        String(feature.properties.situacion)
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toUpperCase()
          .includes("TRAMITE"),
      )
      .reduce((sum, feature) => sum + Number(feature.properties.hectareas ?? 0), 0);

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
      bbox,
      center,
      concessions,
      targets,
      satAnomalies,
      magAnomalies,
      samples,
      counts: {
        concessions: concessions.features.length,
        concessionsWithGeom: concessions.features.filter((f) => f.geometry != null).length,
        projectPackage: projectFeatures.length,
        projectPackageHa: projectFeatures.reduce(
          (sum, feature) => sum + Number(feature.properties.hectareas ?? 0),
          0,
        ),
        arranqueHa,
        annexHa,
        annexPendingHa,
        neighbours: concessions.features.length - projectFeatures.length,
        objectiveHa: Number(integratedTenure.metadata.objetivo_ha),
        unconfirmedHa:
          Number(integratedTenure.metadata.objetivo_ha) -
          projectFeatures.reduce(
            (sum, feature) => sum + Number(feature.properties.hectareas ?? 0),
            0,
          ),
        targets: targets.features.length,
        satAnomalies: satAnomalies.features.length,
        magAnomalies: magAnomalies.features.length,
        samples: samples.features.length,
      },
    };
  },
);
