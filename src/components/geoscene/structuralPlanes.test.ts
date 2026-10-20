import { describe, expect, it } from "vitest";
import { dipDirection, discRing, parseDip, planeFromProperties } from "./structuralPlanes";
import { drapeFeatureCollection } from "./terrainDrape";

describe("structural planes", () => {
  it("N20E / 30 SE dips toward 110°", () => {
    const p = planeFromProperties({ code: "P-1", strikeDeg: 20, dipText: "30° SE" });
    expect(p).toEqual({ code: "P-1", strikeDeg: 20, dipDeg: 30, dipDirectionDeg: 110 });
  });
  it("quadrant NW flips to the left-hand side", () => {
    expect(dipDirection(20, "NW")).toBe(290);
  });
  it("range dips use the mean and missing dip yields no plane", () => {
    expect(parseDip("60-70° NW")?.dip).toBe(65);
    expect(planeFromProperties({ strikeDeg: 20, dipText: null })).toBeNull();
  });
  it("disc drops radius·sin(dip) below centre on the down-dip side", () => {
    const ring = discRing(
      [-71, -33, 1000],
      { code: "", strikeDeg: 0, dipDeg: 30, dipDirectionDeg: 90 },
      40,
    );
    const minZ = Math.min(...ring.map((p) => p[2]));
    expect(minZ).toBeCloseTo(1000 - 40 * Math.sin(Math.PI / 6), 3);
  });
});

describe("terrain drape", () => {
  it("lifts every vertex to sampled elevation plus offset and densifies edges", () => {
    const fc = drapeFeatureCollection(
      {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            properties: {},
            geometry: {
              type: "LineString",
              coordinates: [
                [-71, -33],
                [-70.99, -33],
              ],
            },
          },
        ],
      },
      () => 1500,
      { offsetM: 5, maxSegmentM: 100 },
    );
    const coords = (fc.features[0].geometry as { coordinates: number[][] }).coordinates;
    expect(coords.length).toBeGreaterThan(9);
    expect(coords.every((c) => c[2] === 1505)).toBe(true);
  });
  it("uses the fallback when elevation is unknown, never zero", () => {
    const fc = drapeFeatureCollection(
      {
        type: "FeatureCollection",
        features: [
          { type: "Feature", properties: {}, geometry: { type: "Point", coordinates: [-71, -33] } },
        ],
      },
      () => null,
      { fallback: 800, offsetM: 0 },
    );
    expect((fc.features[0].geometry as { coordinates: number[] }).coordinates[2]).toBe(800);
  });
});

import { hybridElevationSampler } from "./terrainDrape";
describe("hybrid elevation sampler", () => {
  it("uses survey inside coverage and regional DEM outside, never zero", () => {
    const cad = (lng: number) => (lng < 0 ? 900 : null);
    const dem = () => 750;
    const s = hybridElevationSampler(cad, dem);
    expect(s(-1, 0)).toBe(900);
    expect(s(1, 0)).toBe(750);
    expect(hybridElevationSampler(cad, () => null)(1, 0)).toBeNull();
  });
});
