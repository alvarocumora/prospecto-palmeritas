import { describe, expect, it } from "vitest";
import { indexRange, rampColor } from "./processedSceneStyle";

describe("processed scene ramp", () => {
  it("ignores nodata -9999 when computing the range", () => {
    const fc = {
      type: "FeatureCollection" as const,
      features: [1, 2, 3, -9999].map((v) => ({
        type: "Feature" as const,
        geometry: { type: "Point" as const, coordinates: [0, 0] },
        properties: { ndvi: v },
      })),
    };
    const [lo] = indexRange(fc, "ndvi");
    expect(lo).toBe(1);
  });
  it("clamps values outside the range to ramp ends", () => {
    expect(rampColor(-5, [0, 1])).toEqual([48, 18, 59]);
    expect(rampColor(5, [0, 1])).toEqual([220, 60, 30]);
  });
});
