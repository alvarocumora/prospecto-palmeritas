import type { FeatureCollection } from "geojson";
import { ProjectMasterViewer, type AssayPoint } from "@/components/geo/ProjectMasterViewer";
import { useProjectGeophysicsData } from "@/hooks/useProjectGeophysicsData";
import { useProjects } from "@/hooks/useProjects";
// Catastro OFICIAL directo de SERNAGEOMIN (no el KMZ del operador).
import concessionsRaw from "@/data/geo/cholqui_catastro_sngm.geojson?raw";
import anomaliesRaw from "@/data/geo/cholqui_satellite_candidates.geojson?raw";
import drillRaw from "@/data/geo/cholqui_drill_grid.geojson?raw";
import pedimentosRaw from "@/data/geo/cholqui_pedimentos.geojson?raw";
// Inteligencia de catastro (data oficial SERNAGEOMIN vía ArcGIS Online):
import franjasRaw from "@/data/geo/cholqui_franjas.geojson?raw";
import yacimientosRaw from "@/data/geo/cholqui_yacimientos.geojson?raw";
import { CHOLQUI, CHOLQUI_POINTS, CHOLQUI_ASSAYS } from "../data/cholqui";
import { CHOLQUI_STRUCTURES_GEOJSON } from "../data/cholquiStructures";

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
const pedimentos = parse(pedimentosRaw);
const franjas = parse(franjasRaw);
const yacimientos = parse(yacimientosRaw);

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
  const { projects } = useProjects();
  const project = projects.find(
    (candidate) =>
      candidate.code?.toUpperCase() === CHOLQUI.code ||
      candidate.name?.toLowerCase().includes("cholqui"),
  );
  const { data: geophysics } = useProjectGeophysicsData(project?.id);

  return (
    <ProjectMasterViewer
      projectName={CHOLQUI.name}
      reportMapId="cholqui"
      center={CHOLQUI.center}
      concessions={concessions}
      anomalies={anomalies}
      drillGrid={drillGrid}
      pedimentos={pedimentos}
      assays={assays}
      coverage={coverage}
      geophysics={geophysics}
      franjas={franjas}
      yacimientos={yacimientos}
      estructuras={CHOLQUI_STRUCTURES_GEOJSON}
      // geoquimica: sin dato — la geoquímica de sedimentos SERNAGEOMIN no cubre
      // Melipilla (-33.85); no se cablea para no fabricar evidencia.
    />
  );
}
