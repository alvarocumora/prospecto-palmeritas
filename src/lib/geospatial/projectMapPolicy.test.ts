import { describe, expect, it } from "vitest";
import { layerStateForPreset } from "./projectMapPolicy";

describe("ProjectMap canonical preset policy", () => {
  it("enables official evidence and hides planned geophysics by default", () => {
    const state = layerStateForPreset(
      {
        "concessions:project": { visible: false, opacity: 1 },
        "geophys:real": { visible: false, opacity: 1 },
        "geophys:planned": { visible: true, opacity: 1 },
        "targets:project": { visible: false, opacity: 1 },
      },
      "official_workbench",
    );

    expect(state["concessions:project"].visible).toBe(true);
    expect(state["geophys:real"].visible).toBe(true);
    expect(state["geophys:planned"].visible).toBe(false);
    expect(state["targets:project"].visible).toBe(true);
  });

  it("does not override basemap selection", () => {
    const state = layerStateForPreset(
      {
        "basemap:esri-imagery": { visible: true, opacity: 1 },
        "basemap:esri-topo": { visible: false, opacity: 1 },
      },
      "official_workbench",
    );
    expect(state["basemap:esri-imagery"].visible).toBe(true);
    expect(state["basemap:esri-topo"].visible).toBe(false);
  });
});
