import { describe, expect, it } from "vitest";
import { CHOLQUI_ASSAYS } from "./data/cholqui";
import { buildCholquiPublicGeoBundle } from "./cholquiPublicGeo";
import drillGridRaw from "@/data/geo/cholqui_drill_grid.geojson?raw";
import { parsePublishedDrillGrid, totalMeters } from "@/lib/cholqui/drillGrid";

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

  it("preserves all candidate footprints without interpolating incompatible background populations", () => {
    const bundle = buildCholquiPublicGeoBundle();
    expect(bundle.layers["remote_sensing.sentinel2_alteration"]?.features).toHaveLength(57);
    expect(bundle.layers["remote_sensing.anomaly_intensity"]).toBeUndefined();
    expect(
      bundle.manifest.layers.some((layer) => layer.id === "remote_sensing.anomaly_intensity"),
    ).toBe(false);
    expect(bundle.layers["drilling.proposed"]?.features).toHaveLength(7);
  });
  it("uses the published plan in the target table, rather than a second generated proposal", () => {
    const collars = parsePublishedDrillGrid(JSON.parse(drillGridRaw));
    const map = buildCholquiPublicGeoBundle().layers["drilling.proposed"]!;
    expect(totalMeters(collars)).toBe(1070);
    expect(collars[0]).toMatchObject({
      code: "CHO-DDH-01",
      azimuthDeg: 285,
      dipDeg: -60,
      depthM: 170,
      anomalyId: null,
    });
    expect(collars).toHaveLength(map.features.length);
    for (let i = 0; i < collars.length; i++) {
      const feature = map.features[i];
      expect([collars[i].lng, collars[i].lat]).toEqual(
        feature.geometry?.type === "Point" ? feature.geometry.coordinates : null,
      );
    }
  });

  it("rejects a published plan with missing depths instead of inventing a trace", () => {
    const raw = JSON.parse(drillGridRaw);
    delete raw.features[0].properties.depth_m;
    expect(() => parsePublishedDrillGrid(raw)).toThrow("PUBLISHED_DRILL_COLLAR_INVALID");
  });
});
