import { describe, expect, it } from "vitest";
import { desurvey, pointAtDepth, projectToSection, sliceByDepth } from "./drillGeometry";

const collar = { x: 0, y: 0, z: 1000 };

describe("drillGeometry", () => {
  it("vertical hole of 100 m ends 100 m below collar", () => {
    const pts = desurvey(collar, [{ md: 0, azimuth: 0, dip: -90 }], 100);
    const end = pts[pts.length - 1];
    expect(end.z).toBeCloseTo(900, 6);
    expect(end.x).toBeCloseTo(0, 6);
  });

  it("hole dipping -60 toward east moves 50 m east per 100 m", () => {
    const pts = desurvey(collar, [{ md: 0, azimuth: 90, dip: -60 }], 100);
    const end = pts[pts.length - 1];
    expect(end.x).toBeCloseTo(50, 6);
    expect(end.y).toBeCloseTo(0, 6);
    expect(end.z).toBeCloseTo(1000 - 86.6025, 3);
  });

  it("curved hole keeps arc length near measured depth", () => {
    const pts = desurvey(collar, [
      { md: 0, azimuth: 0, dip: -90 },
      { md: 100, azimuth: 0, dip: 0 },
    ]);
    const end = pts[pts.length - 1];
    // quarter circle radius 200/pi
    const r = 200 / Math.PI;
    expect(end.y).toBeCloseTo(r, 3);
    expect(1000 - end.z).toBeCloseTo(r, 3);
  });

  it("interpolates intercepts along the trajectory and rejects out-of-hole depths", () => {
    const pts = desurvey(collar, [{ md: 0, azimuth: 0, dip: -90 }], 100);
    expect(pointAtDepth(pts, 40)?.z).toBeCloseTo(960, 6);
    expect(pointAtDepth(pts, 150)).toBeNull();
    expect(sliceByDepth(pts, 20, 30).map((p) => Math.round(p.z))).toEqual([980, 970]);
  });

  it("projects onto a N-S section", () => {
    const r = projectToSection({ x: 10, y: 30, z: 5 }, { x: 0, y: 0 }, 0);
    expect(r.s).toBeCloseTo(30);
    expect(r.d).toBeCloseTo(-10);
  });
});
