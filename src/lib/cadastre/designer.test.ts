import { describe, it, expect } from "vitest";
import { snapRect, rectHa, clampRectHa, dragCorner, rectCells, partitionPertenencias, cellsContiguous, RULES, MAX_PERTENENCIA_HA } from "./designer";

describe("diseñador normativo", () => {
  it("ajusta vértices a múltiplos de 100 m", () => {
    expect(snapRect({ w: 301_712, s: 6_508_390, e: 302_149, n: 6_509_655 })).toEqual({ w: 301_700, s: 6_508_400, e: 302_100, n: 6_509_700 });
  });
  it("pedimento no supera 5.000 ha", () => {
    expect(RULES.pedimento.maxHa).toBe(5000);
    const r = clampRectHa({ w: 0, s: 0, e: 10_000, n: 10_000 }, 5000);
    expect(rectHa(r)).toBeLessThanOrEqual(5000);
    expect(r.w % 100 + r.e % 100 + r.n % 100).toBe(0);
  });
  it("manifestación no supera 1.000 ha", () => {
    expect(RULES.manifestacion.maxHa).toBe(1000);
  });
  it("arrastrar un vértice mantiene ejes y snap", () => {
    const r = dragCorner({ w: 0, s: 0, e: 1000, n: 1000 }, "NE", 1549, 1730);
    expect(r).toEqual({ w: 0, s: 0, e: 1500, n: 1700 });
  });
  it("pertenencias de máximo 10 ha cubren todas las celdas", () => {
    const cells = new Set(rectCells({ w: 0, s: 0, e: 2500, n: 300 })); // 75 ha
    const parts = partitionPertenencias(cells);
    expect(parts.every((p) => rectHa(p) <= MAX_PERTENENCIA_HA && rectHa(p) >= 1)).toBe(true);
    expect(parts.reduce((a, p) => a + rectHa(p), 0)).toBe(75);
  });
  it("detecta celdas no continuas", () => {
    expect(cellsContiguous(new Set(["0,0", "1,0"]))).toBe(true);
    expect(cellsContiguous(new Set(["0,0", "2,0"]))).toBe(false);
  });
});
