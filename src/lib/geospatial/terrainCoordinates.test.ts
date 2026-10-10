import { describe, expect, it } from "vitest";
import {
  projectTerrainPoint,
  proposedTraceEnd,
  terrainFootprintPaths,
  terrainGridCoordinate,
  type TerrainGrid,
} from "./terrainCoordinates";

const tile: TerrainGrid = {
  size: 3, extentMeters: 200, centerLng: -71.043, centerLat: -33.8543,
  heights: [0, 10, 20, 20, 30, 40, 40, 50, 60], source: "copernicus",
};

describe("terrain projection", () => {
  it("preserves grid orientation and interpolates heights in metres", () => {
    const coordinate = terrainGridCoordinate(-33.8543, -71.043, 3, 200, 0.5, 0.5);
    const point = projectTerrainPoint(tile, ...coordinate)!;
    expect(point[0]).toBeCloseTo(-50, 6);
    expect(point[1]).toBeCloseTo(15, 6);
    expect(point[2]).toBeCloseTo(-50, 6);
  });

  it("does not invent elevation for synthetic, missing or outside terrain", () => {
    expect(projectTerrainPoint({ ...tile, source: "synthetic" }, -71.043, -33.8543)).toBeNull();
    expect(projectTerrainPoint({ ...tile, centerLng: null }, -71.043, -33.8543)).toBeNull();
    expect(projectTerrainPoint(tile, -70, -33)).toBeNull();
    expect(projectTerrainPoint({ ...tile, heights: [NaN] }, -71.043, -33.8543)).toBeNull();
  });

  it("preserves polygon holes and multipart footprints without joining them", () => {
    const ring = (column: number) => [column, column + 0.1, column + 0.2, column].map((x, i) =>
      terrainGridCoordinate(-33.8543, -71.043, 3, 200, x, i === 1 ? 0.8 : 1));
    const paths = terrainFootprintPaths({
      type: "MultiPolygon",
      coordinates: [[ring(0.2), ring(0.5)], [ring(1.2)]],
    }, tile);
    expect(paths).toHaveLength(3);
    expect(paths.every((path) => path.length >= 2)).toBe(true);
  });

  it("uses the actual proposed depth and azimuth without assigning depth to a score", () => {
    const collar: [number, number, number] = [0, 30, 0];
    const end = proposedTraceEnd(collar, 90, -60, 170)!;
    expect(end[0]).toBeCloseTo(85);
    expect(end[1]).toBeCloseTo(30 - 170 * Math.sin(Math.PI / 3));
    expect(end[2]).toBeCloseTo(0);
    expect(proposedTraceEnd(collar, 90, -60, NaN)).toBeNull();
  });
});
