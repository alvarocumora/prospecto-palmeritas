import type { FeatureCollection } from "geojson";
import { ProjectMasterViewer } from "@/components/geo/ProjectMasterViewer";
import type { AssayPoint } from "@/components/geo/ProjectMasterViewer";
import { useProjectGeophysicsData } from "@/hooks/useProjectGeophysicsData";
import { useSentinelRasterPreview } from "@/hooks/useSentinelRasterPreview";
import { useProjects } from "@/hooks/useProjects";
import { cholquiFieldGeophysics } from "@/lib/cholqui/geophysicsTerrain";
import { useEmitMineralogyLayers } from "@/lib/cholqui/emitMineralogy";
import { geoColors } from "@/lib/geospatial/visualTokens";
// Catastro OFICIAL directo de SERNAGEOMIN (no el KMZ del operador).
import concessionsRaw from "@/data/geo/cholqui_catastro_sngm.geojson?raw";
import anomaliesRaw from "@/data/geo/cholqui_satellite_candidates.geojson?raw";
import drillRaw from "@/data/geo/cholqui_drill_grid.geojson?raw";
import pedimentosRaw from "@/data/geo/cholqui_pedimentos.geojson?raw";
// Inteligencia de catastro (data oficial SERNAGEOMIN vía ArcGIS Online):
import franjasRaw from "@/data/geo/cholqui_franjas.geojson?raw";
import yacimientosRaw from "@/data/geo/cholqui_yacimientos.geojson?raw";
// Pedimentos declarados por el titular (KML propio) que aún no aparecen en el
// catastro oficial SERNAGEOMIN, y sus hitos de mensura declarados:
import pedimentosPendientesRaw from "@/data/geo/cholqui_pedimentos_pendientes.geojson?raw";
import mojonesRaw from "@/data/geo/cholqui_mojones.geojson?raw";
import cadSurveyJson from "@/data/geo/cholqui_levantamiento_cad.json";
const cadSurvey = cadSurveyJson as unknown as Record<
  "contours" | "accesos" | "hitos" | "perimetro",
  FeatureCollection
>;
import { CHOLQUI, CHOLQUI_POINTS, CHOLQUI_ASSAYS } from "../data/cholqui";
import { CHOLQUI_STRUCTURES_GEOJSON } from "../data/cholquiStructures";
import { CHOLQUI_INTERPOLATION_NOTICE, CHOLQUI_COORDINATE_NOTICE } from "../cholquiGeoPolicy";

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
const pedimentosPendientes = parse(pedimentosPendientesRaw);
const mojones = parse(mojonesRaw);

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
    certified: Boolean(a),
    lab: a?.lab,
    reportId: a?.reportId,
    reportDate: a?.reportDate,
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

// Levantamiento topográfico del titular (DWG 14-oct-2026, UTM 19S → WGS84) + perímetro KMZ.
const CAD_CAUTION =
  "Plano declarado por el titular (CAD Franco De Martino); no reemplaza la mensura oficial SERNAGEOMIN.";
const CAD_LAYERS = [
  {
    id: "cad-perimetro",
    label: "Perímetro total pertenencias (KMZ titular)",
    evidence: "DECLARADO",
    caution: CAD_CAUTION,
    features: cadSurvey.perimetro,
    color: geoColors.signal,
  },
  {
    id: "cad-curvas",
    label: "Curvas de nivel levantamiento (270–1.730 m)",
    evidence: "DECLARADO",
    caution: CAD_CAUTION,
    features: cadSurvey.contours,
    color: (p: Record<string, unknown>) =>
      p.tipo === "maestra" ? geoColors.terrainLow : geoColors.terrainMid,
  },
  {
    id: "cad-accesos",
    label: "Accesos y caminos (CAD)",
    evidence: "DECLARADO",
    caution: CAD_CAUTION,
    features: cadSurvey.accesos,
    color: geoColors.deposit,
  },
  {
    id: "cad-hitos",
    label: "Hitos topográficos (Portón 1, Pallocabe 6, Pico quebrada)",
    evidence: "DECLARADO",
    caution: CAD_CAUTION,
    features: cadSurvey.hitos,
    color: geoColors.proposedDrill,
  },
];

export function CholquiMasterViewer() {
  const { projects } = useProjects();
  const project = projects.find(
    (candidate) =>
      candidate.code?.toUpperCase() === CHOLQUI.code ||
      candidate.name?.toLowerCase().includes("cholqui"),
  );
  const { data: geophysics } = useProjectGeophysicsData(project?.id);
  const { data: satellitePreview } = useSentinelRasterPreview(project?.id);
  const emitLayers = useEmitMineralogyLayers("cholqui");

  return (
    <ProjectMasterViewer
      projectName={CHOLQUI.name}
      reportMapId="cholqui"
      enableLayerTools
      spectralFootprintsOnly
      anomalyIntensityDisabledReason={CHOLQUI_INTERPOLATION_NOTICE}
      coordinateNotice={CHOLQUI_COORDINATE_NOTICE}
      center={CHOLQUI.center}
      concessions={concessions}
      anomalies={anomalies}
      drillGrid={drillGrid}
      pedimentos={pedimentos}
      assays={assays}
      coverage={coverage}
      geophysics={project ? cholquiFieldGeophysics(geophysics, project.id) : null}
      franjas={franjas}
      yacimientos={yacimientos}
      estructuras={CHOLQUI_STRUCTURES_GEOJSON}
      pedimentosPendientes={pedimentosPendientes}
      mojones={mojones}
      contextLayers={[
        ...CAD_LAYERS,
        ...emitLayers,
        ...(satellitePreview?.features.length
          ? [
              {
                id: "sentinel2-real-preview",
                label: "Sentinel-2 · índices procesados (malla de vista)",
                evidence: "DERIVADO",
                caution:
                  "Vista reducida del GeoTIFF real; índices modelados, no son identificación mineral ni mediciones de terreno.",
                features: satellitePreview,
                color: geoColors.tenureOwn,
              },
            ]
          : []),
      ]}
      // geoquimica: sin dato — la geoquímica de sedimentos SERNAGEOMIN no cubre
      // Melipilla (-33.85); no se cablea para no fabricar evidencia.
    />
  );
}
