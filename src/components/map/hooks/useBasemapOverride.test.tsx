import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useBasemapOverride } from "./useBasemapOverride";

const BASEMAP_LAYER_IDS = [
  "basemap:esri-imagery",
  "basemap:esri-topo",
  "basemap:carto-dark",
  "basemap:opentopo",
] as const;

describe("useBasemapOverride", () => {
  it("makes Esri imagery the only visible basemap for satellite override", () => {
    const setVisible = vi.fn();

    renderHook(() => useBasemapOverride({ basemapOverride: "satellite", setVisible }));

    expect(setVisible).toHaveBeenCalledTimes(BASEMAP_LAYER_IDS.length);
    expect(setVisible).toHaveBeenCalledWith("basemap:esri-imagery", true);
    expect(setVisible).toHaveBeenCalledWith("basemap:esri-topo", false);
    expect(setVisible).toHaveBeenCalledWith("basemap:carto-dark", false);
    expect(setVisible).toHaveBeenCalledWith("basemap:opentopo", false);
  });

  it("makes Esri topo the only visible basemap for topo override", () => {
    const setVisible = vi.fn();

    renderHook(() => useBasemapOverride({ basemapOverride: "topo", setVisible }));

    expect(setVisible).toHaveBeenCalledTimes(BASEMAP_LAYER_IDS.length);
    expect(setVisible).toHaveBeenCalledWith("basemap:esri-imagery", false);
    expect(setVisible).toHaveBeenCalledWith("basemap:esri-topo", true);
    expect(setVisible).toHaveBeenCalledWith("basemap:carto-dark", false);
    expect(setVisible).toHaveBeenCalledWith("basemap:opentopo", false);
  });

  it("does nothing when no override is provided", () => {
    const setVisible = vi.fn();

    renderHook(() => useBasemapOverride({ basemapOverride: null, setVisible }));

    expect(setVisible).not.toHaveBeenCalled();
  });
});
