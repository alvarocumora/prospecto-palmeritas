import { describe, expect, it } from "vitest";
import {
  computePayableValue,
  normalizeDeleterious,
  type PayableInput,
  LB_PER_TONNE,
} from "./payableValue";

function base(over: Partial<PayableInput> = {}): PayableInput {
  return {
    commodity: "cu_concentrate",
    gradePct: 28,
    moisturePct: 8,
    tonnage: 500,
    deleterious: { AS: 0.5 },
    prices: { cuUsdT: 9000, auUsdOz: 2400, agUsdOz: 30 },
    ...over,
  };
}

describe("computePayableValue · concentrado de cobre", () => {
  it("calcula pago neto con TC/RC, castigo de As y humedad", () => {
    const r = computePayableValue(base());
    expect(r.supported).toBe(true);
    // payable Cu = 27% → 0.27 t/dmt
    expect(r.grossUsdT).toBeCloseTo(0.27 * 9000, 2); // 2430
    expect(r.tcUsdT).toBe(80);
    expect(r.rcUsdT).toBeCloseTo(0.27 * LB_PER_TONNE * 0.08, 2); // ~47.62
    // As 0.5% → 3 tramos × 2.5 = 7.5
    expect(r.penaltiesUsdT).toBeCloseTo(7.5, 5);
    expect(r.netUsdDmt).toBeCloseTo(2430 - 80 - 47.6198 - 7.5, 1);
    // humedad 8% → wmt = dmt × 0.92
    expect(r.netUsdWmt).toBeCloseTo(r.netUsdDmt * 0.92, 3);
    // total = neto/dmt × toneladas secas (500 × 0.92 = 460)
    expect(r.netTotalUsd).toBeCloseTo(r.netUsdDmt * 460, 0);
    expect(r.band.low).toBeCloseTo(r.netUsdDmt * 0.9, 4);
    expect(r.band.high).toBeCloseTo(r.netUsdDmt * 1.1, 4);
  });

  it("el castigo escala por tramos sobre el umbral", () => {
    const low = computePayableValue(base({ deleterious: { AS: 0.2 } })); // en umbral → 0
    const high = computePayableValue(base({ deleterious: { AS: 0.9 } })); // 7 tramos × 2.5 = 17.5
    expect(low.penaltiesUsdT).toBe(0);
    expect(high.penaltiesUsdT).toBeCloseTo(17.5, 5);
  });

  it("advierte cuando no se declaran impurezas", () => {
    const r = computePayableValue(base({ deleterious: {} }));
    expect(r.penaltiesUsdT).toBe(0);
    expect(r.notes.some((n) => n.includes("no declaró impurezas"))).toBe(true);
  });

  it("sin precio de cobre → no soportado", () => {
    const r = computePayableValue(base({ prices: { cuUsdT: null, auUsdOz: null, agUsdOz: null } }));
    expect(r.supported).toBe(false);
  });

  it("sin ley → no soportado", () => {
    const r = computePayableValue(base({ gradePct: null }));
    expect(r.supported).toBe(false);
  });
});

describe("computePayableValue · cátodo y precious", () => {
  it("cátodo de cobre ≈ LME × pureza, sin TC/RC", () => {
    const r = computePayableValue(
      base({ commodity: "cu_cathode", gradePct: 99.95, moisturePct: 0 }),
    );
    expect(r.supported).toBe(true);
    expect(r.tcUsdT).toBe(0);
    expect(r.netUsdDmt).toBeCloseTo(0.9995 * 9000, 1);
  });

  it("oro doré valoriza onzas pagables menos refinación", () => {
    const r = computePayableValue(base({ commodity: "au_dore", gradePct: 90, moisturePct: 0 }));
    expect(r.supported).toBe(true);
    expect(r.grossUsdT).toBeGreaterThan(0);
    expect(r.rcUsdT).toBeGreaterThan(0);
    expect(r.netUsdDmt).toBeLessThan(r.grossUsdT);
  });

  it("commodity sin modelo → no soportado", () => {
    const r = computePayableValue(base({ commodity: "fe_ore" }));
    expect(r.supported).toBe(false);
  });
});

describe("normalizeDeleterious", () => {
  it("acepta objeto {As: 0.5}", () => {
    expect(normalizeDeleterious({ As: 0.5, sb: "0.1" })).toEqual({ AS: 0.5, SB: 0.1 });
  });
  it("acepta arreglo [{element, value}]", () => {
    expect(
      normalizeDeleterious([
        { element: "As", value: 0.5 },
        { code: "Hg", pct: 0.002 },
      ]),
    ).toEqual({ AS: 0.5, HG: 0.002 });
  });
  it("ignora entradas inválidas", () => {
    expect(normalizeDeleterious(null)).toEqual({});
    expect(normalizeDeleterious([{ element: "As", value: "x" }])).toEqual({});
  });
});
