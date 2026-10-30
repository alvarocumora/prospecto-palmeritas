import { describe, expect, it } from "vitest";
import {
  buildDrillGridFromTargets,
  CHOLQUI_DRILL_CONFIG,
  dominantStrikeFromVeins,
} from "./drillGrid";

describe("dominantStrikeFromVeins", () => {
  it("returns null without measured strikes", () => {
    expect(dominantStrikeFromVeins([])).toBeNull();
    expect(dominantStrikeFromVeins([{ strike_deg: null }])).toBeNull();
  });

  it("averages strikes as undirected lines (10° and 190° are the same line)", () => {
    const strike = dominantStrikeFromVeins([{ strike_deg: 10 }, { strike_deg: 190 }]);
    expect(strike).not.toBeNull();
    expect(strike!).toBeCloseTo(10, 5);
  });

  it("ignores vein entries with no strike recorded", () => {
    const strike = dominantStrikeFromVeins([{ strike_deg: 20 }, { strike_deg: null }]);
    expect(strike).toBeCloseTo(20, 5);
  });
});

describe("buildDrillGridFromTargets", () => {
  const center = { lat: -30, lng: -71 };
  const project = { codePrefix: "LV-DDH", dominantStrikeDeg: 20 };

  it("normalizes the 0-100 DB score scale before scoring/prioritizing", () => {
    const [collar] = buildDrillGridFromTargets(
      [{ id: "t1", lat: -30.001, lng: -71.001, score: 90, objective: "Verificar target" }],
      center,
      project,
    );
    expect(collar.score).toBeCloseTo(0.9, 5);
    expect(collar.priority).toBe("Alta");
    expect(collar.depthM).toBeLessThanOrEqual(220);
    expect(collar.depthM).toBeGreaterThanOrEqual(120);
  });

  it("drops targets outside tenure and below the score threshold", () => {
    const collars = buildDrillGridFromTargets(
      [
        { id: "low", lat: -30, lng: -71, score: 10, objective: "x" },
        { id: "outside", lat: -30, lng: -71, score: 95, objective: "x", withinTenure: false },
        { id: "ok", lat: -30, lng: -71, score: 70, objective: "x" },
      ],
      center,
      project,
    );
    expect(collars.map((c) => c.anomalyId)).toEqual(["ok"]);
  });

  it("uses the project's code prefix, not Cholqui's", () => {
    const [collar] = buildDrillGridFromTargets(
      [{ id: "t1", lat: -30.001, lng: -71.001, score: 80, objective: "x" }],
      center,
      project,
    );
    expect(collar.code).toBe("LV-DDH-01");
    expect(collar.code).not.toContain(CHOLQUI_DRILL_CONFIG.codePrefix);
  });

  it("carries the target's own objective/rationale, not a fabricated one", () => {
    const [collar] = buildDrillGridFromTargets(
      [
        {
          id: "t1",
          lat: -30.001,
          lng: -71.001,
          score: 80,
          objective: "Cortar la veta en el clavo norte",
        },
      ],
      center,
      project,
    );
    expect(collar.objective).toBe("Cortar la veta en el clavo norte");
  });
});
