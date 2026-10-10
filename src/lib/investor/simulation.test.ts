import { describe, expect, it } from "vitest";
import { calculateInvestmentReturn, readSimulationSearch, simulationReturnPath } from "./simulation";

describe("reference investment simulation", () => {
  it.each([0, -0.2, 0.4])("reconciles the displayed end value and annualized return for stage adjustment %s", (stage) => {
    const result = calculateInvestmentReturn(100000, 5, "base", stage);
    expect(100000 * Math.pow(1 + result.irr, 5)).toBeCloseTo(result.final, 5);
    expect(result.final / 100000).toBeCloseTo(result.multiplier);
  });
  it("does not inflate a production scenario to an arbitrary rate floor", () => {
    expect(calculateInvestmentReturn(100000, 5, "base", -0.2).irr).toBeCloseTo(0.1197022053);
  });
  it("retains the selected opportunity and inputs through the auth return URL", () => {
    const url = new URL(simulationReturnPath("listing-1", 85000, 7, "conservative"), "https://example.com");
    expect(url.pathname).toBe("/proyectos/listing-1");
    expect(readSimulationSearch(Object.fromEntries(url.searchParams), 50000, 50000, 500000)).toEqual({ amount: 85000, years: 7, scenario: "conservative" });
  });
  it("rejects invalid finance inputs and uses defaults for malformed URL values", () => {
    expect(() => calculateInvestmentReturn(0, 5, "base", 0)).toThrow();
    expect(readSimulationSearch({ simulationAmount: "Infinity", simulationYears: "-1", simulationScenario: "guaranteed" }, 50000, 50000, 500000)).toEqual({ amount: 50000, years: 5, scenario: "base" });
  });
});
