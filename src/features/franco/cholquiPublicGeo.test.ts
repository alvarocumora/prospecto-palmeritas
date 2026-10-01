import { describe, expect, it } from "vitest";
import { CHOLQUI_ASSAYS } from "./data/cholqui";
import { buildCholquiPublicGeoBundle } from "./cholquiPublicGeo";

describe("Cholqui canonical public geo bundle", () => {
  it("preserves official catastro, derived satellite evidence and measured structures", () => {
    const bundle = buildCholquiPublicGeoBundle();
    const ids = bundle.manifest.layers.map((layer) => layer.id);

    expect(ids).toContain("territory.cadastre");
    expect(ids).toContain("remote_sensing.sentinel2_alteration");
    expect(ids).toContain("geology.structures");
    expect(ids).toContain("drilling.proposed");
  });

  it("publishes only the certified assay points as sampling.assays", () => {
    const bundle = buildCholquiPublicGeoBundle();
    expect(bundle.layers["sampling.assays"]?.features).toHaveLength(CHOLQUI_ASSAYS.length);
  });

  it("keeps proposed and pending tenure layers explicitly separate from official cadastre", () => {
    const bundle = buildCholquiPublicGeoBundle();
    expect(bundle.layers["territory.cadastre"]).toBeDefined();
    expect(bundle.layers["territory.pending_pedimentos"]).toBeDefined();
    expect(bundle.layers["territory.proposed_pedimentos"]).toBeDefined();
  });

  it("publishes the IDW intensity surface reinterpolated from the same satellite anomalies", () => {
    const bundle = buildCholquiPublicGeoBundle();
    const ids = bundle.manifest.layers.map((layer) => layer.id);
    expect(ids).toContain("remote_sensing.anomaly_intensity");

    const intensity = bundle.layers["remote_sensing.anomaly_intensity"];
    const discrete = bundle.layers["remote_sensing.sentinel2_alteration"];
    expect(intensity?.features.length).toBeGreaterThan(0);
    // Reinterpola las mismas anomalías: no es una fuente de datos distinta.
    expect(discrete?.features.length).toBeGreaterThan(0);
    for (const feature of intensity?.features ?? []) {
      expect(typeof feature.properties.value).toBe("number");
      expect(feature.properties.normalized as number).toBeGreaterThanOrEqual(0);
      expect(feature.properties.normalized as number).toBeLessThanOrEqual(1);
    }
  });

  it("renders the intensity surface before the discrete anomalies (so it stays underneath)", () => {
    const bundle = buildCholquiPublicGeoBundle();
    const ids = bundle.manifest.layers.map((layer) => layer.id);
    const intensityIndex = ids.indexOf("remote_sensing.anomaly_intensity");
    const discreteIndex = ids.indexOf("remote_sensing.sentinel2_alteration");
    expect(intensityIndex).toBeGreaterThanOrEqual(0);
    expect(intensityIndex).toBeLessThan(discreteIndex);
  });
});
