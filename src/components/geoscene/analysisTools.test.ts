import { describe, expect, it } from "vitest";
import type { FeatureCollection } from "geojson";
import { filterSpectral, haversine, polygonArea, schmidtPole } from "./analysisTools";

const pt = (nombre: string, score: number) => ({
  type: "Feature" as const,
  geometry: { type: "Point" as const, coordinates: [0, 0] },
  properties: { nombre, score },
});
const fc: FeatureCollection = {
  type: "FeatureCollection",
  features: [
    ...Array.from({ length: 10 }, (_, i) => pt("Alunita", i / 10)),
    pt("Óxidos de hierro", 0.9),
  ],
};

describe("herramientas de análisis", () => {
  it("Top 10 % deja solo la alunita más intensa y quita óxidos si se pide", () => {
    const out = filterSpectral(fc, "p90", false);
    expect(out.features.map((f) => f.properties?.score)).toEqual([0.9]);
  });
  it("Todas conserva los óxidos solo si se incluyen", () => {
    expect(filterSpectral(fc, "all", true).features).toHaveLength(11);
    expect(filterSpectral(fc, "all", false).features).toHaveLength(10);
  });
  it("1° de latitud ≈ 111,2 km", () => {
    expect(haversine([0, 0], [0, 1]) / 1000).toBeCloseTo(111.2, 0);
  });
  it("cuadrado de 0,01° en el ecuador ≈ 1,24 km²", () => {
    const a = polygonArea([[0, 0], [0.01, 0], [0.01, 0.01], [0, 0.01]]);
    expect(a / 1e6).toBeCloseTo(1.24, 1);
  });
  it("plano horizontal → polo al centro; vertical → polo en el borde", () => {
    const h = schmidtPole({ code: "a", strikeDeg: 0, dipDeg: 0, dipDirectionDeg: 90 });
    expect(Math.hypot(h.x, h.y)).toBeCloseTo(0, 5);
    const v = schmidtPole({ code: "b", strikeDeg: 0, dipDeg: 90, dipDirectionDeg: 90 });
    expect(Math.hypot(v.x, v.y)).toBeCloseTo(1, 5);
  });
});
