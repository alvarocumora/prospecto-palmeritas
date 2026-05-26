// Server function pública: devuelve el snapshot del proyecto Tilama
// (Distrito Los Verdes – Tilama) para el live view /live/tilama.
// Usa el cliente admin con WHERE acotado al project_id — RLS bypass intencional
// porque la ruta /live/tilama es pública y solo expone columnas seguras.
import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

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
  geometry_geojson: unknown;
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

export type TilamaReport = {
  project: TilamaProject;
  satAnomalies: TilamaSatAnomaly[];
  concessions: TilamaConcession[];
  targets: TilamaTarget[];
  stats: {
    satTotal: number;
    satHigh: number;
    satMedium: number;
    concessionsTotal: number;
    concessionsHa: number;
    targetsTotal: number;
    targetsCritical: number;
    targetsHigh: number;
  };
};

export const getTilamaReport = createServerFn({ method: "GET" }).handler(
  async (): Promise<TilamaReport> => {
    const [proj, sat, conc, tgt] = await Promise.all([
      supabaseAdmin
        .from("projects")
        .select(
          "id, code, name, description, commodity, region, country, center_lat, center_lng",
        )
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
        .limit(40),
    ]);

    if (proj.error || !proj.data) throw new Error("Proyecto Tilama no encontrado");

    const satRows = (sat.data ?? []) as TilamaSatAnomaly[];
    const tgtRows = (tgt.data ?? []) as TilamaTarget[];
    const concRows = (conc.data ?? []) as TilamaConcession[];

    return {
      project: proj.data as TilamaProject,
      satAnomalies: satRows,
      concessions: concRows,
      targets: tgtRows,
      stats: {
        satTotal: satRows.length,
        satHigh: satRows.filter((a) => (a.severity ?? "").toLowerCase() === "high").length,
        satMedium: satRows.filter((a) => (a.severity ?? "").toLowerCase() === "medium").length,
        concessionsTotal: concRows.length,
        concessionsHa: concRows.reduce((s, c) => s + Number(c.area_ha ?? 0), 0),
        targetsTotal: tgtRows.length,
        targetsCritical: tgtRows.filter((t) => (t.priority ?? "").toLowerCase() === "critical").length,
        targetsHigh: tgtRows.filter((t) => (t.priority ?? "").toLowerCase() === "high").length,
      },
    };
  },
);
