import { describe, expect, it } from "vitest";
import { featureFacts, provenanceLabel } from "./featureFacts";

describe("ficha del elemento", () => {
  it("muestra los atributos reales de una pertenencia SERNAGEOMIN", () => {
    const facts = featureFacts({ NOMBRE: "X", NUMERO_ROL: "13202-0001", HECTAREAS: 200, OBJECTID: 9 });
    expect(facts).toEqual([
      { label: "Rol", value: "13202-0001" },
      { label: "Hectáreas", value: "200" },
    ]);
  });
  it("no inventa campos ausentes ni vacíos", () => {
    expect(featureFacts({ manteo: "", rumbo: null })).toEqual([]);
  });
  it("traduce la procedencia modelada", () => {
    expect(provenanceLabel("modelled")).toBe("MODELADO");
  });
});
