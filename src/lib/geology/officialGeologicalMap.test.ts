import { describe, expect, it } from "vitest";
import { projectBBox, sheetsForBBox } from "./officialGeologicalMap";

describe("carta geológica oficial", () => {
  it("Los Verdes (Tilama) intersecta la Carta Illapel M431", () => {
    const ids = sheetsForBBox(
      projectBBox([-71.11, -32.0], [-71.173, -32.072, -71.058, -31.971]),
    ).map((s) => s.id);
    expect(ids).toEqual(["M431"]);
  });
  it("Cholqui (Melipilla) no tiene carta vectorial publicada: no se dibuja nada", () => {
    expect(
      sheetsForBBox(projectBBox([-71.05, -33.85], [-71.135, -33.94, -70.953, -33.762])),
    ).toEqual([]);
  });
});
