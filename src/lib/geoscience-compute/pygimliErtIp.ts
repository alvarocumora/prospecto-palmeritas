import {
  assertDatasetReadyForInterpretation,
  type GeoscienceDataset,
} from "../geoscience-registry/types";
import { buildDatasetInputRef, type GeoscienceDatasetInputRef } from "./types";

export type PygimliErtIpMode = "ert" | "tdip";

export type PygimliErtIpSpec = {
  projectId: string;
  engine: "pygimli";
  jobType: "resistivity_inversion" | "ip_inversion";
  inputs: GeoscienceDatasetInputRef[];
  parameters: {
    mode: PygimliErtIpMode;
    relativeError: number;
    absoluteError: number | null;
    lambda: number;
    zWeight: number;
    robustData: boolean;
    blockyModel: boolean;
  };
};

const REQUIRED_ELECTRODE_COLUMNS = ["a", "b", "m", "n"] as const;

/**
 * Builds a pyGIMLi ERT/TDIP inversion contract from a registered FIELD dataset.
 *
 * Gridded/interpolated map surfaces are intentionally insufficient: inversion
 * requires the electrode-array observations so the forward operator can be
 * reconstructed.
 */
export function buildPygimliErtIpSpec(args: {
  projectId: string;
  dataset: GeoscienceDataset;
  mode: PygimliErtIpMode;
  relativeError?: number;
  absoluteError?: number | null;
  lambda?: number;
  zWeight?: number;
  robustData?: boolean;
  blockyModel?: boolean;
}): PygimliErtIpSpec {
  const { dataset } = args;
  assertDatasetReadyForInterpretation(dataset);

  if (dataset.projectId !== args.projectId) {
    throw new Error(`PYGIMLI_PROJECT_MISMATCH:${dataset.id}`);
  }
  if (dataset.datasetType !== "geophysics") {
    throw new Error(`PYGIMLI_GEOPHYSICS_DATASET_REQUIRED:${dataset.id}`);
  }

  const columns = Array.isArray(dataset.metadata.dataColumns)
    ? dataset.metadata.dataColumns.map(String)
    : [];
  for (const column of REQUIRED_ELECTRODE_COLUMNS) {
    if (!columns.includes(column)) {
      throw new Error(`PYGIMLI_ELECTRODE_COLUMN_REQUIRED:${dataset.id}:${column}`);
    }
  }

  const measurementColumn = args.mode === "ert" ? "rhoa" : "ip";
  if (!columns.includes(measurementColumn)) {
    throw new Error(
      `PYGIMLI_MEASUREMENT_COLUMN_REQUIRED:${dataset.id}:${measurementColumn}`,
    );
  }

  const relativeError = args.relativeError ?? 0.03;
  if (!(relativeError > 0 && relativeError < 1)) {
    throw new Error("PYGIMLI_RELATIVE_ERROR_OUT_OF_RANGE");
  }

  return {
    projectId: args.projectId,
    engine: "pygimli",
    jobType: args.mode === "ert" ? "resistivity_inversion" : "ip_inversion",
    inputs: [buildDatasetInputRef(dataset, "electrode_array_observations")],
    parameters: {
      mode: args.mode,
      relativeError,
      absoluteError: args.absoluteError ?? null,
      lambda: args.lambda ?? 20,
      zWeight: args.zWeight ?? 0.2,
      robustData: args.robustData ?? false,
      blockyModel: args.blockyModel ?? false,
    },
  };
}
