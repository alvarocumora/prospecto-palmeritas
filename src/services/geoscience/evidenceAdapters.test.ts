import { describe, expect, it } from "vitest";
import type { Database } from "@/integrations/supabase/types";
import {
  fromGeophysicsAnomaly,
  fromSatelliteAnomaly,
  fromSatelliteEvidence,
} from "./evidenceAdapters";

type SatelliteEvidenceRow = Database["public"]["Tables"]["satellite_evidence"]["Row"];
type SatelliteAnomalyRow = Database["public"]["Tables"]["satellite_anomalies"]["Row"];
type GeophysicsAnomalyRow = Database["public"]["Tables"]["geophysics_anomalies"]["Row"];

function satelliteEvidenceRow(overrides: Partial<SatelliteEvidenceRow> = {}): SatelliteEvidenceRow {
  return {
    id: "se-1",
    project_id: "proj-1",
    anomaly_id: null,
    bbox: [0, 0, 1, 1],
    confidence_score: 0.7,
    created_at: "2026-07-01T00:00:00Z",
    created_by: "user-1",
    disclaimer: "",
    exploration_target_id: "target-1",
    geometry: { type: "Point", coordinates: [-71, -33] },
    index_code: "CLAY_MINERALS",
    interpretation_md: null,
    kind: "spectral",
    layer_id: null,
    qp_validation_status: "unverified",
    run_id: "run-1",
    source: { provider: "ESA/Copernicus", ref: "S2A_xyz" },
    storage_path: "s3://bucket/key",
    target_id: null,
    title: "Anomalía Al-OH",
    updated_at: "2026-07-01T00:00:00Z",
    validated_at: null,
    validated_by_qp_id: null,
    validation: null,
    ...overrides,
  } as SatelliteEvidenceRow;
}

function satelliteAnomalyRow(overrides: Partial<SatelliteAnomalyRow> = {}): SatelliteAnomalyRow {
  return {
    id: "sa-1",
    project_id: "proj-1",
    area_ha: 1.2,
    bbox: [0, 0, 1, 1],
    confidence: 0.8,
    created_at: "2026-07-01T00:00:00Z",
    created_by: "user-1",
    detected_at: "2026-07-01T00:00:00Z",
    feature_values: {},
    geometry: { type: "Polygon", coordinates: [[[0, 0]]] },
    index_code: "IRON_OXIDE",
    method: "band_ratio",
    method_version: "v1",
    notes: "z=5.3",
    processing_parameters: {},
    raster_asset_id: "raster-1",
    run_id: "run-1",
    scene_id: "scene-1",
    score: 0.65,
    sensor: "Sentinel-2",
    severity: "alta",
    source_id: "source-1",
    strength: 0.9,
    target_id: "target-1",
    updated_at: "2026-07-01T00:00:00Z",
    ...overrides,
  } as SatelliteAnomalyRow;
}

function geophysicsAnomalyRow(overrides: Partial<GeophysicsAnomalyRow> = {}): GeophysicsAnomalyRow {
  return {
    id: "ga-1",
    project_id: "proj-1",
    anomaly_type: "magnetic_high",
    code: "GA-01",
    confidence_pct: 80,
    created_at: "2026-07-01T00:00:00Z",
    created_by: "user-1",
    dismissed_reason: null,
    estimated_area_m2: 5000,
    estimated_depth_m: 120,
    evidence: null,
    lat: -33.85,
    lng: -71.04,
    notes: "anomalía residual",
    peak_unit: "nT",
    peak_value: 350,
    promoted_at: null,
    rationale: null,
    reviewed_at: null,
    reviewed_by: null,
    severity: "media",
    station_id: null,
    status: "open",
    survey_id: "survey-1",
    target_id: "target-1",
    updated_at: "2026-07-01T00:00:00Z",
    validated_at: null,
    validated_by: null,
    ...overrides,
  } as GeophysicsAnomalyRow;
}

describe("fromSatelliteEvidence", () => {
  it("usa exploration_target_id como targetId canónico, nunca el legacy target_id", () => {
    const row = satelliteEvidenceRow({
      exploration_target_id: "canonical-target",
      target_id: "legacy-satellite-target",
    });
    const evidence = fromSatelliteEvidence(row);
    expect(evidence.targetId).toBe("canonical-target");
  });

  it("targetId es null cuando solo existe el vínculo legacy (no se inventa)", () => {
    const row = satelliteEvidenceRow({ exploration_target_id: null, target_id: "legacy-only" });
    const evidence = fromSatelliteEvidence(row);
    expect(evidence.targetId).toBeNull();
  });

  it("preserva project/source/geometry sin mutarlos", () => {
    const row = satelliteEvidenceRow();
    const evidence = fromSatelliteEvidence(row);
    expect(evidence.projectId).toBe(row.project_id);
    expect(evidence.source).toEqual({ table: "satellite_evidence", recordId: row.id });
    expect(evidence.geometry).toEqual(row.geometry);
  });

  it("provenance ausente se expone como null, no se inventa", () => {
    const row = satelliteEvidenceRow({ source: {} });
    const evidence = fromSatelliteEvidence(row);
    expect(evidence.provenance.provider).toBeNull();
    expect(evidence.provenance.contentHash).toBeNull();
  });

  it("es determinista", () => {
    const row = satelliteEvidenceRow();
    expect(fromSatelliteEvidence(row)).toEqual(fromSatelliteEvidence(row));
  });
});

describe("fromSatelliteAnomaly", () => {
  it("preserva strength y confidence por separado (no son lo mismo)", () => {
    const row = satelliteAnomalyRow({ strength: 0.9, confidence: 0.4 });
    const evidence = fromSatelliteAnomaly(row);
    expect(evidence.strength).toBe(0.9);
    expect(evidence.confidence).toBe(0.4);
    expect(evidence.strength).not.toBe(evidence.confidence);
  });

  it("target_id apunta directo a exploration_targets (columna canónica de esta tabla)", () => {
    const row = satelliteAnomalyRow({ target_id: "target-xyz" });
    expect(fromSatelliteAnomaly(row).targetId).toBe("target-xyz");
  });

  it("score se preserva sin mezclarse con strength/confidence", () => {
    const row = satelliteAnomalyRow({ score: 0.65, strength: 0.9, confidence: 0.4 });
    const evidence = fromSatelliteAnomaly(row);
    expect(evidence.score).toBe(0.65);
  });
});

describe("fromGeophysicsAnomaly", () => {
  it("target_id apunta directo a exploration_targets", () => {
    const row = geophysicsAnomalyRow({ target_id: "target-xyz" });
    expect(fromGeophysicsAnomaly(row).targetId).toBe("target-xyz");
  });

  it("targetId null cuando la anomalía aún no está vinculada", () => {
    const row = geophysicsAnomalyRow({ target_id: null });
    expect(fromGeophysicsAnomaly(row).targetId).toBeNull();
  });

  it("construye geometry Point desde lat/lng cuando no hay geometry propia", () => {
    const row = geophysicsAnomalyRow({ lat: -33.5, lng: -70.5 });
    const evidence = fromGeophysicsAnomaly(row);
    expect(evidence.geometry).toEqual({ type: "Point", coordinates: [-70.5, -33.5] });
  });

  it("geometry es null si falta lat o lng (no se inventa una coordenada)", () => {
    const row = geophysicsAnomalyRow({ lat: null, lng: null });
    expect(fromGeophysicsAnomaly(row).geometry).toBeNull();
  });

  it("normaliza confidence_pct (0..100) a confidence (0..1)", () => {
    const row = geophysicsAnomalyRow({ confidence_pct: 80 });
    expect(fromGeophysicsAnomaly(row).confidence).toBeCloseTo(0.8);
  });
});
