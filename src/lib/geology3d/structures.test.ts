import { describe, expect, it } from "vitest";
import {
  calculateStructureBounds,
  calculateStructureCentroid,
  estimateStructureStrike,
  structureToSceneObject,
} from "./structures";

const vertices = [
  { x: 0, y: 0, z: 0 },
  { x: 10, y: 0, z: 5 },
  { x: 10, y: 20, z: 10 },
];

describe("geology 3D structure helpers", () => {
  it("calculates bounds", () => {
    expect(calculateStructureBounds(vertices)).toEqual({
      min: { x: 0, y: 0, z: 0 },
      max: { x: 10, y: 20, z: 10 },
      width: 10,
      height: 20,
      depth: 10,
    });
  });

  it("calculates centroid", () => {
    expect(calculateStructureCentroid(vertices)).toEqual({
      x: 20 / 3,
      y: 20 / 3,
      z: 5,
    });
  });

  it("estimates strike", () => {
    expect(estimateStructureStrike(vertices)).not.toBeNull();
  });

  it("creates scene-ready structures", () => {
    const structure = structureToSceneObject({
      id: "fault-01",
      type: "fault",
      name: "Main Fault",
      vertices,
      color: "#ff0000",
      opacity: 0.5,
      depthFromM: 50,
      depthToM: 250,
    });

    expect(structure).toMatchObject({
      id: "fault-01",
      type: "fault",
      color: "#ff0000",
      opacity: 0.5,
      depthFromM: 50,
      depthToM: 250,
    });
  });
});
