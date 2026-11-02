import { describe, expect, it } from "vitest";
import { CHOLQUI_ENAMI } from "@/features/franco/data/cholqui";
import { calculateTilamaEnami, TILAMA_ENAMI_REFERENCE } from "./tilamaEnamiModel";

describe("Tilama ENAMI — referencia de Cholqui sin transferir reservas ni costos", () => {
  it("reutiliza la tarifa histórica de julio 2026, no una cotización vigente", () => {
    const result = calculateTilamaEnami({
      dryTonnes: 1000,
      cuTotalPct: 2,
      cuSolublePct: 1.5,
    });
    expect(result.tariffClpPerT).toBe(89_571);
    expect(result.grossClp).toBe(89_571_000);
    expect(result.copperContainedTonnes).toBe(20);
    expect(result.readiness).toBe("REFERENCE_ONLY");
    expect(result.scenarioNetClp).toBeNull();
    expect(result.missing).toHaveLength(4);
    expect(TILAMA_ENAMI_REFERENCE.tariffSource).toBe(CHOLQUI_ENAMI.circular);
  });

  it("modela tres millones de t como sensibilidad, jamás como inventario validado", () => {
    const result = calculateTilamaEnami({
      dryTonnes: 3_000_000,
      cuTotalPct: 2,
      cuSolublePct: 2,
    });
    expect(result.copperContainedTonnes).toBe(60_000);
    expect(result.tariffClpPerT).toBe(130_728.5);
    expect(result.grossClp).toBe(392_185_500_000);
    expect(result.readiness).toBe("REFERENCE_ONLY");
    expect(result.scenarioNetClp).toBeNull();
  });

  it("no acepta usar una ley soluble mayor que la ley total", () => {
    expect(() =>
      calculateTilamaEnami({ dryTonnes: 100, cuTotalPct: 1.5, cuSolublePct: 2 }),
    ).toThrow("INVALID_SOLUBLE_COPPER_GRADE");
  });

  it("deniega costos inválidos, toneladas negativas y extrapolaciones de tarifa", () => {
    expect(() =>
      calculateTilamaEnami({ dryTonnes: -10, cuTotalPct: 2, cuSolublePct: 1.5 }),
    ).toThrow("INVALID_DRY_TONNES");
    expect(() =>
      calculateTilamaEnami({ dryTonnes: 100, cuTotalPct: 2, cuSolublePct: 0.4 }),
    ).toThrow("INVALID_SOLUBLE_COPPER_GRADE");
    expect(() =>
      calculateTilamaEnami({
        dryTonnes: 100,
        cuTotalPct: 2,
        cuSolublePct: 1.5,
        freightClpPerT: -1,
      }),
    ).toThrow("INVALID_COMMERCIAL_COST");
  });

  it("descuenta costos solamente si todos fueron informados expresamente", () => {
    const base = {
      dryTonnes: 1000,
      cuTotalPct: 2,
      cuSolublePct: 1.5,
      mineCostClpPerT: 35_000,
      freightClpPerT: 15_000,
      adjustmentsClpPerT: 5_000,
    };
    const incomplete = calculateTilamaEnami(base);
    expect(incomplete.scenarioNetClp).toBeNull();
    expect(incomplete.missing).toContain("Escenario de renta minera");
    const complete = calculateTilamaEnami({ ...base, draftRoyaltyPct: 10 });
    expect(complete.deductionsClp).toBe(55_000_000);
    expect(complete.royaltyClp).toBe(8_957_100);
    expect(complete.scenarioNetClp).toBe(25_613_900);
    expect(complete.netbackClpPerT).toBe(25_613.9);
    expect(complete.readiness).toBe("REFERENCE_ONLY");
  });

  it("permite margen negativo sin convertirlo en rentabilidad prometida", () => {
    const result = calculateTilamaEnami({
      dryTonnes: 100,
      cuTotalPct: 2,
      cuSolublePct: 1.5,
      mineCostClpPerT: 100_000,
      freightClpPerT: 20_000,
      adjustmentsClpPerT: 0,
      draftRoyaltyPct: 0,
    });
    expect(result.scenarioNetClp).toBeLessThan(0);
    expect(result.readiness).toBe("REFERENCE_ONLY");
  });
});
