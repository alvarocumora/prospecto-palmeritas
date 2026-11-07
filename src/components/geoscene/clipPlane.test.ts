import { describe, expect, it } from "vitest";
import {
  axialMeanDeg,
  bboxWithinClipCorridor,
  clipAxisAzimuth,
  geometryWithinClipCorridor,
  perpendicularDistanceM,
  representativePoint,
  withinClipCorridor,
} from "./clipPlane";

describe("clipPlane", () => {
  it("picks the normal azimuth for each axis", () => {
    expect(clipAxisAzimuth("ns", 0)).toBe(90);
    expect(clipAxisAzimuth("ew", 0)).toBe(0);
    expect(clipAxisAzimuth("strike", 30)).toBe(120);
    expect(clipAxisAzimuth("strike", 350)).toBe(80);
  });

  it("measures perpendicular distance in meters along the normal", () => {
    const center: [number, number] = [-71.0, -32.0];
    // Normal pointing east (90deg): a point ~0.001 deg east should be ~roughly
    // metersPerDegLng(-32) * 0.001 away, and ~0 for a point directly north.
    const east: [number, number] = [-70.999, -32.0];
    const north: [number, number] = [-71.0, -31.999];
    expect(perpendicularDistanceM(center, 90, east)).toBeGreaterThan(0);
    expect(perpendicularDistanceM(center, 90, north)).toBeCloseTo(0, 3);
    expect(perpendicularDistanceM(center, 0, north)).toBeGreaterThan(0);
  });

  it("treats a missing center or point as always within the corridor", () => {
    const base = { axis: "ns" as const, azimuthDeg: 0, thicknessM: 50 };
    expect(withinClipCorridor({ ...base, center: null }, [-71, -32])).toBe(true);
    expect(withinClipCorridor({ ...base, center: [-71, -32] }, null)).toBe(true);
  });

  it("keeps only points within half the thickness of the plane", () => {
    const center: [number, number] = [-71.0, -32.0];
    const base = { axis: "ns" as const, azimuthDeg: 0, thicknessM: 20, center };
    // Normal for "ns" is east-west; a point ~5m east should be inside a 20m
    // corridor, a point ~50m east should be outside.
    const near: [number, number] = [-71.0 + 5 / (111_320 * Math.cos((-32 * Math.PI) / 180)), -32.0];
    const far: [number, number] = [-71.0 + 50 / (111_320 * Math.cos((-32 * Math.PI) / 180)), -32.0];
    expect(withinClipCorridor(base, near)).toBe(true);
    expect(withinClipCorridor(base, far)).toBe(false);
  });

  it("finds a representative point for points, lines and polygons", () => {
    expect(representativePoint(null)).toBeNull();
    expect(representativePoint({ type: "Point", coordinates: [-71, -32] })).toEqual([-71, -32]);
    expect(
      representativePoint({
        type: "LineString",
        coordinates: [
          [-71, -32],
          [-71.1, -32.1],
        ],
      }),
    ).toEqual([-71, -32]);
    expect(
      representativePoint({
        type: "Polygon",
        coordinates: [
          [
            [-71, -32],
            [-71.1, -32],
            [-71.1, -32.1],
            [-71, -32],
          ],
        ],
      }),
    ).toEqual([-71, -32]);
  });

  it("includes a geometry when any of its vertices falls inside the corridor, regardless of order", () => {
    const center: [number, number] = [-71.0, -32.0];
    const base = { axis: "ns" as const, azimuthDeg: 0, thicknessM: 20, center };
    const mPerDegLng = 111_320 * Math.cos((-32 * Math.PI) / 180);
    const near: [number, number] = [-71.0 + 5 / mPerDegLng, -32.0];
    const far: [number, number] = [-71.0 + 50 / mPerDegLng, -32.0];
    // A line whose far endpoint is listed first still counts, because at
    // least one vertex (the near one) falls inside the corridor.
    expect(geometryWithinClipCorridor(base, { type: "LineString", coordinates: [far, near] })).toBe(
      true,
    );
    expect(geometryWithinClipCorridor(base, { type: "LineString", coordinates: [near, far] })).toBe(
      true,
    );
    expect(geometryWithinClipCorridor(base, { type: "LineString", coordinates: [far, far] })).toBe(
      false,
    );
  });

  it("treats a missing clip center as always within the corridor for a geometry", () => {
    const base = { axis: "ns" as const, azimuthDeg: 0, thicknessM: 20, center: null };
    expect(geometryWithinClipCorridor(base, { type: "Point", coordinates: [-71, -32] })).toBe(true);
  });

  it("keeps a bbox that crosses the corridor even when its centroid falls outside it", () => {
    const center: [number, number] = [-71.0, -32.0];
    const mPerDegLng = 111_320 * Math.cos((-32 * Math.PI) / 180);
    const base = { axis: "ns" as const, azimuthDeg: 0, thicknessM: 50, center };
    // "ns" axis's normal is east-west. A body spanning -40m to +160m east of
    // the cut (centroid at +60m, outside a ±25m corridor) still crosses it.
    const wideBBox = {
      minLng: -71.0 - 40 / mPerDegLng,
      maxLng: -71.0 + 160 / mPerDegLng,
      minLat: -32.001,
      maxLat: -31.999,
    };
    expect(bboxWithinClipCorridor(base, wideBBox)).toBe(true);
    // A bbox entirely beyond the corridor (100m to 160m east) does not cross it.
    const farBBox = {
      minLng: -71.0 + 100 / mPerDegLng,
      maxLng: -71.0 + 160 / mPerDegLng,
      minLat: -32.001,
      maxLat: -31.999,
    };
    expect(bboxWithinClipCorridor(base, farBBox)).toBe(false);
  });

  it("treats a missing clip center or bbox as always within the corridor", () => {
    const base = { axis: "ns" as const, azimuthDeg: 0, thicknessM: 50, center: null };
    expect(
      bboxWithinClipCorridor(base, { minLng: -71.1, maxLng: -71, minLat: -32.1, maxLat: -32 }),
    ).toBe(true);
    expect(bboxWithinClipCorridor({ ...base, center: [-71, -32] }, null)).toBe(true);
  });

  it("computes an axial circular mean, treating opposite strikes as the same axis", () => {
    expect(axialMeanDeg([])).toBe(0);
    expect(axialMeanDeg([10, 190])).toBeCloseTo(10, 5);
    // The naive arithmetic mean of 10 and 190 is 100, which would be wrong
    // (perpendicular to the real axis); the axial mean must not land there.
    expect(axialMeanDeg([10, 190])).not.toBeCloseTo(100, 5);
    expect(axialMeanDeg([45])).toBeCloseTo(45, 5);
  });
});
