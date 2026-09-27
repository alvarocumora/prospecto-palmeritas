import {
  assertDatasetReadyForInterpretation,
  type GeoscienceDataset,
} from "../geoscience-registry/types";
import { buildDatasetInputRef, type GeoscienceDatasetInputRef } from "./types";

export type GeologicalModelEngine = "gempy" | "loopstructural";

export type GeologicalModel3dSpec = {
  projectId: string;
  engine: GeologicalModelEngine;
  inputs: GeoscienceDatasetInputRef[];
  parameters: {
    extent?: [number, number, number, number, number, number];
    resolution?: [number, number, number];
    outputFormats: Array<"vtk" | "omf" | "json">;
    uncertaintyMode: "none" | "ensemble";
  };
};

/**
 * Hard evidence gate for implicit 3D geology.
 *
 * A satellite anomaly or geophysical inversion alone is insufficient. A model
 * needs topography plus geological contacts and structural orientations.
 * Optional drillholes and geophysical models may constrain the interpretation.
 */
export function buildGeologicalModel3dSpec(args: {
  projectId: string;
  engine: GeologicalModelEngine;
  dem: GeoscienceDataset;
  contacts: GeoscienceDataset;
  orientations: GeoscienceDataset;
  drillholes?: GeoscienceDataset | null;
  geophysicsModels?: GeoscienceDataset[];
  extent?: GeologicalModel3dSpec["parameters"]["extent"];
  resolution?: GeologicalModel3dSpec["parameters"]["resolution"];
  outputFormats?: GeologicalModel3dSpec["parameters"]["outputFormats"];
  uncertaintyMode?: GeologicalModel3dSpec["parameters"]["uncertaintyMode"];
}): GeologicalModel3dSpec {
  const required = [
    ["topography", args.dem],
    ["geological_contacts", args.contacts],
    ["structural_orientations", args.orientations],
  ] as const;

  for (const [role, dataset] of required) {
    assertDatasetReadyForInterpretation(dataset);
    if (dataset.projectId !== args.projectId) {
      throw new Error(`MODEL_3D_PROJECT_MISMATCH:${role}:${dataset.id}`);
    }
  }

  if (args.dem.datasetType !== "dem") {
    throw new Error(`MODEL_3D_DEM_REQUIRED:${args.dem.id}`);
  }
  if (args.contacts.datasetType !== "geology") {
    throw new Error(`MODEL_3D_GEOLOGY_CONTACTS_REQUIRED:${args.contacts.id}`);
  }
  if (!["structure", "geology"].includes(args.orientations.datasetType)) {
    throw new Error(`MODEL_3D_ORIENTATIONS_REQUIRED:${args.orientations.id}`);
  }

  const optional: Array<[string, GeoscienceDataset]> = [];
  if (args.drillholes) optional.push(["drillholes", args.drillholes]);
  for (const model of args.geophysicsModels ?? []) optional.push(["geophysics_constraint", model]);

  for (const [role, dataset] of optional) {
    assertDatasetReadyForInterpretation(dataset);
    if (dataset.projectId !== args.projectId) {
      throw new Error(`MODEL_3D_PROJECT_MISMATCH:${role}:${dataset.id}`);
    }
  }

  if (args.drillholes && args.drillholes.datasetType !== "drilling") {
    throw new Error(`MODEL_3D_DRILLING_TYPE_REQUIRED:${args.drillholes.id}`);
  }
  for (const model of args.geophysicsModels ?? []) {
    if (!["geophysics", "model_3d"].includes(model.datasetType)) {
      throw new Error(`MODEL_3D_GEOPHYSICS_CONSTRAINT_TYPE_REQUIRED:${model.id}`);
    }
  }

  const inputs: GeoscienceDatasetInputRef[] = [
    ...required.map(([role, dataset]) => buildDatasetInputRef(dataset, role)),
    ...optional.map(([role, dataset]) => buildDatasetInputRef(dataset, role)),
  ];

  return {
    projectId: args.projectId,
    engine: args.engine,
    inputs,
    parameters: {
      extent: args.extent,
      resolution: args.resolution,
      outputFormats: args.outputFormats ?? ["vtk", "omf", "json"],
      uncertaintyMode: args.uncertaintyMode ?? "none",
    },
  };
}
