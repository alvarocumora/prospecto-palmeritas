import { describe, expect, it } from "vitest";
import { copernicusTileUrl } from "./dem.functions";

describe("copernicusTileUrl", () => {
  it("hemisferio sur/oeste con padding correcto (Illapel, Chile)", () => {
    // lat -31.6 → floor -32 → S32 (tile cubre -32..-31)
    // lng -71.2 → floor -72 → W072
    expect(copernicusTileUrl(-31.6, -71.2)).toBe(
      "https://copernicus-dem-30m.s3.amazonaws.com/Copernicus_DSM_COG_10_S32_00_W072_00_DEM/Copernicus_DSM_COG_10_S32_00_W072_00_DEM.tif",
    );
  });

  it("hemisferio norte/este", () => {
    expect(copernicusTileUrl(50.5, 6.3)).toContain("N50_00_E006_00");
  });

  it("lat de un dígito lleva dos posiciones y lng tres", () => {
    expect(copernicusTileUrl(-7.2, -78.5)).toContain("S08_00_W079_00");
    expect(copernicusTileUrl(5.1, 100.9)).toContain("N05_00_E100_00");
  });

  it("bordes exactos de grado usan su propio tile", () => {
    expect(copernicusTileUrl(-31, -71)).toContain("S31_00_W071_00");
  });
});
