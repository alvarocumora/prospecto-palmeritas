import { describe, expect, it } from "vitest";
import { FICHAS, getFicha, simulateInvestment } from "./fichas";

describe("fichas de inversión", () => {
  it("las fichas canónicas existen y son coherentes", () => {
    for (const slug of ["palmeras", "losverdes", "cholqui"] as const) {
      const f = getFicha(slug);
      expect(f).not.toBeNull();
      expect(f!.minTicketUsd).toBeGreaterThan(0);
      expect(f!.minTicketUsd).toBeLessThanOrEqual(f!.roundSizeUsd);
      expect(f!.valuationUsd.low).toBeLessThanOrEqual(f!.valuationUsd.high);
      expect(f!.equityOfferedPct).toBeGreaterThan(0);
      expect(f!.equityOfferedPct).toBeLessThan(100);
      const pctTotal = f!.useOfFunds.reduce((a, u) => a + u.pct, 0);
      expect(pctTotal).toBe(100);
      expect(f!.scenarios.length).toBeGreaterThanOrEqual(3);
    }
  });

  it("getFicha devuelve null para slug desconocido", () => {
    expect(getFicha("nope")).toBeNull();
  });

  it("mantiene aliases históricos sin duplicar fichas", () => {
    expect(getFicha("franco")).toBe(FICHAS.cholqui);
    expect(getFicha("tilama")).toBe(FICHAS.losverdes);
  });
});

describe("simulateInvestment", () => {
  const f = FICHAS.losverdes;

  it("clampa el monto al ticket mínimo y al tamaño de la ronda", () => {
    expect(simulateInvestment(f, 0).amountUsd).toBe(f.minTicketUsd);
    expect(simulateInvestment(f, 999_999_999).amountUsd).toBe(f.roundSizeUsd);
  });

  it("participación proporcional al equity ofrecido", () => {
    const full = simulateInvestment(f, f.roundSizeUsd);
    expect(full.sharePct).toBeCloseTo(f.equityOfferedPct, 5);
    const half = simulateInvestment(f, f.roundSizeUsd / 2);
    expect(half.sharePct).toBeCloseTo(f.equityOfferedPct / 2, 5);
  });

  it("ROI y retorno bruto por escenario", () => {
    const sim = simulateInvestment(f, 100_000);
    const base = sim.rows.find((r) => r.key === "base")!;
    expect(base.grossUsd).toBeCloseTo(100_000 * base.multiple, 5);
    expect(base.profitUsd).toBeCloseTo(base.grossUsd - 100_000, 5);
    expect(base.roiPct).toBeCloseTo((base.multiple - 1) * 100, 5);
  });

  it("TIR aproximada = multiple^(1/años) - 1", () => {
    const sim = simulateInvestment(f, 100_000);
    for (const r of sim.rows) {
      const expected = (Math.pow(r.multiple, 1 / f.horizonYears) - 1) * 100;
      expect(r.irrApproxPct).toBeCloseTo(expected, 5);
    }
  });

  it("escenario conservador siempre por debajo del optimista", () => {
    const sim = simulateInvestment(f, 50_000);
    const cons = sim.rows.find((r) => r.key === "conservador")!;
    const opt = sim.rows.find((r) => r.key === "optimista")!;
    expect(cons.grossUsd).toBeLessThan(opt.grossUsd);
  });
});
