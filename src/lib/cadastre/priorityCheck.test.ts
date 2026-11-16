import { describe, it, expect } from "vitest";
import { evaluatePriority } from "./priorityCheck";

const base = { sernageomin: { hit: false }, bulletins: [], filings: [], today: "2026-11-16" };

describe("evaluatePriority", () => {
  it("SERNAGEOMIN ocupado gana sobre todo", () => {
    expect(evaluatePriority({ ...base, sernageomin: { hit: true } }).level).toBe("ocupado");
  });
  it("blanco en SERNAGEOMIN con ingreso OJV reciente es riesgo de prelación", () => {
    const r = evaluatePriority({
      ...base,
      filings: [{ label: "V-1-2026", filedAt: "2026-10-01", matter: "Pedimento minero", url: null }],
      bulletins: [{ label: "B", publishedAt: "2026-11-01", distanceKm: 1, insideGeometry: false, url: null }],
    });
    expect(r.level).toBe("riesgo_ojv");
  });
  it("publicación del Boletín a 5 km o menos condiciona la vacancia", () => {
    const r = evaluatePriority({
      ...base,
      bulletins: [{ label: "B", publishedAt: "2026-09-01", distanceKm: 5, insideGeometry: false, url: null }],
    });
    expect(r.level).toBe("condicionado");
  });
  it("publicación a más de 5 km o de hace más de 180 días no cuenta", () => {
    const r = evaluatePriority({
      ...base,
      bulletins: [
        { label: "lejos", publishedAt: "2026-11-01", distanceKm: 5.1, insideGeometry: false, url: null },
        { label: "vieja", publishedAt: "2026-05-01", distanceKm: 1, insideGeometry: false, url: null },
      ],
    });
    expect(r.level).toBe("libre_indicativo");
  });
  it("causas que no son de constitución (servidumbre) no generan riesgo OJV", () => {
    const r = evaluatePriority({
      ...base,
      filings: [{ label: "C-9", filedAt: "2026-10-01", matter: "Servidumbre minera", url: null }],
    });
    expect(r.level).toBe("libre_indicativo");
  });
  it("ordena por fecha de ingreso judicial y marca las anteriores a la propia", () => {
    const r = evaluatePriority({
      ...base,
      ownFiledAt: "2026-10-15",
      filings: [
        { label: "tarde", filedAt: "2026-11-01", matter: "Manifestación", url: null },
        { label: "temprano", filedAt: "2026-09-20", matter: "Pedimento", url: null },
      ],
    });
    expect(r.claims.map((c) => c.label)).toEqual(["temprano", "tarde"]);
    expect(r.senior.map((c) => c.label)).toEqual(["temprano"]);
  });
});
