import { describe, expect, it } from "vitest";
import { buildGeoSnapshotManifest } from "./snapshotManifest";
import { buildReportMapBlock } from "./reportSnapshot";

const view = {
  center: { lng: -70.5, lat: -30.1 },
  bounds: { west: -70.6, south: -30.2, east: -70.4, north: -30.0 },
  zoom: 12,
};

describe("report geo snapshot handoff", () => {
  it("attaches the canonical manifest to a report map block", () => {
    const manifest = buildGeoSnapshotManifest({
      generatedAt: "2026-09-30T20:00:00.000Z",
      projectId: "p1",
      projectProfile: "cholqui",
      mode: "2d",
      engine: "leaflet",
      preset: "official_workbench",
      view,
      visibleLayerIds: ["territory.cadastre", "sampling.assays"],
    });

    const block = buildReportMapBlock({
      title: "Mapa de evidencia",
      imageDataUrl: "data:image/png;base64,AA==",
      manifest,
      imagery: "Esri World Imagery",
    });

    expect(block.snapshotManifest).toBe(manifest);
    expect(block.crs).toBe("EPSG:4326");
    expect(block.source).toContain("SERNAGEOMIN");
  });

  it("refuses a report block when visible viewer state is not report-eligible", () => {
    const manifest = buildGeoSnapshotManifest({
      projectId: "p1",
      mode: "2d",
      engine: "leaflet",
      view,
      visibleLayerIds: ["basemap:carto-dark"],
    });

    expect(() =>
      buildReportMapBlock({
        title: "Mapa inválido",
        imageDataUrl: "data:image/png;base64,AA==",
        manifest,
      }),
    ).toThrow(/not report-eligible/i);
  });
});
