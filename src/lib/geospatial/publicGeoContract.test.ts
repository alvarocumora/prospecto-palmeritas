import { describe, expect, it } from "vitest";
import {
  buildPublicGeoManifest,
  isCertificationEvidence,
} from "./publicGeoContract";

const project = {
  id: "p1",
  name: "Proyecto público",
  center_lat: -33.8,
  center_lng: -71.1,
};

describe("public canonical geospatial contract", () => {
  it("builds the public_live manifest from canonical layer definitions", () => {
    const manifest = buildPublicGeoManifest(project);
    expect(manifest.schemaVersion).toBe(1);
    expect(manifest.presetId).toBe("public_live");
    expect(manifest.layers.map((layer) => layer.id)).toContain("territory.cadastre");
    expect(manifest.layers.map((layer) => layer.id)).toContain("targets.exploration");
    expect(manifest.layers.map((layer) => layer.id)).toContain("sampling.results");
    expect(manifest.layers.map((layer) => layer.id)).toContain("sampling.assays");
    expect(manifest.layers.every((layer) => Boolean(layer.evidence))).toBe(true);
  });

  it("rejects authenticated-only layers from a public manifest", () => {
    expect(() =>
      buildPublicGeoManifest(project, ["geophysics.project_stations"]),
    ).toThrow(/not public-capable/);
  });
  it("defines certification mode from evidence class rather than project-specific flags", () => {
    expect(isCertificationEvidence("OFICIAL")).toBe(true);
    expect(isCertificationEvidence("CERTIFICADO")).toBe(true);
    expect(isCertificationEvidence("MEDIDO")).toBe(true);
    expect(isCertificationEvidence("DERIVADO")).toBe(false);
    expect(isCertificationEvidence("INTERPRETADO")).toBe(false);
    expect(isCertificationEvidence("PROPUESTO")).toBe(false);
  });

});
