import { describe, expect, it } from "vitest";
import type { GeoscienceDataset } from "../geoscience-registry/types";
import { buildPygimliErtIpSpec } from "./pygimliErtIp";

function dataset(columns: string[]): GeoscienceDataset {
  return {
    id: "ert-field-1",
    projectId: "cholqui",
    datasetType: "geophysics",
    name: "ERT field array",
    method: "ERT/IP",
    sourceSystem: "field",
    sourceRef: null,
    crs: "EPSG:32719",
    verticalDatum: null,
    geometryType: "Point",
    units: { rhoa: "ohm m", ip: "mV/V" },
    bboxWgs84: null,
    provenance: "DOCUMENTARY",
    qaStatus: "passed",
    qaSummary: {},
    acquisitionStart: null,
    acquisitionEnd: null,
    resolution: {},
    version: "1",
    contentHash: "ert-hash",
    metadata: { dataColumns: columns },
  };
}

describe("pyGIMLi ERT/IP contract", () => {
  it("accepts raw ERT electrode observations", () => {
    const spec = buildPygimliErtIpSpec({
      projectId: "cholqui",
      dataset: dataset(["a", "b", "m", "n", "rhoa"]),
      mode: "ert",
    });

    expect(spec.engine).toBe("pygimli");
    expect(spec.jobType).toBe("resistivity_inversion");
    expect(spec.inputs[0].role).toBe("electrode_array_observations");
  });

  it("requires raw electrode geometry instead of an interpolated surface", () => {
    expect(() =>
      buildPygimliErtIpSpec({
        projectId: "cholqui",
        dataset: dataset(["lat", "lng", "rhoa"]),
        mode: "ert",
      }),
    ).toThrow("PYGIMLI_ELECTRODE_COLUMN_REQUIRED");
  });

  it("requires chargeability for TDIP", () => {
    expect(() =>
      buildPygimliErtIpSpec({
        projectId: "cholqui",
        dataset: dataset(["a", "b", "m", "n", "rhoa"]),
        mode: "tdip",
      }),
    ).toThrow("PYGIMLI_MEASUREMENT_COLUMN_REQUIRED");
  });

  it("rejects synthetic datasets through the registry evidence gate", () => {
    const synthetic = dataset(["a", "b", "m", "n", "ip"]);
    synthetic.qaStatus = "synthetic";

    expect(() =>
      buildPygimliErtIpSpec({
        projectId: "cholqui",
        dataset: synthetic,
        mode: "tdip",
      }),
    ).toThrow("DATASET_NOT_TECHNICAL_EVIDENCE");
  });
});
