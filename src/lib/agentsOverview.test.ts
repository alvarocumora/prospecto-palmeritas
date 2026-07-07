import { describe, expect, it } from "vitest";
import { lotHealth, classifyMarket, type LotHealthInput } from "./agentsOverview";

function h(over: Partial<LotHealthInput> = {}): LotHealthInput {
  return {
    trustLevel: "high",
    redFlagCount: 0,
    valuationSupported: true,
    marketVerdict: "en_mercado",
    ...over,
  };
}

describe("lotHealth", () => {
  it("banderas rojas → riesgo", () => {
    expect(lotHealth(h({ redFlagCount: 2 })).health).toBe("risk");
  });
  it("confianza baja → riesgo", () => {
    expect(lotHealth(h({ trustLevel: "low" })).health).toBe("risk");
  });
  it("confianza media → atención", () => {
    expect(lotHealth(h({ trustLevel: "medium" })).health).toBe("attention");
  });
  it("precio sobre mercado → atención", () => {
    expect(lotHealth(h({ marketVerdict: "sobre_mercado" })).health).toBe("attention");
  });
  it("sin valorización → atención", () => {
    expect(lotHealth(h({ valuationSupported: false })).health).toBe("attention");
  });
  it("verificado y en mercado → sano", () => {
    expect(lotHealth(h()).health).toBe("healthy");
  });
  it("verificado y bajo mercado → sano y competitivo", () => {
    const r = lotHealth(h({ marketVerdict: "bajo_mercado" }));
    expect(r.health).toBe("healthy");
    expect(r.headline).toContain("competitivo");
  });
  it("riesgo tiene prioridad sobre precio", () => {
    expect(lotHealth(h({ redFlagCount: 1, marketVerdict: "bajo_mercado" })).health).toBe("risk");
  });
});

describe("classifyMarket", () => {
  it("dentro del ±10% → en mercado", () => {
    expect(classifyMarket(105, 100).verdict).toBe("en_mercado");
  });
  it("sobre +10% → sobre mercado", () => {
    expect(classifyMarket(130, 100).verdict).toBe("sobre_mercado");
  });
  it("bajo −10% → bajo mercado", () => {
    expect(classifyMarket(80, 100).verdict).toBe("bajo_mercado");
  });
  it("sin datos → sin_datos", () => {
    expect(classifyMarket(null, 100).verdict).toBe("sin_datos");
    expect(classifyMarket(100, null).verdict).toBe("sin_datos");
  });
});
