import { describe, expect, it } from "vitest";
import type { FeatureCollection, Geometry } from "geojson";
import { resolveProjectTenure } from "./projectTenure";

describe("project tenure evidence", () => {
  const collection: FeatureCollection<Geometry | null> = {
    type: "FeatureCollection",
    features: [
      { type: "Feature", geometry: null, properties: { code: "136010672-8" } },
      { type: "Feature", geometry: null, properties: { rut_holder: "12.345.678-K" } },
      { type: "Feature", geometry: null, properties: { project_id: "project" } },
      { type: "Feature", geometry: null, properties: { holder: "Same display name" } },
    ],
  };
  it("matches exact normalized identifiers without fabricating missing geometries", () => {
    const result = resolveProjectTenure(collection, {
      projectId: "project",
      concessionCodes: ["1360106728"],
      holderRuts: ["12345678-k"],
    });
    expect(result.features.map((f) => f.properties?.es_tenencia_proyecto)).toEqual([
      true,
      true,
      true,
      null,
    ]);
    expect(result.features.every((f) => f.geometry === null)).toBe(true);
    expect(result.features[0].properties?.tenencia_procedencia).toBe("declared");
    expect(collection.features[0].properties?.es_tenencia_proyecto).toBeUndefined();
  });
  it("does not infer ownership from empty identifiers or holder display names", () => {
    const result = resolveProjectTenure(collection, {
      projectId: "other",
      concessionCodes: [""],
      holderRuts: [""],
    });
    expect(result.features.every((f) => f.properties?.es_tenencia_proyecto === null)).toBe(true);
  });
});
