import { describe, expect, it } from "vitest";
import { buildManifestFromViewerDataset } from "./viewerSnapshotState";

const viewState = JSON.stringify({
  center: { lng: -70.5, lat: -30.1 },
  bounds: { west: -70.6, south: -30.2, east: -70.4, north: -30.0 },
  zoom: 13,
  pitch: 55,
  bearing: -20,
});

describe("viewer snapshot runtime bridge", () => {
  it("builds a canonical manifest from viewer data attributes", () => {
    const manifest = buildManifestFromViewerDataset(
      {
        geoEngine: "deckgl",
        geoMode: "3d",
        geoProjectId: "project-1",
        geoProfile: "cholqui",
        geoPreset: "official_3d",
        geoCrs: "EPSG:4326",
        geoViewState: viewState,
        geoLayerIds: "targets.exploration,territory.dem",
        geoFilters: JSON.stringify({ campaignId: "c1", timeCursor: 42 }),
      },
      "2026-09-30T20:00:00.000Z",
    );

    expect(manifest?.projectId).toBe("project-1");
    expect(manifest?.mode).toBe("3d");
    expect(manifest?.projectProfile).toBe("cholqui");
    expect(manifest?.filters).toEqual({ campaignId: "c1", timeCursor: 42 });
    expect(manifest?.eligibleForReport).toBe(true);
  });

  it("refuses incomplete or malformed runtime state", () => {
    expect(
      buildManifestFromViewerDataset({
        geoEngine: "leaflet",
        geoMode: "2d",
        geoProjectId: "project-1",
        geoViewState: "not-json",
      }),
    ).toBeNull();

    expect(
      buildManifestFromViewerDataset({
        geoEngine: "unknown",
        geoMode: "2d",
        geoProjectId: "project-1",
        geoViewState: viewState,
      }),
    ).toBeNull();
  });
});
