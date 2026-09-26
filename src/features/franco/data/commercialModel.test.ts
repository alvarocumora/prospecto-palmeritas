import { describe, expect, it } from "vitest";
import { CHOLQUI_PLAN_TONNES } from "./cholqui";
import { buildRamp, DEFAULT_PLAN } from "./minePlan";
import {
  LEGACY_FREIGHT_ASSUMPTION,
  auditDeclaredProductionPlan,
  capRampToTonnes,
  commercialNetback,
  freightCostClpT,
  isDecisionGradeCommercialCase,
} from "./commercialModel";

describe("Cholqui production-plan audit", () => {
  it("detects the declared-tonnage mismatch instead of hiding it", () => {
    const audit = auditDeclaredProductionPlan();
    expect(audit.declaredTonnes).toBe(166_500);
    expect(audit.mathematicalRampTonnes).toBe(270_167);
    expect(audit.deltaTonnes).toBe(103_667);
    expect(audit.consistent).toBe(false);
    expect(audit.declaredVsConceptual).toBeCloseTo(2.7407, 3);
  });

  it("can cap the mathematical ramp to the declared tonnes explicitly", () => {
    const capped = capRampToTonnes(buildRamp(DEFAULT_PLAN), CHOLQUI_PLAN_TONNES);
    expect(capped).toHaveLength(24);
    expect(capped.reduce((sum, tonnes) => sum + tonnes, 0)).toBe(CHOLQUI_PLAN_TONNES);
    expect(capped[17]).toBe(1_333);
    expect(capped.slice(18).every((tonnes) => tonnes === 0)).toBe(true);
  });
});

describe("Cholqui freight and netback", () => {
  it("keeps the historical 130 km freight as an assumption, not a quote", () => {
    expect(LEGACY_FREIGHT_ASSUMPTION.status).toBe("PLANNING_ASSUMPTION");
    expect(freightCostClpT(130, 90)).toBe(11_700);
  });

  it("calculates mine netback after explicit commercial deductions", () => {
    const n = commercialNetback({
      gradePct: 1.5,
      freightClpT: 11_700,
      acidAdjustmentClpT: 5_000,
      moistureAdjustmentClpT: 1_000,
      penaltiesClpT: 500,
    });
    expect(Math.round(n.grossSettlementClpT)).toBe(89_571);
    expect(n.deductionsClpT).toBe(18_200);
    expect(Math.round(n.mineNetbackClpT)).toBe(71_371);
  });

  it("blocks decision-grade status while any commercial DD gate is open", () => {
    expect(
      isDecisionGradeCommercialCase({
        inventoryValidated: true,
        metallurgyValidated: true,
        productAcceptanceValidated: true,
        roadDistanceValidated: true,
        freightQuoteValidated: false,
        settlementQuoteValidated: true,
      }),
    ).toBe(false);
  });

  it("only becomes decision-grade when every gate is verified", () => {
    expect(
      isDecisionGradeCommercialCase({
        inventoryValidated: true,
        metallurgyValidated: true,
        productAcceptanceValidated: true,
        roadDistanceValidated: true,
        freightQuoteValidated: true,
        settlementQuoteValidated: true,
      }),
    ).toBe(true);
  });
});
