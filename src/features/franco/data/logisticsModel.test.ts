import { describe, expect, it } from "vitest";
import { CHOLQUI_LOGISTICS_BENCHMARK, calculateLogistics, logisticsScale } from "./logisticsModel";

describe("Cholqui logistics engineering model", () => {
  it("models the full round trip, not only the loaded leg", () => {
    const r = calculateLogistics(CHOLQUI_LOGISTICS_BENCHMARK);
    expect(r.cycleKm).toBe(260);
    expect(r.thirdPartyClpTrip).toBe(780_000);
    expect(Math.round(r.thirdPartyClpT)).toBe(27_857);
  });

  it("sizes the fleet at 15 kt/month using 28 t payload and 1.5 cycles/day", () => {
    const r = calculateLogistics(CHOLQUI_LOGISTICS_BENCHMARK);
    expect(r.trucksRequired).toBe(14);
    expect(r.tripsPerMonth).toBeCloseTo(535.714, 3);
    expect(r.loadedTripsPerDay).toBeCloseTo(20.604, 3);
  });

  it("includes loaded and empty fuel consumption", () => {
    const r = calculateLogistics(CHOLQUI_LOGISTICS_BENCHMARK);
    expect(r.dieselLitresPerTrip).toBeCloseTo(96.429, 3);
    expect(r.dieselLitresPerMonth).toBeCloseTo(51_658.163, 3);
    expect(Math.round(r.dieselCostClpMonth)).toBe(71_908_163);
  });

  it("returns the four operating scales requested for Cholqui", () => {
    const scale = logisticsScale();
    expect(scale.map((row) => row.tonnesPerMonth)).toEqual([1_000, 5_000, 10_000, 15_000]);
    expect(scale.map((row) => row.trucksRequired)).toEqual([1, 5, 10, 14]);
  });

  it("keeps rental plus diesel separate from a fully contracted freight benchmark", () => {
    const r = calculateLogistics(CHOLQUI_LOGISTICS_BENCHMARK);
    expect(r.rentalPlusDieselClpMonth).toBeGreaterThan(r.dieselCostClpMonth);
    expect(r.thirdPartyClpMonth).toBeGreaterThan(r.rentalPlusDieselClpMonth);
  });
});
