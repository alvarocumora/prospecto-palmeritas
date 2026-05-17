import { describe, expect, it } from "vitest";
import { projectExplorationObjects } from "./anomalyProjection";

describe("projectExplorationObjects", () => {
  const viewer = {
    lat: -31.72,
    lng: -71.27,
    altitudeM: 1200,
    headingDeg: 90,
  };

  it("projects and sorts nearby exploration objects", () => {
    const projected = projectExplorationObjects(viewer, [
      {
        id: "a2",
        type: "magnetic_anomaly",
        label: "Magnetic South",
        lat: -31.74,
        lng: -71.29,
      },
      {
        id: "a1",
        type: "target",
        label: "Target Norte",
        lat: -31.721,
        lng: -71.271,
        elevationM: 1240,
      },
    ]);

    expect(projected).toHaveLength(2);
    expect(projected[0].id).toBe("a1");
    expect(projected[0].isNearby).toBe(true);
    expect(projected[0].relativeElevationM).toBe(40);
    expect(projected[0].labelCompact).toMatch(/Target Norte/);
  });

  it("filters by max distance", () => {
    const projected = projectExplorationObjects(
      viewer,
      [
        {
          id: "far",
          type: "satellite_anomaly",
          label: "Far anomaly",
          lat: -32.5,
          lng: -72.5,
        },
      ],
      { maxDistanceM: 1000 },
    );

    expect(projected).toEqual([]);
  });

  it("computes relative bearing when heading is available", () => {
    const projected = projectExplorationObjects(viewer, [
      {
        id: "east",
        type: "target",
        label: "East target",
        lat: -31.72,
        lng: -71.26,
      },
    ]);

    expect(projected[0].relativeBearingDeg).not.toBeNull();
  });
});
