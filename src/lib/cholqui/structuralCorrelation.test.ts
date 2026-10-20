import { describe, expect, it } from "vitest";
import type { FeatureCollection } from "geojson";
import { axialDelta, correlateVeins, correlationLayer } from "./structuralCorrelation";

const line = (coords: number[][], properties = {}) => ({
  type: "Feature" as const,
  geometry: { type: "LineString" as const, coordinates: coords },
  properties,
});
const fc = (features: unknown[]) => ({ type: "FeatureCollection", features }) as FeatureCollection;

// Vein striking N-S (0°) at lng -71.05, ~200 m long.
const vein = line(
  [
    [-71.05, -33.851],
    [-71.05, -33.849],
  ],
  { code: "P-1", name: "Veta test", strikeDeg: 0 },
);

describe("structural correlation", () => {
  it("treats strikes as axial (N10E equals S10W)", () => {
    expect(axialDelta(10, 190)).toBe(0);
    expect(axialDelta(170, 5)).toBe(15);
  });

  it("matches a parallel lineament within 250 m and rejects an oblique one", () => {
    const lineaments = fc([
      line([
        [-71.0485, -33.851],
        [-71.0485, -33.849],
      ]), // ~140 m east, parallel
      line([
        [-71.0505, -33.8505],
        [-71.0495, -33.8495],
      ]), // close but 40° off
      line([
        [-71.03, -33.851],
        [-71.03, -33.849],
      ]), // parallel but ~1.8 km away
    ]);
    const [r] = correlateVeins(fc([vein]), lineaments, null);
    expect(r.lineaments.map((m) => m.index)).toEqual([0]);
    expect(r.lineaments[0].deltaDeg).toBe(0);
  });

  it("counts EMIT halo pixels by family within 300 m only", () => {
    const pt = (lng: number, familia: string) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [lng, -33.85] },
      properties: { familia },
    });
    const emit = fc([pt(-71.05, "alunita"), pt(-71.049, "clorita"), pt(-71.04, "alunita")]);
    const [r] = correlateVeins(fc([vein]), fc([]), emit);
    expect(r.halo.alunita).toBe(1);
    expect(r.halo.clorita).toBe(1);
    expect(correlationLayer([r], fc([])).features).toHaveLength(0);
  });
});
