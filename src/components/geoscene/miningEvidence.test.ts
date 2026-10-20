import { describe, expect, it } from "vitest";
import type { GeoSceneProjectLayer } from "./projectLayers";
import { filterMiningEvidence, projectMiningEvidence } from "./miningEvidence";

const collection = (codes: string[]) =>
  ({
    type: "FeatureCollection" as const,
    features: codes.map((code) => ({
      type: "Feature" as const,
      properties: { code },
      geometry: { type: "Point" as const, coordinates: [-71.2, -33.6] },
    })),
  }) satisfies GeoSceneProjectLayer["data"];

describe("mining evidence inventory", () => {
  it("derives provenance and counts from real supplied project layers", () => {
    const layers: GeoSceneProjectLayer[] = [
      {
        id: "territory.cadastre",
        data: collection(["ROL-1", "ROL-2"]),
        source: "Registro público del proyecto",
      },
      {
        id: "remote_sensing.sentinel2_alteration",
        data: collection(["index-1"]),
        defaultVisible: false,
      },
    ];
    const result = projectMiningEvidence(layers);
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      evidence: "OFICIAL",
      featureCount: 2,
      source: "Registro público del proyecto",
      examples: ["ROL-1", "ROL-2"],
    });
    expect(result[1]).toMatchObject({
      evidence: "DERIVADO",
      featureCount: 1,
      visibleByDefault: false,
    });
    expect(result[1].caution).toContain("ground-truth");
  });

  it("never invents features when no layers have been supplied", () => {
    expect(projectMiningEvidence(undefined)).toEqual([]);
    expect(projectMiningEvidence([])).toEqual([]);
  });

  it("filters by evidence domain without altering layer data", () => {
    const rows = projectMiningEvidence([
      { id: "territory.cadastre", data: collection(["A"]) },
      { id: "remote_sensing.sentinel2_alteration", data: collection(["B"]) },
      { id: "geophysics.anomalies", data: collection(["C"]) },
      { id: "sampling.results", data: collection(["D"]) },
    ]);
    expect(filterMiningEvidence(rows, "geophysics").map((r) => r.id)).toEqual([
      "geophysics.anomalies",
    ]);
    expect(filterMiningEvidence(rows, "sampling").map((r) => r.id)).toEqual(["sampling.results"]);
    expect(filterMiningEvidence(rows, "all")).toHaveLength(4);
  });

  it("limits untrusted example labels and never upgrades data evidence", () => {
    const results = projectMiningEvidence([
      {
        id: "remote_sensing.sentinel2_alteration",
        source: "Titular · interpretación",
        data: collection(Array.from({ length: 20 }, (_, index) => "Z".repeat(400) + index)),
      },
    ]);
    expect(results[0].examples).toHaveLength(5);
    expect(results[0].examples[0]).toHaveLength(120);
    expect(results[0].evidence).toBe("DERIVADO");
  });
});
