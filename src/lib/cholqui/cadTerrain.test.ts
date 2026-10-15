import { describe, expect, it } from "vitest";
import grid from "@/data/geo/cholqui_cad_terrain.json";
import { cholquiCadTerrain } from "./cadTerrain";
import { projectTerrainPoint, terrainGridCoordinate } from "@/lib/geospatial/terrainCoordinates";

describe("Cholqui declared CAD terrain", () => {
  it("preserves provenance, elevations and grid orientation", () => {
    expect(cholquiCadTerrain.source).toBe("cad_contours");
    expect(cholquiCadTerrain.centerElevationM).toBeNull();
    expect(grid.sourceEvidence).toBe("DECLARADO");
    expect(grid.sourceSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(grid.contourCount).toBe(892);
    expect(cholquiCadTerrain.heights).toHaveLength(grid.size * grid.size);
    expect(cholquiCadTerrain.validMask.filter(Boolean)).toHaveLength(grid.validNodeCount);
    const elevations = grid.heights.filter((height): height is number => height != null)
      .map((height) => height + grid.referenceElevationM);
    expect(Math.min(...elevations)).toBeGreaterThanOrEqual(grid.sourceMinElevationM - 0.001);
    expect(Math.max(...elevations)).toBeLessThanOrEqual(grid.sourceMaxElevationM + 0.001);
  });

  it("projects only supported cells and never turns missing CAD elevations into zero", () => {
    let supported = 0;
    for (let row = 0; row < grid.size - 1; row++) {
      for (let column = 0; column < grid.size - 1; column++) {
        const coordinate = terrainGridCoordinate(grid.centerLat, grid.centerLng, grid.size,
          grid.extentMeters, column + 0.5, row + 0.5);
        const point = projectTerrainPoint(cholquiCadTerrain, ...coordinate);
        const indices = [row * grid.size + column, row * grid.size + column + 1,
          (row + 1) * grid.size + column, (row + 1) * grid.size + column + 1];
        if (indices.every((index) => cholquiCadTerrain.validMask[index])) {
          expect(point).not.toBeNull();
          supported++;
        } else expect(point).toBeNull();
      }
    }
    expect(supported).toBeGreaterThan(20000);
    expect(projectTerrainPoint({ ...cholquiCadTerrain, validMask: [] }, grid.centerLng, grid.centerLat)).toBeNull();
  });
});