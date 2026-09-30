import { describe, expect, it } from "vitest";
import {
  sceneFilterManifest,
  sceneHolePassesTime,
  sceneInterceptPassesGrade,
  sceneTargetPassesCampaign,
} from "./filterPolicy";

describe("GeoScene3D filter policy", () => {
  it("filters drilling by the operations time cursor", () => {
    const cursor = Date.parse("2026-06-01T00:00:00Z");
    expect(sceneHolePassesTime("2026-05-15T00:00:00Z", cursor)).toBe(true);
    expect(sceneHolePassesTime("2026-06-15T00:00:00Z", cursor)).toBe(false);
    expect(sceneHolePassesTime(null, cursor)).toBe(false);
    expect(sceneHolePassesTime(null, null)).toBe(true);
  });

  it("filters campaign-aware targets without hiding unfiltered views", () => {
    expect(sceneTargetPassesCampaign("cmp-a", null)).toBe(true);
    expect(sceneTargetPassesCampaign("cmp-a", "cmp-a")).toBe(true);
    expect(sceneTargetPassesCampaign("cmp-b", "cmp-a")).toBe(false);
  });

  it("uses the same high-grade threshold as the operations map", () => {
    expect(sceneInterceptPassesGrade(1.0, true)).toBe(true);
    expect(sceneInterceptPassesGrade(0.99, true)).toBe(false);
    expect(sceneInterceptPassesGrade(0.2, false)).toBe(true);
  });

  it("produces a deterministic snapshot-ready filter manifest", () => {
    expect(
      sceneFilterManifest({
        campaignId: "cmp-a",
        timeCursor: 123,
        highGradeOnly: true,
      }),
    ).toBe('{"campaignId":"cmp-a","timeCursor":123,"highGradeOnly":true}');
  });
});
