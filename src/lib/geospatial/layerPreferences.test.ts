import { describe, expect, it } from "vitest";
import { parseLayerPreferences, preferenceLayerId } from "./layerPreferences";
import { applyLayerOpacity } from "./leafletOpacity";
import type { Layer } from "leaflet";

describe("project layer preferences", () => {
  it("shares legacy 2D and canonical 3D layer choices", () => {
    expect(preferenceLayerId("halos")).toBe("remote_sensing.sentinel2_alteration");
    expect(parseLayerPreferences('{"halos":{"visible":false,"opacity":0.4}}'))
      .toEqual({ "remote_sensing.sentinel2_alteration": { visible: false, opacity: 0.4 } });
  });
  it("rejects malformed or out-of-range stored preferences", () => {
    expect(parseLayerPreferences("{")).toEqual({});
    expect(parseLayerPreferences("[]")).toEqual({});
    expect(parseLayerPreferences('{"halos":{"visible":"false","opacity":1}}')).toEqual({});
    expect(parseLayerPreferences('{"halos":{"visible":true,"opacity":2}}')).toEqual({});
  });
  it("restores original nested vector and tile styles after changing opacity", () => {
    const path = {
      options: { opacity: 0.8, fillOpacity: 0.12 },
      setStyle(style: { opacity: number; fillOpacity: number }) { this.options = style; },
    };
    const tile = { options: { opacity: 0.6 }, setOpacity(value: number) { this.options.opacity = value; } };
    const group = { eachLayer(fn: (layer: Layer) => void) {
      fn(path as unknown as Layer); fn(tile as unknown as Layer);
    } };
    applyLayerOpacity(group as unknown as Layer, 0.5);
    expect(path.options).toEqual({ opacity: 0.4, fillOpacity: 0.06 });
    expect(tile.options.opacity).toBe(0.3);
    applyLayerOpacity(group as unknown as Layer, 1);
    expect(path.options).toEqual({ opacity: 0.8, fillOpacity: 0.12 });
    expect(tile.options.opacity).toBe(0.6);
  });
});
