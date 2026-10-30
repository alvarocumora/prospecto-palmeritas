import { describe, expect, it } from "vitest";
import {
  buildDrillGridFromTargets,
  CHOLQUI_DRILL_CONFIG,
  dominantStrikeFromVeins,
  optimizeDrillSelection,
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

describe("optimizeDrillSelection", () => {
  const center = { lat: -30, lng: -71 };
  const project = { codePrefix: "LV-DDH", dominantStrikeDeg: 20 };

  // Spread of targets with enough points/variance to fit a variogram.
  const cluster = [60, 65, 70, 75, 80, 85, 90].map((score, i) => ({
    id: `cluster-${i}`,
    lat: -30 + i * 0.002,
    lng: -71,
    score,
    objective: "x",
  }));

  it("falls back to plain score ranking without enough scored targets to fit a variogram", () => {
    const sparse = [
      { id: "a", lat: -30, lng: -71, score: 90, objective: "x" },
      { id: "b", lat: -30.001, lng: -71.001, score: 60, objective: "x" },
    ];
    const optimized = optimizeDrillSelection(sparse, [], center, project);
    const plain = buildDrillGridFromTargets(sparse, center, project);
    expect(optimized).toEqual(plain);
  });

  it("is deterministic — same input twice yields the same output", () => {
    const run1 = optimizeDrillSelection(cluster, [], center, project, { maxCollars: 4 });
    const run2 = optimizeDrillSelection(cluster, [], center, project, { maxCollars: 4 });
    expect(run1).toEqual(run2);
  });

  it("derives azimuth from the dominant strike, never a random value", () => {
    const [collar] = optimizeDrillSelection(cluster, [], center, project, { maxCollars: 1 });
    const [plain] = buildDrillGridFromTargets(
      [cluster.find((c) => c.id === collar.anomalyId)!],
      center,
      project,
    );
    expect(collar.azimuthDeg).toBe(plain.azimuthDeg);
  });

  it("enforces minimum spacing between chosen collars", () => {
    const twins = [
      { id: "twinA", lat: -30.05, lng: -71, score: 95, objective: "x" },
      { id: "twinB", lat: -30.05, lng: -71.00003, score: 95, objective: "x" }, // ~3 m away
    ];
    const optimized = optimizeDrillSelection([...cluster, ...twins], [], center, project, {
      maxCollars: 10,
    });
    const chosenIds = optimized.map((c) => c.anomalyId);
    expect(chosenIds).toContain("twinA");
    expect(chosenIds).not.toContain("twinB");
  });

  it("prefers information gain (distance from existing drilling) over raw score alone", () => {
    const nearExisting = {
      id: "nearExisting",
      lat: -30.02,
      lng: -71,
      score: 82,
      objective: "x",
    };
    const farAway = { id: "farAway", lat: -30.04, lng: -71, score: 76, objective: "x" };
    // The whole cluster and nearExisting sit on already-drilled ground; only
    // farAway is genuinely unexplored.
    const existingHoles = [...cluster, nearExisting].map((t) => ({ lat: t.lat, lng: t.lng }));

    const optimized = optimizeDrillSelection(
      [...cluster, nearExisting, farAway],
      existingHoles,
      center,
      project,
      { maxCollars: 1 },
    );
    expect(optimized[0]?.anomalyId).toBe("farAway");
  });

  it("does not blow the call stack with a large target inventory", () => {
    const many = Array.from({ length: 600 }, (_, i) => ({
      id: `t${i}`,
      lat: -30 + (i % 30) * 0.001,
      lng: -71 + Math.floor(i / 30) * 0.001,
      score: 55 + (i % 40),
      objective: "x",
    }));
    expect(() => optimizeDrillSelection(many, [], center, project)).not.toThrow();
  });
});
