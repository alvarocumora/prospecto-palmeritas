import { describe, expect, it } from "vitest";
import type { Database } from "@/integrations/supabase/types";
import {
  computeJobToDerivedDatasetDraft,
  geophysicsSurveyToDatasetDraft,
  satelliteRunToDatasetDraft,
} from "./registryAdapter";

type SatelliteAnalysisRunRow = Database["public"]["Tables"]["satellite_analysis_runs"]["Row"];
type GeophysicsSurveyRow = Database["public"]["Tables"]["geophysics_surveys"]["Row"];
type GeoscienceComputeJobRow = Database["public"]["Tables"]["geoscience_compute_jobs"]["Row"];

function runRow(overrides: Partial<SatelliteAnalysisRunRow> = {}): SatelliteAnalysisRunRow {
  return {
    id: "run-1",
    project_id: "proj-1",
    sensor: "Sentinel-2",
    provider: "ESA/Copernicus",
    index_code: "CLAY_MINERALS",
    aoi_geometry: { type: "Polygon", coordinates: [] },
    bbox: [-71, -34, -70, -33],
    completed_at: "2026-07-03T00:00:00Z",
    content_hash: "abc123",
    created_at: "2026-07-01T00:00:00Z",
    created_by: "user-1",
    date_from: "2026-07-01T00:00:00Z",
    date_to: "2026-07-03T00:00:00Z",
    error_message: null,
    evalscript_version: "v2",
    external_scene_id: "S2A_MSIL2A_20260703",
    last_modified_by: null,
    max_cloud_cover_pct: 5,
    output_raster_url: null,
    parameters: {},
    parent_run_id: null,
    pipeline_version: "1.0.0",
    source_metadata: {},
    started_at: "2026-07-01T00:00:00Z",
    stats: null,
    status: "succeeded",
    storage_path: null,
    updated_at: "2026-07-03T00:00:00Z",
    version: 1,
    ...overrides,
  } as SatelliteAnalysisRunRow;
}

function surveyRow(overrides: Partial<GeophysicsSurveyRow> = {}): GeophysicsSurveyRow {
  return {
    id: "survey-1",
    project_id: "proj-1",
    acquisition_date: "2026-05-01",
    campaign_id: null,
    contractor: "Geofísica Andina",
    cost_usd: null,
    created_at: "2026-05-01T00:00:00Z",
    created_by: "user-1",
    crs_epsg: 32719,
    display_order: 0,
    expected_depth_m: 200,
    instrument: "Overhauser magnetometer",
    line_spacing_m: 50,
    method: "Magnetometría terrestre",
    name: "Campaña mag 2026",
    notes: null,
    planned_km: 12,
    resolution_m: 5,
    sensor_height_agl_m: null,
    station_spacing_m: 25,
    status: "completed",
    updated_at: "2026-05-01T00:00:00Z",
    ...overrides,
  } as GeophysicsSurveyRow;
}

function computeJobRow(overrides: Partial<GeoscienceComputeJobRow> = {}): GeoscienceComputeJobRow {
  return {
    id: "job-1",
    project_id: "proj-1",
    completed_at: "2026-07-05T00:00:00Z",
    created_at: "2026-07-04T00:00:00Z",
    created_by: "user-1",
    engine: "simpeg",
    engine_version: "0.20",
    error: null,
    inputs: [],
    job_type: "magnetic_inversion",
    metrics: {},
    outputs: [],
    parameters: {},
    started_at: "2026-07-04T00:00:00Z",
    status: "succeeded",
    updated_at: "2026-07-05T00:00:00Z",
    ...overrides,
  } as GeoscienceComputeJobRow;
}

describe("satelliteRunToDatasetDraft", () => {
  it("mapea a dataset_type remote_sensing con provenance DERIVED", () => {
    const draft = satelliteRunToDatasetDraft(runRow());
    expect(draft.dataset_type).toBe("remote_sensing");
    expect(draft.provenance).toBe("DERIVED");
    expect(draft.project_id).toBe("proj-1");
  });

  it("preserva content_hash y fechas de adquisición", () => {
    const draft = satelliteRunToDatasetDraft(runRow({ content_hash: "hash-xyz" }));
    expect(draft.content_hash).toBe("hash-xyz");
    expect(draft.acquisition_start).toBe("2026-07-01T00:00:00Z");
    expect(draft.acquisition_end).toBe("2026-07-03T00:00:00Z");
  });

  it("no inventa CRS cuando el run no lo tiene", () => {
    expect(satelliteRunToDatasetDraft(runRow()).crs).toBeNull();
  });
});

describe("geophysicsSurveyToDatasetDraft", () => {
  it("mapea a dataset_type geophysics con provenance DOCUMENTARY", () => {
    const draft = geophysicsSurveyToDatasetDraft(surveyRow());
    expect(draft?.dataset_type).toBe("geophysics");
    expect(draft?.provenance).toBe("DOCUMENTARY");
  });

  it("deriva el CRS desde crs_epsg", () => {
    const draft = geophysicsSurveyToDatasetDraft(surveyRow({ crs_epsg: 32719 }));
    expect(draft?.crs).toBe("EPSG:32719");
  });

  it("retorna null si la campaña no tiene project_id (no fabrica un proyecto)", () => {
    const draft = geophysicsSurveyToDatasetDraft(surveyRow({ project_id: null }));
    expect(draft).toBeNull();
  });
});

describe("computeJobToDerivedDatasetDraft", () => {
  it("mapea magnetic_inversion a geophysics por defecto", () => {
    const draft = computeJobToDerivedDatasetDraft(computeJobRow(), { name: "Inversión mag A" });
    expect(draft.dataset_type).toBe("geophysics");
    expect(draft.provenance).toBe("DERIVED");
  });

  it("mapea implicit_geological_model a model_3d por defecto", () => {
    const draft = computeJobToDerivedDatasetDraft(
      computeJobRow({ job_type: "implicit_geological_model" }),
      { name: "Modelo implícito A" },
    );
    expect(draft.dataset_type).toBe("model_3d");
  });

  it("respeta datasetType explícito por sobre el default", () => {
    const draft = computeJobToDerivedDatasetDraft(computeJobRow(), {
      name: "override",
      datasetType: "block_model",
    });
    expect(draft.dataset_type).toBe("block_model");
  });

  it("mapea status succeeded/failed a qa_status", () => {
    const ok = computeJobToDerivedDatasetDraft(computeJobRow({ status: "succeeded" }), {
      name: "ok",
    });
    const bad = computeJobToDerivedDatasetDraft(computeJobRow({ status: "failed" }), {
      name: "bad",
    });
    expect(ok.qa_status).toBe("passed");
    expect(bad.qa_status).toBe("failed");
  });
});
