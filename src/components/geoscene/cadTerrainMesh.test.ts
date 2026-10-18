import { describe, expect, it } from "vitest";
import { buildCadTerrainMesh } from "./cadTerrainMesh";
import type { CadTerrainTile } from "@/lib/geospatial/terrainTile";

const tile = (mask: boolean[]): CadTerrainTile => ({
  source: "cad_contours",
  heights: [10, 20, 30, 40, 50, 60, 70, 80, 90],
  validMask: mask,
  size: 3,
  extentMeters: 200,
  centerLat: -33.8,
  centerLng: -71,
  centerElevationM: null,
  referenceElevationM: 1000,
  minH: 10,
  maxH: 90,
});

describe("CAD terrain mesh for GeoScene3D", () => {
  it("emits only cells fully inside the coverage mask (no extrapolation)", () => {
    const mesh = buildCadTerrainMesh(tile([true, true, false, true, true, false, false, false, false]));
    expect(mesh.cellCount).toBe(1);
    expect(mesh.indices.length).toBe(6);
  });

  it("uses absolute elevation = relative height + reference, north at row 0", () => {
    const mesh = buildCadTerrainMesh(tile(Array(9).fill(true)));
    expect(mesh.cellCount).toBe(4);
    expect(mesh.positions[2]).toBe(1010);
    expect(mesh.positions[1]).toBe(100);
    expect(mesh.positions[0]).toBe(-100);
  });
});
