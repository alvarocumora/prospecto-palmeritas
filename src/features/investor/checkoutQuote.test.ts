import { describe, expect, it } from "vitest";
import { checkoutQuote } from "./checkoutQuote";

describe("checkoutQuote", () => {
  it("USD 15.000 = 150 acciones = 1 % de la ronda", () => {
    const q = checkoutQuote(15_000);
    expect(q).toMatchObject({ shares: 150, valid: true });
    expect(q.pctOfRound).toBeCloseTo(1);
  });
  it("rechaza montos bajo el mínimo de USD 15.000", () => {
    expect(checkoutQuote(14_900).valid).toBe(false);
  });
  it("rechaza montos sobre la ronda de USD 1,5 M", () => {
    expect(checkoutQuote(1_500_100).valid).toBe(false);
  });
  it("exige múltiplos del precio de USD 100", () => {
    expect(checkoutQuote(15_050).valid).toBe(false);
  });
});
