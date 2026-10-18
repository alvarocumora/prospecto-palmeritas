import { describe, expect, it } from "vitest";
import { isDashedEvidence, projectLayerTooltip, resolveProjectLayers } from "./projectLayers";

const fc = {
  type: "FeatureCollection" as const,
  features: [
    {
      type: "Feature" as const,
      geometry: { type: "Point" as const, coordinates: [-71, -33.8] },
      properties: { nombre: "HM TOKI 6" },
    },
  ],
};

describe("GeoScene3D project layers", () => {
  it("takes evidence from the registry, not the caller", () => {
    const [mojones] = resolveProjectLayers([{ id: "territory.mojones", data: fc }]);
    expect(mojones.definition.evidence).toBe("CONTEXTO");
    const [cad] = resolveProjectLayers([{ id: "territory.cadastre", data: fc }]);
    expect(cad.definition.evidence).toBe("OFICIAL");
  });

  it("drops empty layers", () => {
    expect(
      resolveProjectLayers([{ id: "territory.cadastre", data: { ...fc, features: [] } }]),
    ).toHaveLength(0);
  });

  it("renders proposed pedimentos dashed and shows their caution", () => {
    const [p] = resolveProjectLayers([{ id: "territory.proposed_pedimentos", data: fc }]);
    expect(isDashedEvidence(p.definition.evidence)).toBe(true);
    expect(isDashedEvidence("OFICIAL")).toBe(false);
    expect(projectLayerTooltip(p, { nombre: "X" })).toContain("no tratar como tenencia oficial");
  });
});
