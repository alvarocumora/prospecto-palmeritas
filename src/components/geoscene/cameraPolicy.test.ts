import { describe, expect, it } from "vitest";
import { projectCamera } from "./cameraPolicy";

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
