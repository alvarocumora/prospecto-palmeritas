import {
  assertDatasetReadyForInterpretation,
  type GeoscienceDataset,
} from "../geoscience-registry/types";

export type GeoscienceComputeEngine =
  "simpeg" | "gempy" | "loopstructural" | "pygimli" | "gstools" | "custom";

export type GeoscienceComputeJobType =
  | "magnetic_inversion"
  | "gravity_inversion"
  | "ip_inversion"
  | "resistivity_inversion"
  | "em_inversion"
  | "implicit_geological_model"
  | "vein_model"
  | "mantle_model"
  | "variography"
  | "kriging";

export type GeoscienceComputeJobStatus =
  "draft" | "queued" | "running" | "succeeded" | "failed" | "cancelled";

export type GeoscienceDatasetInputRef = {
  datasetId: string;
  datasetVersion: string;
  contentHash: string | null;
  role: string;
};

export type GeoscienceComputeOutput = {
  datasetId: string | null;
  datasetType: "model_3d" | "block_model" | "geophysics" | "geology" | "structure";
  role: string;
  uri: string | null;
  contentHash: string | null;
  metadata: Record<string, unknown>;
};

export type GeoscienceComputeMetrics = {
  objectiveFunction?: number | null;
  dataMisfit?: number | null;
  modelNorm?: number | null;
  iterations?: number | null;
  converged?: boolean | null;
  runtimeSeconds?: number | null;
  [key: string]: number | boolean | string | null | undefined;
};

export type GeoscienceComputeJob = {
  id: string;
  projectId: string;
  jobType: GeoscienceComputeJobType;
  engine: GeoscienceComputeEngine;
  engineVersion: string | null;
  status: GeoscienceComputeJobStatus;
  inputs: GeoscienceDatasetInputRef[];
  parameters: Record<string, unknown>;
  outputs: GeoscienceComputeOutput[];
  metrics: GeoscienceComputeMetrics;
  startedAt: string | null;
  completedAt: string | null;
  error: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export function buildDatasetInputRef(
  dataset: GeoscienceDataset,
  role: string,
): GeoscienceDatasetInputRef {
  assertDatasetReadyForInterpretation(dataset);
  return {
    datasetId: dataset.id,
    datasetVersion: dataset.version,
    contentHash: dataset.contentHash,
    role,
  };
}

export function assertComputeInputsReady(
  datasets: GeoscienceDataset[],
  inputs: GeoscienceDatasetInputRef[],
): void {
  const byId = new Map(datasets.map((dataset) => [dataset.id, dataset]));
  for (const input of inputs) {
    const dataset = byId.get(input.datasetId);
    if (!dataset) throw new Error(`COMPUTE_INPUT_DATASET_NOT_FOUND:${input.datasetId}`);
    assertDatasetReadyForInterpretation(dataset);
    if (dataset.version !== input.datasetVersion) {
      throw new Error(
        `COMPUTE_INPUT_VERSION_MISMATCH:${input.datasetId}:${input.datasetVersion}:${dataset.version}`,
      );
    }
    if (input.contentHash && dataset.contentHash && input.contentHash !== dataset.contentHash) {
      throw new Error(`COMPUTE_INPUT_HASH_MISMATCH:${input.datasetId}`);
    }
  }
}

export function computeJobRunKey(
  job: Pick<GeoscienceComputeJob, "jobType" | "engine" | "engineVersion" | "inputs" | "parameters">,
): string {
  const normalizedInputs = [...job.inputs]
    .sort((a, b) => `${a.role}:${a.datasetId}`.localeCompare(`${b.role}:${b.datasetId}`))
    .map((input) => ({
      datasetId: input.datasetId,
      datasetVersion: input.datasetVersion,
      contentHash: input.contentHash,
      role: input.role,
    }));

  return JSON.stringify({
    jobType: job.jobType,
    engine: job.engine,
    engineVersion: job.engineVersion,
    inputs: normalizedInputs,
    parameters: job.parameters,
  });
}
