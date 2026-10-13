import { describe, expect, it } from "vitest";
import { comparableSentinelRuns } from "./sentinelRunComparison";

const bbox = [-71.2, -33.1, -71.1, -33.0];

function run(overrides: Record<string, unknown> = {}) {
  return {
    id: "run-1",
    external_scene_id: "scene-1",
    created_at: "2026-10-10T12:00:00Z",
    status: "succeeded",
    bbox,
    source_metadata: { acquisition_date: "2026-10-09T14:00:00Z" },
    stats: {
      valid_pixels: 120,
      indices: { ndvi: { mean: 0.25 }, ndmi: { mean: -0.1 } },
    },
    ...overrides,
  };
}

describe("comparableSentinelRuns", () => {
  it("returns successful scenes for the same AOI ordered by acquisition date", () => {
    const rows = comparableSentinelRuns(
      [
        run({
          id: "new",
          external_scene_id: "scene-new",
          source_metadata: { acquisition_date: "2026-10-12T10:00:00Z" },
        }),
        run({
          id: "old",
          external_scene_id: "scene-old",
          source_metadata: { acquisition_date: "2026-10-02T10:00:00Z" },
        }),
      ],
      bbox,
    );

    expect(rows.map((row) => row.id)).toEqual(["old", "new"]);
    expect(rows[0]).toMatchObject({ acquisitionDate: "2026-10-02", validPixels: 120 });
    expect(rows[0].means).toEqual({ ndvi: 0.25, ndmi: -0.1 });
  });

  it("excludes failed runs, other AOIs and rows without usable statistics", () => {
    const rows = comparableSentinelRuns(
      [
        run(),
        run({ id: "failed", status: "failed" }),
        run({ id: "other-aoi", bbox: [-72, -34, -71, -33] }),
        run({ id: "missing-stats", stats: null }),
      ],
      bbox,
    );

    expect(rows.map((row) => row.id)).toEqual(["run-1"]);
  });

  it("returns no comparisons for an invalid current AOI", () => {
    expect(comparableSentinelRuns([run()], [-71, -33])).toEqual([]);
  });
});
