import { describe, expect, it } from "vitest";
import { buildPriceIndex, weightedMedian, premiumVsAnchor, type PricePoint } from "./priceIndex";

describe("weightedMedian", () => {
  it("mediana simple con pesos iguales", () => {
    expect(
      weightedMedian([
        { v: 10, w: 1 },
        { v: 20, w: 1 },
        { v: 30, w: 1 },
      ]),
    ).toBe(20);
  });
  it("el peso desplaza la mediana hacia el valor más pesado", () => {
    // 100 con peso 10 domina sobre 10 y 20
    expect(
      weightedMedian([
        { v: 10, w: 1 },
        { v: 20, w: 1 },
        { v: 100, w: 10 },
      ]),
    ).toBe(100);
  });
  it("lista vacía → 0", () => {
    expect(weightedMedian([])).toBe(0);
  });
});

describe("buildPriceIndex", () => {
  const pts: PricePoint[] = [
    { commodity: "cu_concentrate", usdPerT: 3000, kind: "trade_closed" },
    { commodity: "cu_concentrate", usdPerT: 3200, kind: "trade_closed" },
    { commodity: "cu_concentrate", usdPerT: 2000, kind: "inquiry" },
    { commodity: "au_dore", usdPerT: 60000, kind: "trade_active" },
  ];

  it("agrupa por commodity y calcula benchmark, low/high y conteos", () => {
    const idx = buildPriceIndex(pts);
    const cu = idx.find((e) => e.commodity === "cu_concentrate")!;
    expect(cu.sampleCount).toBe(3);
    expect(cu.tradeCount).toBe(2);
    expect(cu.low).toBe(2000);
    expect(cu.high).toBe(3200);
    // el benchmark ponderado ignora la consulta de baja ponderación
    expect(cu.benchmarkUsdT).toBeGreaterThanOrEqual(3000);
  });

  it("ordena por número de muestras descendente", () => {
    const idx = buildPriceIndex(pts);
    expect(idx[0].commodity).toBe("cu_concentrate");
  });

  it("descarta precios no positivos o inválidos", () => {
    const idx = buildPriceIndex([
      { commodity: "x", usdPerT: 0, kind: "trade_closed" },
      { commodity: "x", usdPerT: -5, kind: "inquiry" },
      { commodity: "x", usdPerT: NaN, kind: "inquiry" },
    ]);
    expect(idx).toHaveLength(0);
  });

  it("confianza: alta con ≥5 cierres, media con ≥2, baja con pocos", () => {
    const many = Array.from({ length: 5 }, (): PricePoint => ({
      commodity: "cu_cathode",
      usdPerT: 9000,
      kind: "trade_closed",
    }));
    expect(buildPriceIndex(many)[0].confidence).toBe("high");
    expect(
      buildPriceIndex([
        { commodity: "z", usdPerT: 1, kind: "trade_closed" },
        { commodity: "z", usdPerT: 2, kind: "trade_closed" },
      ])[0].confidence,
    ).toBe("medium");
    expect(buildPriceIndex([{ commodity: "z", usdPerT: 1, kind: "inquiry" }])[0].confidence).toBe(
      "low",
    );
  });
});

describe("premiumVsAnchor", () => {
  it("calcula el premium en % vs el ancla", () => {
    expect(premiumVsAnchor(11000, 10000)).toBeCloseTo(10, 5);
    expect(premiumVsAnchor(9000, 10000)).toBeCloseTo(-10, 5);
  });
  it("ancla nula o cero → null", () => {
    expect(premiumVsAnchor(9000, null)).toBeNull();
    expect(premiumVsAnchor(9000, 0)).toBeNull();
  });
});
