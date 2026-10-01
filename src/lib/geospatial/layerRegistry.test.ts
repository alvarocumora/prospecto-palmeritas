import { describe, expect, it } from "vitest";
import {
  GEO_LAYER_REGISTRY,
  GEO_VIEWER_PRESETS,
  getGeoLayer,
  layersForCapability,
  resolveGeoLayer,
} from "./layerRegistry";

describe("canonical geospatial layer registry", () => {
  it("has unique canonical ids and migration aliases", () => {
    expect(new Set(GEO_LAYER_REGISTRY.map((layer) => layer.id)).size).toBe(
      GEO_LAYER_REGISTRY.length,
    );
    const aliases = GEO_LAYER_REGISTRY.flatMap((layer) => [...layer.legacyAliases]);
    expect(new Set(aliases).size).toBe(aliases.length);
  });

  it("resolves current 2D and master-viewer identifiers to one canonical layer", () => {
    expect(resolveGeoLayer("tenencia")?.id).toBe("territory.cadastre");
    expect(resolveGeoLayer("concessions:project")?.id).toBe("territory.cadastre");
    expect(resolveGeoLayer("magneticaRegional")?.id).toBe("geophysics.emag2");
    expect(resolveGeoLayer("geophys:emag2")?.id).toBe("geophysics.emag2");
    expect(resolveGeoLayer("ensayes")?.id).toBe("sampling.assays");
    expect(resolveGeoLayer("samples:project")?.id).toBe("sampling.assays");
    expect(resolveGeoLayer("sat:s2-truecolor")?.id).toBe("remote_sensing.sentinel2_truecolor");
    expect(resolveGeoLayer("geo:prospect")?.id).toBe("territory.project_center");
    expect(resolveGeoLayer("geophys:planned")?.id).toBe("geophysics.planned_survey");
    expect(resolveGeoLayer("geophys:hillshade")?.id).toBe("territory.hillshade");
  });

  it("keeps regional geophysics explicitly contextual", () => {
    const emag2 = getGeoLayer("geophysics.emag2");
    expect(emag2?.use).toBe("context");
    expect(emag2?.scaleLabel).toContain("regional");
    expect(emag2?.caution).toContain("Contexto regional");
  });

  it("defines presets from canonical ids only", () => {
    for (const preset of GEO_VIEWER_PRESETS) {
      for (const id of preset.enabled) expect(getGeoLayer(id)).not.toBeNull();
    }
  });

  it("exposes report-capable evidence without importing renderer implementations", () => {
    const reportLayers = layersForCapability("report");
    expect(reportLayers.some((layer) => layer.id === "targets.exploration")).toBe(true);
    expect(reportLayers.some((layer) => layer.id === "models.implicit_geology")).toBe(true);
  });
  it("keeps the official 3D preset restricted to 3D-capable layers", () => {
    const preset = GEO_VIEWER_PRESETS.find((item) => item.id === "official_3d");
    expect(preset).toBeDefined();
    for (const id of preset?.enabled ?? []) {
      expect(getGeoLayer(id)?.capabilities).toContain("3d");
    }
    expect(preset?.enabled).toContain("drilling.completed");
    expect(preset?.enabled).toContain("drilling.proposed");
    expect(preset?.enabled).toContain("geophysics.anomalies");
  });
});
