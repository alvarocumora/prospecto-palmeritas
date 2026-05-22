import { describe, expect, it } from "vitest";
import { structureToSceneGeometry, structuresToScene } from "./sceneAdapter";

const structure = {
  id: "vein-01",
  type: "vein" as const,
  name: "Main Vein",
  color: "#facc15",
  opacity: 0.6,
  vertices: [
    { x: 0, y: 0, z: 0 },
    { x: 10, y: 0, z: 5 },
    { x: 10, y: 20, z: 10 },
  ],
  metadata: { commodity: "Au" },
};

describe("geology 3D scene adapter", () => {
  it("converts a geology structure to scene geometry", () => {
    expect(structureToSceneGeometry(structure)).toMatchObject({
      id: "vein-01",
      type: "vein",
      name: "Main Vein",
      color: "#facc15",
      opacity: 0.6,
      centroid: [20 / 3, 20 / 3, 5],
      vertices: [
        [0, 0, 0],
        [10, 0, 5],
        [10, 20, 10],
      ],
      metadata: { commodity: "Au" },
    });
  });

  it("converts multiple structures", () => {
    expect(structuresToScene([structure])).toHaveLength(1);
  });
});
