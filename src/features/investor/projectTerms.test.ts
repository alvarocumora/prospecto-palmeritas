import { describe, it, expect } from "vitest";
import { REFERENCE_VALUATION_USD, pctOfSpvCapital } from "./projectTerms";

describe("términos de ronda", () => {
  it("valuación de referencia USD 15.000.000", () => {
    expect(REFERENCE_VALUATION_USD).toBe(15_000_000);
  });
  it("ticket mínimo de 150 acciones = 0,10 % del capital de la SPV", () => {
    expect(pctOfSpvCapital(150)).toBeCloseTo(0.1, 6);
  });
});
