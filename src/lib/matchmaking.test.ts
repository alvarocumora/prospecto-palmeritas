import { describe, expect, it } from "vitest";
import {
  deriveRequirement,
  matchScore,
  rankLots,
  commodityFamily,
  type BuyerRequirement,
  type LotForMatch,
} from "./matchmaking";

describe("commodityFamily", () => {
  it("agrupa por prefijo de metal", () => {
    expect(commodityFamily("cu_concentrate")).toBe("cu");
    expect(commodityFamily("cu_cathode")).toBe("cu");
    expect(commodityFamily("au_dore")).toBe("au");
  });
});

describe("deriveRequirement", () => {
  it("ordena commodities por frecuencia y toma medianas", () => {
    const req = deriveRequirement([
      { commodity: "cu_concentrate", targetVolumeT: 100, targetPriceUsdT: 2000 },
      { commodity: "cu_concentrate", targetVolumeT: 200, targetPriceUsdT: 2200 },
      { commodity: "au_dore", targetVolumeT: 50, targetPriceUsdT: null },
    ]);
    expect(req.commodities[0]).toBe("cu_concentrate");
    expect(req.targetVolumeT).toBe(100); // mediana de 50,100,200
    expect(req.targetPriceUsdT).toBe(2100); // mediana de 2000,2200
  });
});

describe("matchScore", () => {
  const req: BuyerRequirement = {
    commodities: ["cu_concentrate"],
    targetVolumeT: 100,
    targetPriceUsdT: 2000,
  };
  const lot = (over: Partial<LotForMatch> = {}): LotForMatch => ({
    id: "l1",
    commodity: "cu_concentrate",
    tonnageAvailableT: 200,
    askingPriceUsd: 400000, // 2000/t
    premiumDiscountUsdT: null,
    ...over,
  });

  it("match perfecto → score alto con razones", () => {
    const m = matchScore(req, lot());
    expect(m.score).toBeGreaterThanOrEqual(90);
    expect(m.reasons).toContain("Mismo commodity que buscas");
    expect(m.reasons).toContain("Cubre tu volumen objetivo");
    expect(m.reasons).toContain("Precio en tu rango");
  });

  it("otra familia de commodity puntúa menos", () => {
    const m = matchScore(req, lot({ commodity: "au_dore", id: "l2" }));
    expect(m.reasons).not.toContain("Mismo commodity que buscas");
    expect(m.score).toBeLessThan(matchScore(req, lot()).score);
  });

  it("volumen insuficiente escala parcial", () => {
    const m = matchScore(req, lot({ tonnageAvailableT: 50 }));
    expect(m.reasons.some((r) => r.includes("% de tu volumen"))).toBe(true);
  });

  it("score se mantiene en 0..100", () => {
    const m = matchScore(req, lot());
    expect(m.score).toBeGreaterThanOrEqual(0);
    expect(m.score).toBeLessThanOrEqual(100);
  });
});

describe("rankLots", () => {
  it("ordena por score y filtra los bajos", () => {
    const req: BuyerRequirement = {
      commodities: ["cu_concentrate"],
      targetVolumeT: 100,
      targetPriceUsdT: 2000,
    };
    const lots: LotForMatch[] = [
      {
        id: "match",
        commodity: "cu_concentrate",
        tonnageAvailableT: 200,
        askingPriceUsd: 400000,
        premiumDiscountUsdT: null,
      },
      {
        id: "off",
        commodity: "fe_ore",
        tonnageAvailableT: 5,
        askingPriceUsd: null,
        premiumDiscountUsdT: null,
      },
    ];
    const ranked = rankLots(req, lots);
    expect(ranked[0].lotId).toBe("match");
    expect(ranked.some((r) => r.lotId === "off")).toBe(false);
  });
});
