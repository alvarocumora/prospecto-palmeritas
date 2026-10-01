import type { Geometry } from "geojson";

/**
 * Contrato de aplicación (NO una tabla) que normaliza filas de las tablas de
 * dominio (satellite_evidence, satellite_anomalies, geophysics_anomalies, …)
 * a una forma única para UI, scoring y target intelligence. Las tablas de
 * dominio conservan su riqueza científica; esto es solo la vista común.
 *
 * targetId, cuando existe, es SIEMPRE exploration_targets.id — nunca
 * satellite_targets.id (legacy). Ver docs/geoscience-evidence-foundation.md.
 */

export type EvidenceModality =
  | "satellite"
  | "magnetic"
  | "gravity"
  | "ip"
  | "resistivity"
  | "em"
  | "geochemistry"
  | "geology"
  | "structure"
  | "assay";

/**
 * Mismos valores que el CHECK de provenance en geoscience_datasets y
 * mining_asset_nodes/edges (en inglés, en la base) — no confundir con el
 * vocabulario en español de `Evidence`/`EvidenceBadge` (@/components/ui-system),
 * que es puramente de presentación y no corresponde 1:1 con estas columnas.
 */
export type EvidenceProvenance =
  "OFFICIAL" | "CERTIFIED" | "DOCUMENTARY" | "DECLARED" | "DERIVED" | "INTERPRETED";

export type EvidenceValidationStatus =
  "unverified" | "source_verified" | "technically_reviewed" | "validated";

export type EvidenceSourceTable =
  "satellite_evidence" | "satellite_anomalies" | "geophysics_anomalies";

export interface ProjectEvidenceProvenance {
  classification: EvidenceProvenance;

  sourceId: string | null;
  provider: string | null;
  sourceRef: string | null;

  sensorOrMethod: string | null;
  sceneOrSurveyId: string | null;

  method: string | null;
  methodVersion: string | null;
  pipelineVersion: string | null;

  contentHash: string | null;
  storagePath: string | null;

  acquiredAt: string | null;
  derivedAt: string | null;

  crs: string | null;
  resolution: Record<string, unknown> | null;
}

export interface ProjectEvidence {
  id: string;

  projectId: string;

  modality: EvidenceModality;
  evidenceType: string;

  source: {
    table: EvidenceSourceTable;
    recordId: string;
  };

  /** geoscience_datasets.id cuando el dato de origen ya está registrado ahí. */
  datasetId: string | null;
  /** geoscience_compute_jobs.id cuando la evidencia es producto de un cómputo. */
  computeJobId: string | null;

  /** Siempre exploration_targets.id; null si aún no está vinculada a un target. */
  targetId: string | null;

  geometry: Geometry | null;

  /**
   * strength: cuán anómalo es el fenómeno (0..1). confidence: cuánta
   * confianza hay en la observación/procesamiento (0..1). score: puntaje de
   * negocio si ya fue calculado. Los tres son ejes distintos — nunca
   * mezclarlos entre sí.
   */
  strength: number | null;
  confidence: number | null;
  score: number | null;

  provenance: ProjectEvidenceProvenance;

  validationStatus: EvidenceValidationStatus;
  metadata: Record<string, unknown>;
}
