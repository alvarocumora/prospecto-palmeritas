import type { Database } from "@/integrations/supabase/types";

/**
 * Mappers puros hacia el shape de geoscience_datasets (el registry global de
 * datasets). No hacen fetch ni insert — solo construyen el draft; quien
 * llama decide cuándo y cómo persistirlo (evita acoplar este archivo a un
 * cliente Supabase concreto y lo hace testeable sin red).
 */

export type GeoscienceDatasetDraft = Database["public"]["Tables"]["geoscience_datasets"]["Insert"];

type SatelliteAnalysisRunRow = Database["public"]["Tables"]["satellite_analysis_runs"]["Row"];
type GeophysicsSurveyRow = Database["public"]["Tables"]["geophysics_surveys"]["Row"];
type GeoscienceComputeJobRow = Database["public"]["Tables"]["geoscience_compute_jobs"]["Row"];

export function satelliteRunToDatasetDraft(run: SatelliteAnalysisRunRow): GeoscienceDatasetDraft {
  return {
    project_id: run.project_id,
    dataset_type: "remote_sensing",
    name: `${run.sensor} · ${run.index_code}`,
    method: run.index_code,
    source_system: run.provider,
    source_ref: run.external_scene_id,
    // No hay columna de CRS explícita en satellite_analysis_runs; se deja
    // sin inventar en vez de asumir WGS84.
    crs: null,
    geometry_type:
      run.aoi_geometry && typeof run.aoi_geometry === "object" && "type" in run.aoi_geometry
        ? String((run.aoi_geometry as { type?: unknown }).type ?? "")
        : null,
    bbox_wgs84: run.bbox,
    provenance: "DERIVED",
    acquisition_start: run.date_from,
    acquisition_end: run.date_to,
    resolution: {},
    content_hash: run.content_hash,
    created_by: run.created_by,
    metadata: {
      runId: run.id,
      pipelineVersion: run.pipeline_version,
      evalscriptVersion: run.evalscript_version,
      maxCloudCoverPct: run.max_cloud_cover_pct,
      parentRunId: run.parent_run_id,
      sourceMetadata: run.source_metadata,
      status: run.status,
    },
  };
}

/** null si la campaña no tiene project_id (geophysics_surveys.project_id es nullable). */
export function geophysicsSurveyToDatasetDraft(
  survey: GeophysicsSurveyRow,
): GeoscienceDatasetDraft | null {
  if (!survey.project_id) return null;
  return {
    project_id: survey.project_id,
    dataset_type: "geophysics",
    name: survey.name,
    method: survey.method,
    source_system: survey.contractor,
    // Campaña de campo documentada por un contratista: DOCUMENTARY, no DERIVED
    // (DERIVED se reserva para productos computados, ver computeJobToDerivedDatasetDraft).
    provenance: "DOCUMENTARY",
    crs: survey.crs_epsg != null ? `EPSG:${survey.crs_epsg}` : null,
    acquisition_start: survey.acquisition_date,
    resolution: {
      stationSpacingM: survey.station_spacing_m,
      lineSpacingM: survey.line_spacing_m,
      resolutionM: survey.resolution_m,
      sensorHeightAglM: survey.sensor_height_agl_m,
    },
    created_by: survey.created_by,
    metadata: {
      surveyId: survey.id,
      instrument: survey.instrument,
      campaignId: survey.campaign_id,
      status: survey.status,
      plannedKm: survey.planned_km,
      expectedDepthM: survey.expected_depth_m,
    },
  };
}

const COMPUTE_JOB_DATASET_TYPE: Record<string, GeoscienceDatasetDraft["dataset_type"]> = {
  magnetic_inversion: "geophysics",
  gravity_inversion: "geophysics",
  ip_inversion: "geophysics",
  resistivity_inversion: "geophysics",
  em_inversion: "geophysics",
  implicit_geological_model: "model_3d",
  vein_model: "model_3d",
  mantle_model: "model_3d",
  // variography/kriging aplican tanto a geoquímica como a geofísica según la
  // variable interpolada; "geochemistry" es el default más común en minería,
  // pero el llamador puede pasar datasetType explícito si no corresponde.
  variography: "geochemistry",
  kriging: "geochemistry",
};

const COMPUTE_JOB_QA_STATUS: Record<string, GeoscienceDatasetDraft["qa_status"]> = {
  succeeded: "passed",
  failed: "failed",
};

export function computeJobToDerivedDatasetDraft(
  job: GeoscienceComputeJobRow,
  options: { name: string; datasetType?: GeoscienceDatasetDraft["dataset_type"] },
): GeoscienceDatasetDraft {
  const datasetType = options.datasetType ?? COMPUTE_JOB_DATASET_TYPE[job.job_type] ?? "model_3d";
  return {
    project_id: job.project_id,
    dataset_type: datasetType,
    name: options.name,
    method: job.engine,
    source_system: job.engine,
    source_ref: job.id,
    provenance: "DERIVED",
    qa_status: COMPUTE_JOB_QA_STATUS[job.status] ?? "unreviewed",
    acquisition_start: job.started_at,
    acquisition_end: job.completed_at,
    resolution: {},
    created_by: job.created_by,
    metadata: {
      computeJobId: job.id,
      jobType: job.job_type,
      engineVersion: job.engine_version,
      status: job.status,
      parameters: job.parameters,
      metrics: job.metrics,
    },
  };
}
