import { describe, expect, it } from "vitest";
import type { GeoscienceDataset, GeoscienceDatasetType } from "../geoscience-registry/types";
import { buildGeologicalModel3dSpec } from "./geologicalModel3d";

function dataset(
  id: string,
  datasetType: GeoscienceDatasetType,
  overrides: Partial<GeoscienceDataset> = {},
): GeoscienceDataset {
  return {
    id,
    projectId: "cholqui",
    datasetType,
    name: id,
    method: null,
    sourceSystem: "test",
    sourceRef: null,
    crs: "EPSG:32719",
    verticalDatum: null,
    geometryType: null,
    units: {},
    bboxWgs84: null,
    provenance: "DERIVED",
    qaStatus: "passed",
    qaSummary: {},
    acquisitionStart: null,
    acquisitionEnd: null,
    resolution: {},
    version: "1",
    contentHash: `hash-${id}`,
    metadata: {},
    ...overrides,
  };
}

describe("3D geological model evidence gate", () => {
  it("builds a reproducible GemPy input contract from required geological evidence", () => {
    const spec = buildGeologicalModel3dSpec({
      projectId: "cholqui",
      engine: "gempy",
      dem: dataset("dem", "dem"),
      contacts: dataset("contacts", "geology"),
      orientations: dataset("orientations", "structure"),
    });

    expect(spec.inputs.map((input) => input.role)).toEqual([
      "topography",
      "geological_contacts",
      "structural_orientations",
    ]);
    expect(spec.parameters.outputFormats).toEqual(["vtk", "omf", "json"]);
  });

  it("rejects synthetic structural orientations", () => {
    expect(() =>
      buildGeologicalModel3dSpec({
        projectId: "cholqui",
        engine: "loopstructural",
        dem: dataset("dem", "dem"),
        contacts: dataset("contacts", "geology"),
        orientations: dataset("orientations", "structure", { qaStatus: "synthetic" }),
      }),
    ).toThrow("DATASET_NOT_TECHNICAL_EVIDENCE");
  });

  it("rejects a remote-sensing product used as geological contacts", () => {
    expect(() =>
      buildGeologicalModel3dSpec({
        projectId: "cholqui",
        engine: "gempy",
        dem: dataset("dem", "dem"),
        contacts: dataset("sentinel-halo", "remote_sensing"),
        orientations: dataset("orientations", "structure"),
      }),
    ).toThrow("MODEL_3D_GEOLOGY_CONTACTS_REQUIRED");
  });

  it("requires explicit CRS through the registry gate", () => {
    expect(() =>
      buildGeologicalModel3dSpec({
        projectId: "cholqui",
        engine: "gempy",
        dem: dataset("dem", "dem", { crs: null }),
        contacts: dataset("contacts", "geology"),
        orientations: dataset("orientations", "structure"),
      }),
    ).toThrow("DATASET_CRS_REQUIRED");
  });
});
