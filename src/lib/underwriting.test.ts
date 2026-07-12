import { describe, expect, it } from "vitest";
import { assessAdvance, type UnderwritingInputs } from "./underwriting";

function inp(over: Partial<UnderwritingInputs> = {}): UnderwritingInputs {
  return {
    assetTrust: 85,
    hasRedFlags: false,
    sellerReputation: 80,
    sellerTier: "established",
    lotValueUsd: 100_000,
    valuationSupported: true,
    ...over,
  };
}

describe("assessAdvance", () => {
  it("caso limpio y establecido → elegible con tasa de adelanto alta", () => {
    const r = assessAdvance(inp());
    expect(r.eligibility).toBe("eligible");
    expect(r.advanceRatePct).toBeGreaterThanOrEqual(45);
    expect(r.maxAdvanceUsd).toBe(Math.round((r.advanceRatePct / 100) * 100_000));
  });

  it("banderas rojas del KYM → no elegible", () => {
    const r = assessAdvance(inp({ hasRedFlags: true }));
    expect(r.eligibility).toBe("ineligible");
    expect(r.advanceRatePct).toBe(0);
    expect(r.maxAdvanceUsd).toBeNull();
    expect(r.conditions.length).toBeGreaterThan(0);
  });

  it("contraparte 'watch' → no elegible", () => {
    expect(assessAdvance(inp({ sellerTier: "watch" })).eligibility).toBe("ineligible");
  });

  it("sin colateral estimable → no elegible", () => {
    expect(assessAdvance(inp({ valuationSupported: false })).eligibility).toBe("ineligible");
    expect(assessAdvance(inp({ lotValueUsd: null })).eligibility).toBe("ineligible");
  });

  it("confianza del activo baja (<45) → no elegible", () => {
    expect(assessAdvance(inp({ assetTrust: 40 })).eligibility).toBe("ineligible");
  });

  it("contraparte nueva → condicional con menor tasa y condiciones", () => {
    const r = assessAdvance(inp({ sellerTier: "new", sellerReputation: 50 }));
    expect(r.eligibility).toBe("conditional");
    expect(r.advanceRatePct).toBeLessThanOrEqual(40);
    expect(r.conditions.some((c) => c.toLowerCase().includes("historial"))).toBe(true);
  });

  it("condicional cobra fee indicativo mayor que elegible", () => {
    const eligible = assessAdvance(inp());
    const conditional = assessAdvance(inp({ assetTrust: 55 }));
    expect(conditional.eligibility).toBe("conditional");
    expect(conditional.indicativeFeePct).toBeGreaterThan(eligible.indicativeFeePct);
  });

  it("riskScore combina activo (0.6) y reputación (0.4)", () => {
    const r = assessAdvance(inp({ assetTrust: 100, sellerReputation: 50 }));
    expect(r.riskScore).toBe(80); // 0.6*100 + 0.4*50
  });

  it("la tasa de adelanto nunca supera 70% ni baja de 25% cuando aplica", () => {
    const hi = assessAdvance(inp({ assetTrust: 100, sellerReputation: 100 }));
    expect(hi.advanceRatePct).toBeLessThanOrEqual(70);
    const lowCond = assessAdvance(inp({ assetTrust: 46, sellerReputation: 50, sellerTier: "new" }));
    expect(lowCond.advanceRatePct).toBeGreaterThanOrEqual(25);
  });
});
