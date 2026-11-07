import { describe, expect, it } from "vitest";
import { miningViewCamera, projectCamera } from "./cameraPolicy";

describe("project camera", () => {
  it("uses an overhead camera for planta without resetting the frame", () => {
    expect(projectCamera("2d")).toEqual({ pitch: 0, bearing: 0 });
    expect(projectCamera("2d")).not.toHaveProperty("center");
    expect(projectCamera("2d")).not.toHaveProperty("zoom");
  });
  it("uses an oblique camera for perspectiva without resetting the frame", () => {
    expect(projectCamera("3d")).toEqual({ pitch: 55, bearing: -20 });
    expect(projectCamera("3d")).not.toHaveProperty("center");
    expect(projectCamera("3d")).not.toHaveProperty("zoom");
  });
});

describe("mining view gizmo presets", () => {
  it("looks straight down for plan view", () => {
    expect(miningViewCamera("plan")).toEqual({ pitch: 0, bearing: 0 });
  });
  it("matches the default oblique camera for isometric", () => {
    expect(miningViewCamera("isometric")).toEqual(projectCamera("3d"));
  });
  it("orients section views toward north and east at a near-vertical pitch", () => {
    expect(miningViewCamera("section_n")).toEqual({ pitch: 80, bearing: 0 });
    expect(miningViewCamera("section_e")).toEqual({ pitch: 80, bearing: 90 });
  });
});
