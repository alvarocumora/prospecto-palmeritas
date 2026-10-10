import { describe, expect, it } from "vitest";
import { buildPublicGeoManifest } from "./publicGeoContract";
import { featureEvidence, primaryFeatureEvidence } from "./featureEvidence";

describe("per-feature provenance gate", () => {
  const meta = buildPublicGeoManifest(
    { id: "project", name: "Project", center_lat: null, center_lng: null },
    ["sampling.results"],
  ).layers[0];
  it("keeps synthetic approved rows out of measured/primary evidence", () => {
    const properties = { record_status: "approved", is_synthetic: true };
    expect(featureEvidence(meta, properties)).toBe("CONCEPTUAL");
    expect(primaryFeatureEvidence(meta, properties)).toBe(false);
  });
  it("requires review before promoting a draft result to a measured layer", () => {
    expect(featureEvidence(meta, { record_status: "draft" })).toBe("DECLARADO");
    expect(primaryFeatureEvidence(meta, { record_status: "draft" })).toBe(false);
    expect(featureEvidence(meta, { record_status: "approved" })).toBe("MEDIDO");
  });
});
