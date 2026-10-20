import { describe, expect, it } from "vitest";
import type { FeatureCollection } from "geojson";
import { apparentDip, sectionAzimuth, sectionLength, structuresInSection, terrainProfile } from "./sectionProfile";

const A: [number, number] = [-71.0, -33.6];
const B: [number, number] = [-70.99, -33.6]; // ~926 m al este

describe("section profile", () => {
  it("measures an east-west section", () => {
    expect(Math.round(sectionAzimuth(A, B))).toBe(90);
    expect(sectionLength(A, B)).toBeGreaterThan(900);
    expect(sectionLength(A, B)).toBeLessThan(950);
  });

  it("apparent dip equals true dip along dip direction and 0 along strike", () => {
    expect(apparentDip(60, 90, 90)).toBeCloseTo(60, 6);
    expect(apparentDip(60, 90, 0)).toBeCloseTo(0, 6);
    expect(apparentDip(45, 90, 30)).toBeLessThan(45);
  });

  it("keeps unknown heights as null instead of zero", () => {
    const p = terrainProfile(A, B, (lng) => (lng < -70.995 ? 500 : null));
    expect(p[0].z).toBe(500);
    expect(p[p.length - 1].z).toBeNull();
  });

  it("finds crossing veins and their apparent dip; unmeasured dip stays null", () => {
    const fc: FeatureCollection = {
      type: "FeatureCollection",
      features: [
        { type: "Feature", properties: { code: "V1", strikeDeg: 0, dipText: "60° E" },
          geometry: { type: "LineString", coordinates: [[-70.995, -33.605], [-70.995, -33.595]] } },
        { type: "Feature", properties: { code: "V2" },
          geometry: { type: "LineString", coordinates: [[-70.992, -33.605], [-70.992, -33.595]] } },
        { type: "Feature", properties: { code: "far" },
          geometry: { type: "LineString", coordinates: [[-70.995, -33.65], [-70.994, -33.64]] } },
      ],
    };
    const s = structuresInSection(A, B, fc, 50);
    expect(s.map((x) => x.code)).toEqual(["V1", "V2"]);
    expect(s[0].apparentDipDeg).toBeCloseTo(60, 3);
    expect(s[0].towardB).toBe(1);
    expect(s[1].dipDeg).toBeNull();
  });
});
