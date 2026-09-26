import type { ProjectSpatialContext } from "@/lib/spatial/projectSpatialContext";

export type RemoteSensingRequest = {
  context: ProjectSpatialContext;
  from: string;
  to: string;
  maxCloudPct?: number;
  sensors?: Array<"sentinel-2-l2a" | "landsat-c2-l2">;
};
export type RemoteSensingScene = {
  id: string;
  sensor: string;
  datetime: string;
  cloudPct: number | null;
  sourceUrl: string | null;
};
export type SpectralObservation = {
  id: string;
  sceneId: string;
  geometry: GeoJSON.Geometry;
  metric: string;
  value: number;
  provenance: "DERIVED";
};
export type RemoteSensingResult = {
  projectId: string;
  bboxWgs84: [number, number, number, number];
  scenes: RemoteSensingScene[];
  observations: SpectralObservation[];
  generatedAt: string;
};

export type AnomalyCandidate = {
  id: string;
  projectId: string;
  geometry: GeoJSON.Geometry;
  signals: Array<{ metric: string; value: number; sceneId: string }>;
  confidence: "low" | "medium" | "high";
  provenance: "DERIVED";
  interpretation: string | null;
};

export type EvidenceLink = {
  anomalyId: string;
  evidenceId: string;
  evidenceType: "cadastre" | "geology" | "sample" | "assay" | "structure" | "document";
  distanceM: number | null;
  provenance: string;
};

export type TechnicalFinding = {
  anomaly: AnomalyCandidate;
  evidence: EvidenceLink[];
  conclusion: string;
  limitations: string[];
};

// Satellite response is evidence screening, not proof of mineralization.
export function assertInterpretationBoundary(result: RemoteSensingResult): RemoteSensingResult {
  return result;
}
