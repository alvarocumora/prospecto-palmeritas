import { describe, expect, it } from "vitest";
import { intersectsAoiBbox } from "./geometry";

const aoi: [number, number][] = [
  [-71.2, -33.95],
  [-71.0, -33.95],
  [-71.0, -33.85],
  [-71.2, -33.85],
];

describe("intersectsAoiBbox", () => {
  it("returns true when a polygon bbox overlaps the AOI bbox", () => {
    const polygon = {
      type: "Polygon",
      coordinates: [
        [
          [-71.15, -33.9],
          [-71.05, -33.9],
          [-71.05, -33.88],
          [-71.15, -33.88],
          [-71.15, -33.9],
        ],
      ],
    };

    expect(intersectsAoiBbox(polygon, aoi)).toBe(true);
  });

  it("returns false when a polygon bbox does not overlap the AOI bbox", () => {
    const polygon = {
      type: "Polygon",
      coordinates: [
        [
          [-72.15, -34.9],
          [-72.05, -34.9],
          [-72.05, -34.88],
          [-72.15, -34.88],
          [-72.15, -34.9],
        ],
      ],
    };

    expect(intersectsAoiBbox(polygon, aoi)).toBe(false);
  });

  it("returns false for unsupported or missing geometry", () => {
    expect(intersectsAoiBbox(null, aoi)).toBe(false);
    expect(intersectsAoiBbox({ type: "Point", coordinates: [-71.1, -33.9] }, aoi)).toBe(false);
    expect(intersectsAoiBbox({ type: "Polygon", coordinates: [] }, null)).toBe(false);
  });
});
