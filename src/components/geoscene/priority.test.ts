import { describe, expect, it } from "vitest";
import {
  filterByPriority,
  geometryHectares,
  normalizePriority,
  suggestedSamplePoints,
} from "./priority";

describe("prioridad de exploración", () => {
  it("normaliza A/B/C y P1–P3", () => {
    expect(normalizePriority({ prioridad: "A" })).toBe("P1");
    expect(normalizePriority({ priority: "p2" })).toBe("P2");
    expect(normalizePriority({ prioridad: "Baja" })).toBe("P3");
    expect(normalizePriority({ nombre: "x" })).toBeNull();
  });
  it("calcula ~100 ha para un cuadrado de 1 km", () => {
    const d = 1000 / 111320;
    const ha = geometryHectares({
      type: "Polygon",
      coordinates: [
        [
          [0, 0],
          [d, 0],
          [d, d],
          [0, d],
          [0, 0],
        ],
      ],
    });
    expect(ha).toBeGreaterThan(98);
    expect(ha).toBeLessThan(102);
  });
  it("filtra solo P1 y conserva elementos sin prioridad", () => {
    const fc = {
      type: "FeatureCollection" as const,
      features: ["A", "C", undefined].map((p) => ({
        type: "Feature" as const,
        geometry: { type: "Point" as const, coordinates: [0, 0] },
        properties: p ? { prioridad: p } : {},
      })),
    };
    expect(filterByPriority(fc, new Set(["P1"])).features).toHaveLength(2);
  });
  it("malla 200 m: 100 ha → 25 puntos", () => {
    expect(suggestedSamplePoints(100)).toBe(25);
  });
});
