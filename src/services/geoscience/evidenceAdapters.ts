import type { Geometry } from "geojson";
import type { Database } from "@/integrations/supabase/types";
import type { ProjectEvidence } from "@/types/projectEvidence";

/**
 * Adapters puros (sin I/O) que normalizan filas de las tablas de dominio a
 * ProjectEvidence. Cada uno recibe la Row tal como la devuelve Supabase —
 * nunca hacen fetch ni mutan la fila de entrada.
 *
 * Regla crítica: el target vinculado es SIEMPRE exploration_targets.id.
 * satellite_evidence.target_id (legacy, -> satellite_targets) NUNCA se usa
 * acá — solo exploration_target_id.
 */

type SatelliteEvidenceRow = Database["public"]["Tables"]["satellite_evidence"]["Row"];
type SatelliteAnomalyRow = Database["public"]["Tables"]["satellite_anomalies"]["Row"];
type GeophysicsAnomalyRow = Database["public"]["Tables"]["geophysics_anomalies"]["Row"];

function asGeometry(value: unknown): Geometry | null {
  if (!value || typeof value !== "object") return null;
  return value as Geometry;
}

function clampUnit(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  return Math.min(1, Math.max(0, value));
}

export function fromSatelliteEvidence(row: SatelliteEvidenceRow): ProjectEvidence {
  const source = (row.source ?? {}) as Record<string, unknown>;
  return {
    id: row.id,
    projectId: row.project_id,
    modality: "satellite",
    evidenceType: row.kind,
    source: { table: "satellite_evidence", recordId: row.id },
    datasetId: null,
    computeJobId: null,
    // Nunca row.target_id (legacy -> satellite_targets).
    targetId: row.exploration_target_id,
    geometry: asGeometry(row.geometry),
    strength: null,
    confidence: clampUnit(row.confidence_score),
    score: null,
    provenance: {
      classification: "DERIVED",
      sourceId: null,
      provider: typeof source.provider === "string" ? source.provider : null,
      sourceRef: typeof source.ref === "string" ? source.ref : null,
      sensorOrMethod: row.index_code,
      sceneOrSurveyId: row.run_id,
      method: row.index_code,
      methodVersion: null,
      pipelineVersion: null,
      contentHash: null,
      storagePath: row.storage_path,
      acquiredAt: null,
      derivedAt: row.created_at,
      crs: null,
      resolution: null,
    },
    validationStatus: row.qp_validation_status === "validated" ? "validated" : "unverified",
    metadata: { title: row.title, layerId: row.layer_id, anomalyId: row.anomaly_id },
  };
}

export function fromSatelliteAnomaly(row: SatelliteAnomalyRow): ProjectEvidence {
  return {
    id: row.id,
    projectId: row.project_id,
    modality: "satellite",
    evidenceType: row.index_code,
    source: { table: "satellite_anomalies", recordId: row.id },
    datasetId: null,
    computeJobId: null,
    targetId: row.target_id,
    geometry: asGeometry(row.geometry),
    strength: clampUnit(row.strength),
    confidence: clampUnit(row.confidence),
    score: row.score,
    provenance: {
      classification: "DERIVED",
      sourceId: row.source_id,
      provider: null,
      sourceRef: row.scene_id,
      sensorOrMethod: row.sensor,
      sceneOrSurveyId: row.scene_id,
      method: row.method,
      methodVersion: row.method_version,
      pipelineVersion: null,
      contentHash: null,
      storagePath: row.raster_asset_id,
      acquiredAt: row.detected_at,
      derivedAt: row.created_at,
      crs: null,
      resolution: null,
    },
    validationStatus: "unverified",
    metadata: {
      severity: row.severity,
      notes: row.notes,
      areaHa: row.area_ha,
      runId: row.run_id,
    },
  };
}

export function fromGeophysicsAnomaly(row: GeophysicsAnomalyRow): ProjectEvidence {
  const geometry: Geometry | null =
    row.lat != null && row.lng != null ? { type: "Point", coordinates: [row.lng, row.lat] } : null;
  return {
    id: row.id,
    projectId: row.project_id,
    modality: "magnetic",
    evidenceType: row.anomaly_type,
    source: { table: "geophysics_anomalies", recordId: row.id },
    datasetId: null,
    computeJobId: null,
    targetId: row.target_id,
    geometry,
    strength: row.peak_value,
    confidence: clampUnit(row.confidence_pct != null ? row.confidence_pct / 100 : null),
    score: null,
    provenance: {
      classification: "DERIVED",
      sourceId: null,
      provider: null,
      sourceRef: row.survey_id,
      sensorOrMethod: row.anomaly_type,
      sceneOrSurveyId: row.survey_id,
      method: null,
      methodVersion: null,
      pipelineVersion: null,
      contentHash: null,
      storagePath: null,
      acquiredAt: null,
      derivedAt: row.created_at,
      crs: null,
      resolution: null,
    },
    validationStatus: row.validated_at ? "validated" : "unverified",
    metadata: {
      code: row.code,
      severity: row.severity,
      status: row.status,
      peakUnit: row.peak_unit,
      estimatedAreaM2: row.estimated_area_m2,
      estimatedDepthM: row.estimated_depth_m,
      notes: row.notes,
    },
  };
}
