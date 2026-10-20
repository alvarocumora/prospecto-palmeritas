import { describe, expect, it } from "vitest";
import type { Feature, FeatureCollection } from "geojson";
import { listProperties, summarizeProperty } from "./propertyAnalysis";

const square: Feature = {
  type: "Feature",
  properties: { nombre: "ATACAMITA 1/20", rol: "13505-0001", hectareas: 97 },
  geometry: { type: "Polygon", coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]] },
};
const pt = (x: number, y: number, props: Record<string, unknown>): Feature => ({ type: "Feature", properties: props, geometry: { type: "Point", coordinates: [x, y] } });
const fc = (features: Feature[]): FeatureCollection => ({ type: "FeatureCollection", features });

describe("propertyAnalysis", () => {
  it("lists cadastre polygons with name and rol", () => {
    expect(listProperties(fc([square, pt(0, 0, {})])).map((o) => o.label)).toEqual(["ATACAMITA 1/20 · 13505-0001"]);
  });

  it("counts only evidence inside the property", () => {
    const s = summarizeProperty(square, [
      { id: "remote_sensing.hyperspectral", data: fc([pt(0.5, 0.5, { nombre: "Alunita", score: 0.8 }), pt(2, 2, { nombre: "Alunita" })]) },
    ]);
    expect(s.spectral.total).toBe(1);
    expect(s.spectral.byMineral[0]).toEqual({ label: "Alunita", count: 1, maxIntensity: 0.8 });
    expect(s.property.hectareas).toBe(97);
  });

  it("reports missing sources as gaps instead of filling them", () => {
    const s = summarizeProperty(square, []);
    expect(s.drillholes).toBe(0);
    expect(s.gaps).toContain("Sin sondajes ejecutados");
  });
});
