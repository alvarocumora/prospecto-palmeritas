import type { MiningProvenance } from "@/lib/mining-asset-graph/types";

export type GeoscienceDatasetType =
  | "geophysics"
  | "geochemistry"
  | "drilling"
  | "dem"
  | "remote_sensing"
  | "geology"
  | "structure"
  | "assay"
  | "model_3d"
  | "block_model";

export type GeoscienceQaStatus = "unreviewed" | "passed" | "warning" | "failed" | "synthetic";

export type GeoscienceDataset = {
  id: string;
  projectId: string;
  datasetType: GeoscienceDatasetType;
  name: string;
  method: string | null;
  sourceSystem: string | null;
  sourceRef: string | null;
  crs: string | null;
  verticalDatum: string | null;
  geometryType: string | null;
  units: Record<string, string>;
  bboxWgs84: [number, number, number, number] | null;
  provenance: MiningProvenance;
  qaStatus: GeoscienceQaStatus;
  qaSummary: Record<string, unknown>;
  acquisitionStart: string | null;
  acquisitionEnd: string | null;
  resolution: Record<string, number | string>;
  version: string;
  contentHash: string | null;
  metadata: Record<string, unknown>;
};

export type DatasetRegistration = Omit<GeoscienceDataset, "id"> & { id?: string };

export function isTechnicalEvidence(dataset: GeoscienceDataset): boolean {
  return dataset.qaStatus !== "synthetic" && dataset.qaStatus !== "failed";
}

export function assertDatasetReadyForInterpretation(dataset: GeoscienceDataset): void {
  if (!isTechnicalEvidence(dataset)) {
    throw new Error(`DATASET_NOT_TECHNICAL_EVIDENCE:${dataset.id}:${dataset.qaStatus}`);
  }
  if (!dataset.crs && ["geophysics", "drilling", "dem", "geology", "structure"].includes(dataset.datasetType)) {
    throw new Error(`DATASET_CRS_REQUIRED:${dataset.id}`);
  }
}
