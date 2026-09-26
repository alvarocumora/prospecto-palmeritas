import type { FeatureCollection } from "geojson";
import { ProjectMasterViewer, type AssayPoint } from "@/components/geo/ProjectMasterViewer";
// Catastro OFICIAL directo de SERNAGEOMIN (no el KMZ del operador).
import concessionsRaw from "@/data/geo/cholqui_catastro_sngm.geojson?raw";
import anomaliesRaw from "@/data/geo/cholqui_satellite_candidates.geojson?raw";
import drillRaw from "@/data/geo/cholqui_drill_grid.geojson?raw";
import { CHOLQUI, CHOLQUI_POINTS, CHOLQUI_ASSAYS } from "../data/cholqui";

/** Visor maestro unificado de Cholqui: reemplaza los 3 mapas apilados por uno solo. */
function parse(raw: string): (FeatureCollection & { metadata?: Record<string, unknown> }) | null {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

const concessions = parse(concessionsRaw);
const anomalies = parse(anomaliesRaw);
const drillGrid = parse(drillRaw);

const norm = (s: string) => s.replace(/[-\s]/g, "").toUpperCase();
const assayBy = new Map(CHOLQUI_ASSAYS.map((a) => [norm(a.sample), a]));
const assays: AssayPoint[] = CHOLQUI_POINTS.map((pt) => {
  const a = assayBy.get(norm(pt.code));
  return {
    code: pt.code,
    name: pt.name,
    lat: pt.lat,
    lng: pt.lng,
    cuTotalPct: a?.cuTotalPct,
    cuSolublePct: a?.cuSolublePct,
    auGpt: a?.auGpt,
    agPpm: a?.agPpm,
  };
});

const cov = (anomalies?.metadata?.coverage ?? null) as Record<string, unknown> | null;
const coverage = cov
  ? {
      typicalPct: Number(cov.interpretable_typical_pct ?? cov.typical_pct ?? NaN) || undefined,
      bestcasePct: Number(cov.interpretable_bestcase_pct ?? cov.bestcase_pct ?? NaN) || undefined,
      conclusive: Boolean(cov.spectral_conclusive),
    }
  : null;

export function CholquiMasterViewer() {
  return (
    <ProjectMasterViewer
      projectName={CHOLQUI.name}
      center={CHOLQUI.center}
      concessions={concessions}
      anomalies={anomalies}
      drillGrid={drillGrid}
      assays={assays}
      coverage={coverage}
    />
  );
}
