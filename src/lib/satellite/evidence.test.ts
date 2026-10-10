import { describe, expect, it } from "vitest";
import { satelliteEvidence, validSatelliteBbox } from "./evidence";
describe("satellite provenance and AOI", () => {
  it("recognizes existing seeded records and new explicit synthetic records", () => {
    expect(satelliteEvidence({ seeded: true })).toContain("CONCEPTUAL");
    expect(satelliteEvidence({ provenance: "synthetic" })).toContain("CONCEPTUAL");
    expect(satelliteEvidence(null, "DEM sintético de demostración")).toContain("CONCEPTUAL");
    expect(satelliteEvidence(null)).toBe("DERIVADO · VALIDACIÓN PENDIENTE");
  });
  it("refuses missing, inverted, degenerate and out-of-range project AOIs", () => {
    for (const box of [
      null,
      [0, 0, 0, 0],
      [1, 2, 0, 3],
      [-181, 0, 10, 20],
      [0, -91, 10, 20],
      [0, 0, NaN, 20],
    ])
      expect(validSatelliteBbox(box)).toBe(false);
    expect(validSatelliteBbox([-71.2, -34, -71, -33.8])).toBe(true);
  });
});
