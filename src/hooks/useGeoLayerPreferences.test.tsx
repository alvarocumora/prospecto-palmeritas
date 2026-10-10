/** @vitest-environment jsdom */
import { afterEach, describe, expect, it } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import { useGeoLayerPreferences } from "./useGeoLayerPreferences";

afterEach(() => { cleanup(); window.localStorage.clear(); });

describe("layer preference continuity", () => {
  it("restores visibility and opacity when switching from Cholqui 2D aliases to 3D IDs", () => {
    const twoD = renderHook(() => useGeoLayerPreferences("cholqui", { halos: true, relieve: false }));
    act(() => {
      twoD.result.current.setVisible((state) => ({ ...state, halos: false }));
      twoD.result.current.setOpacity((state) => ({ ...state, halos: 0.35 }));
    });
    twoD.unmount();
    const threeD = renderHook(() => useGeoLayerPreferences("cholqui", { "remote_sensing.sentinel2_alteration": true }));
    expect(threeD.result.current.visible["remote_sensing.sentinel2_alteration"]).toBe(false);
    expect(threeD.result.current.opacity["remote_sensing.sentinel2_alteration"]).toBe(0.35);
    expect(JSON.parse(window.localStorage.getItem("geo-layer-preferences:cholqui")!)["territory.hillshade"]).toBeDefined();
  });

  it("does not carry one project's preferences into another project", () => {
    window.localStorage.setItem("geo-layer-preferences:cholqui", JSON.stringify({
      "remote_sensing.sentinel2_alteration": { visible: false, opacity: 0.2 },
    }));
    const hook = renderHook(({ project }) => useGeoLayerPreferences(project, { halos: true }),
      { initialProps: { project: "cholqui" } });
    expect(hook.result.current.visible.halos).toBe(false);
    hook.rerender({ project: "palmeras" });
    expect(hook.result.current.visible.halos).toBe(true);
    expect(hook.result.current.opacity.halos).toBe(1);
  });
});
