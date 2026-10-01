import { describe, expect, it } from "vitest";
import { buildGeoSnapshotManifest, stableGeoSnapshotPayload } from "./snapshotManifest";

const VIEW = {
  center: { lng: -70.5, lat: -30.1 },
  bounds: { west: -70.6, south: -30.2, east: -70.4, north: -30.0 },
  zoom: 12,
};

describe("canonical geo snapshot manifest", () => {
  it("canonicalizes aliases and keeps evidence semantics from the registry", () => {
    const manifest = buildGeoSnapshotManifest({
      generatedAt: "2026-09-30T20:00:00.000Z",
      projectId: "p1",
      mode: "2d",
      engine: "leaflet",
      view: VIEW,
      visibleLayerIds: ["geophys:emag2", "halos", "geophys:planned"],
    });

    expect(manifest.layers.map((layer) => layer.id)).toEqual([
      "geophysics.emag2",
      "geophysics.planned_survey",
      "remote_sensing.sentinel2_alteration",
    ]);
    expect(manifest.layers.find((layer) => layer.id === "geophysics.emag2")?.evidence).toBe(
      "DERIVADO",
    );
    expect(manifest.layers.find((layer) => layer.id === "geophysics.emag2")?.use).toBe("context");
    expect(
      manifest.layers.find((layer) => layer.id === "remote_sensing.sentinel2_alteration")?.evidence,
    ).toBe("DERIVADO");
    expect(
      manifest.layers.find((layer) => layer.id === "geophysics.planned_survey")?.evidence,
    ).toBe("PROPUESTO");
  });

  it("blocks report eligibility for unknown and non-report-capable visible layers", () => {
    const manifest = buildGeoSnapshotManifest({
      projectId: "p1",
      mode: "2d",
      engine: "leaflet",
      view: VIEW,
      visibleLayerIds: ["basemap:carto-dark", "missing-layer"],
    });

    expect(manifest.eligibleForReport).toBe(false);
    expect(manifest.issues).toContain("NOT_REPORT_CAPABLE:basemap.carto_dark");
    expect(manifest.issues).toContain("UNKNOWN_LAYER:missing-layer");
  });

  it("preserves filters and produces stable layer ordering independent of input order", () => {
    const a = buildGeoSnapshotManifest({
      generatedAt: "2026-09-30T20:00:00.000Z",
      projectId: "p1",
      projectProfile: "cholqui",
      mode: "3d",
      engine: "deckgl",
      view: { ...VIEW, pitch: 55, bearing: -20 },
      filters: { campaignId: "c1", timeCursor: 123, highGradeOnly: true },
      visibleLayerIds: ["targets.exploration", "territory.dem"],
    });
    const b = buildGeoSnapshotManifest({
      generatedAt: "2026-09-30T20:00:00.000Z",
      projectId: "p1",
      projectProfile: "cholqui",
      mode: "3d",
      engine: "deckgl",
      view: { ...VIEW, pitch: 55, bearing: -20 },
      filters: { campaignId: "c1", timeCursor: 123, highGradeOnly: true },
      visibleLayerIds: ["territory.dem", "targets.exploration"],
    });

    expect(a.filters).toEqual({ campaignId: "c1", timeCursor: 123, highGradeOnly: true });
    expect(a.layers.map((layer) => layer.id)).toEqual(["targets.exploration", "territory.dem"]);
    expect(stableGeoSnapshotPayload(a)).toBe(stableGeoSnapshotPayload(b));
  });
});
