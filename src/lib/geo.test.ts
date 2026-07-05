import { describe, expect, it } from "vitest";
import { centroidOf } from "./geo";

describe("centroidOf", () => {
  it("Point devuelve sus propias coordenadas", () => {
    expect(centroidOf({ type: "Point", coordinates: [-71.2, -31.6] })).toEqual([-71.2, -31.6]);
  });

  it("Polygon promedia los vértices", () => {
    const square = {
      type: "Polygon",
      coordinates: [
        [
          [0, 0],
          [2, 0],
          [2, 2],
          [0, 2],
        ],
      ],
    };
    expect(centroidOf(square)).toEqual([1, 1]);
  });

  it("MultiPolygon recorre anillos anidados", () => {
    const mp = {
      type: "MultiPolygon",
      coordinates: [
        [
          [
            [0, 0],
            [4, 0],
          ],
        ],
        [
          [
            [0, 4],
            [4, 4],
          ],
        ],
      ],
    };
    expect(centroidOf(mp)).toEqual([2, 2]);
  });

  it("entradas inválidas devuelven null", () => {
    expect(centroidOf(null)).toBeNull();
    expect(centroidOf(undefined)).toBeNull();
    expect(centroidOf("no soy geojson")).toBeNull();
    expect(centroidOf({ type: "Polygon" })).toBeNull();
    expect(centroidOf({ type: "Polygon", coordinates: [] })).toBeNull();
  });
});
