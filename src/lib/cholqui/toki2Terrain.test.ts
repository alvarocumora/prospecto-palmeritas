import { describe, expect, it } from "vitest";
import type { DemTile } from "@/engine3d/terrain/dem.functions";
import {
  analyzeToki2Terrain,
  buildToki2ControlPoints,
  workClassForSlope,
  type LonLat,
} from "./toki2Terrain";

const ring: LonLat[] = [
  [-0.0004, 0.0004],
  [0.0004, 0.0004],
  [0.0004, -0.0004],
  [-0.0004, -0.0004],
  [-0.0004, 0.0004],
];

function tile(heights: number[]): DemTile {
  return {
    heights,
    size: 5,
    extentMeters: 100,
    minH: Math.min(...heights),
    maxH: Math.max(...heights),
    centerLat: 0,
    centerLng: 0,
    centerElevationM: 100,
    source: "copernicus",
  };
}

describe("Toki 2 terrain analysis", () => {
  it("builds the 8 perimeter controls plus one center control", () => {
    const points = buildToki2ControlPoints(ring);
    expect(points).toHaveLength(9);
    expect(points[8].code).toBe("TK2-09");
    expect(points[8].lat).toBeCloseTo(0, 8);
    expect(points[8].lng).toBeCloseTo(0, 8);
  });

  it("classifies a flat DEM as class A and preserves absolute elevation", () => {
    const analysis = analyzeToki2Terrain(tile(new Array(25).fill(0)), ring, 100);
    expect(analysis.reliefM).toBe(0);
    expect(analysis.meanSlopeDeg).toBeCloseTo(0, 6);
    expect(analysis.classes.find((item) => item.workClass === "A")?.pct).toBeCloseTo(100, 6);
    expect(analysis.controlPoints[8].elevationM).toBe(100);
    expect(analysis.controlPoints[8].workClass).toBe("A");
  });

  it("keeps the operational thresholds explicit", () => {
    expect(workClassForSlope(15)).toBe("A");
    expect(workClassForSlope(20)).toBe("B");
    expect(workClassForSlope(30)).toBe("C");
    expect(workClassForSlope(40)).toBe("D");
  });
});
