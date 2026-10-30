import { describe, expect, it } from "vitest";
import {
  GEOSCENE_LAYER_BINDINGS,
  initialGeoSceneLayerIds,
  sceneBindingsForMode,
  sceneLayerEnabled,
} from "./layerPolicy";
import { getGeoLayer } from "@/lib/geospatial/layerRegistry";

describe("GeoScene3D canonical layer policy", () => {
  it("binds every runtime layer to a 3D-capable canonical definition", () => {
    for (const binding of GEOSCENE_LAYER_BINDINGS) {
      const definition = getGeoLayer(binding.canonicalId);
      expect(definition).not.toBeNull();
      expect(definition?.capabilities).toContain("3d");
    }
  });

  it("uses the official 3D preset by default", () => {
    const enabled = initialGeoSceneLayerIds();
    expect(enabled.has("territory.dem")).toBe(true);
    expect(enabled.has("targets.exploration")).toBe(true);
    expect(enabled.has("geophysics.anomalies")).toBe(true);
    expect(enabled.has("models.resource_blocks")).toBe(false);
  });

  it("keeps satellite anomalies out of subsurface mode", () => {
    const subsurface = sceneBindingsForMode("subsurface");
    expect(subsurface.some((binding) => binding.key === "satellite_anomalies")).toBe(false);
    expect(subsurface.some((binding) => binding.key === "geophysics_anomalies")).toBe(true);
  });

  it("keeps completed and proposed drilling as separate evidence layers", () => {
    const enabled = initialGeoSceneLayerIds();
    expect(sceneLayerEnabled(enabled, "drillholes_completed")).toBe(true);
    expect(sceneLayerEnabled(enabled, "drillholes_proposed")).toBe(true);
  });

  it("binds regional geophysics (EMAG2/WGM2012) in both surface and subsurface", () => {
    expect(
      sceneBindingsForMode("surface").some((binding) => binding.key === "geophysics_emag2"),
    ).toBe(true);
    expect(
      sceneBindingsForMode("subsurface").some((binding) => binding.key === "geophysics_wgm2012"),
    ).toBe(true);
  });
});
