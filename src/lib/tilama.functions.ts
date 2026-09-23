// Server function pública: devuelve el snapshot del proyecto Tilama
// (Distrito Los Verdes – Tilama) para el live view canónico /live/losverdes.
// Usa el cliente admin con WHERE acotado al project_id — RLS bypass intencional
// porque la ruta /live/losverdes es pública y solo expone columnas seguras.
import { createServerFn } from "@tanstack/react-start";
import proj4 from "proj4";

const TILAMA_PROJECT_ID = "7a499b02-ecdf-447b-8956-b106fe4ec087";

export type TilamaProject = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  commodity: string | null;
  region: string | null;
  country: string | null;
  center_lat: number;
  center_lng: number;
};

export type TilamaSatAnomaly = {
  id: string;
  index_code: string;
  severity: string | null;
  score: number | null;
  area_ha: number | null;
  geometry: GeoJSON.Geometry | null;
  bbox: number[] | null;
};

export type TilamaConcession = {
  id: string;
  code: string;
  name: string;
  concession_type: string | null;
  status: string | null;
  holder: string | null;
  area_ha: number | null;
  commune: string | null;
  geometry_geojson: GeoJSON.Geometry | null;
};

export type TilamaTarget = {
  id: string;
  code: string;
  name: string;
  target_type: string | null;
  commodity: string | null;
  lat: number | null;
  lng: number | null;
  stage: string | null;
  priority: string | null;
  score: number | null;
  confidence_pct: number | null;
  rationale: string | null;
};

export type TilamaSample = {
  id: string;
  sample_code: string;
  sample_type: string | null;
  easting: number;
  northing: number;
  lat: number;
  lng: number;
  cu_pct: number | null;
  au_gpt: number | null;
  ag_gpt: number | null;
  lab: string | null;
  certificate: string | null;
  record_status: string;
};

export type TilamaReport = {
  project: TilamaProject;
  satAnomalies: TilamaSatAnomaly[];
  concessions: TilamaConcession[];
  targets: TilamaTarget[];
  samples: TilamaSample[];
  stats: {
    satTotal: number;
    satHigh: number;
    satMedium: number;
    concessionsTotal: number;
    concessionsHa: number;
    targetsTotal: number;
    targetsCritical: number;
    targetsHigh: number;
    samplesTotal: number;
    cuAvgPct: number | null;
    cuMaxPct: number | null;
    auMaxGpt: number | null;
    agMaxGpt: number | null;
  };
};

export const getTilamaReport = createServerFn({ method: "GET" }).handler(
  async (): Promise<TilamaReport> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [proj, sat, conc, tgt, samples] = await Promise.all([
      supabaseAdmin
        .from("projects")
        .select("id, code, name, description, commodity, region, country, center_lat, center_lng")
        .eq("id", TILAMA_PROJECT_ID)
        .single(),
      supabaseAdmin
        .from("satellite_anomalies")
        .select("id, index_code, severity, score, area_ha, geometry, bbox")
        .eq("project_id", TILAMA_PROJECT_ID)
        .order("score", { ascending: false })
        .limit(60),
      supabaseAdmin
        .from("mining_concessions")
        .select(
          "id, code, name, concession_type, status, holder, area_ha, commune, geometry_geojson",
        )
        .eq("project_id", TILAMA_PROJECT_ID)
        .limit(50),
      supabaseAdmin
        .from("exploration_targets")
        .select(
          "id, code, name, target_type, commodity, lat, lng, stage, priority, score, confidence_pct, rationale",
        )
        .eq("project_id", TILAMA_PROJECT_ID)
        .order("score", { ascending: false })
        .limit(200),
      supabaseAdmin
        .from("sampling_results")
        .select(
          "id,sample_code,sample_type,easting,northing,cu_pct,au_gpt,ag_gpt,lab,certificate,record_status",
        )
        .eq("project_id", TILAMA_PROJECT_ID)
        .order("sample_code")
        .limit(500),
    ]);

    if (proj.error || !proj.data) throw new Error("Proyecto Tilama no encontrado");

    const satRows = (sat.data ?? []) as TilamaSatAnomaly[];
    const tgtRows = (tgt.data ?? []) as TilamaTarget[];
    const concRows = (conc.data ?? []) as TilamaConcession[];
    const sampleRows = (samples.data ?? []).flatMap((sample) => {
      if (sample.easting == null || sample.northing == null) return [];
      const [lng, lat] = proj4(
        "+proj=utm +zone=19 +south +datum=WGS84 +units=m +no_defs",
        "EPSG:4326",
        [Number(sample.easting), Number(sample.northing)],
      );
      return [
        {
          ...sample,
          easting: Number(sample.easting),
          northing: Number(sample.northing),
          lat,
          lng,
          cu_pct: sample.cu_pct == null ? null : Number(sample.cu_pct),
          au_gpt: sample.au_gpt == null ? null : Number(sample.au_gpt),
          ag_gpt: sample.ag_gpt == null ? null : Number(sample.ag_gpt),
        } as TilamaSample,
      ];
    });
    const cu = sampleRows.flatMap((s) => (s.cu_pct == null ? [] : [s.cu_pct]));
    const au = sampleRows.flatMap((s) => (s.au_gpt == null ? [] : [s.au_gpt]));
    const ag = sampleRows.flatMap((s) => (s.ag_gpt == null ? [] : [s.ag_gpt]));

    return {
      project: proj.data as TilamaProject,
      satAnomalies: satRows,
      concessions: concRows,
      targets: tgtRows,
      samples: sampleRows,
      stats: {
        satTotal: satRows.length,
        satHigh: satRows.filter((a) => (a.severity ?? "").toLowerCase() === "high").length,
        satMedium: satRows.filter((a) => (a.severity ?? "").toLowerCase() === "medium").length,
        concessionsTotal: concRows.length,
        concessionsHa: concRows.reduce((s, c) => s + Number(c.area_ha ?? 0), 0),
        targetsTotal: tgtRows.length,
        targetsCritical: tgtRows.filter((t) => (t.priority ?? "").toLowerCase() === "critical")
          .length,
        targetsHigh: tgtRows.filter((t) => (t.priority ?? "").toLowerCase() === "high").length,
        samplesTotal: sampleRows.length,
        cuAvgPct: cu.length ? cu.reduce((sum, value) => sum + value, 0) / cu.length : null,
        cuMaxPct: cu.length ? Math.max(...cu) : null,
        auMaxGpt: au.length ? Math.max(...au) : null,
        agMaxGpt: ag.length ? Math.max(...ag) : null,
      },
    };
  },
);
