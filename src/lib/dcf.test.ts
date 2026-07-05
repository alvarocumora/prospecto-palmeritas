import { describe, expect, it } from "vitest";
import {
  ANNUAL_THROUGHPUT,
  GRAMS_PER_TROY_OZ,
  grossRevenue,
  npvAt,
  simulate,
  solveIRR,
  type SimInputs,
} from "./dcf";

const BASE: SimInputs = {
  commodity: "Au",
  price: 2350,
  ore_t: 5_000_000,
  grade: 1.5,
  recovery: 92,
  mining_cost: 4.5,
  processing_cost: 22,
  capex: 50_000_000,
  discount_rate: 8,
};

describe("grossRevenue", () => {
  it("convierte Au de g/t a onzas troy", () => {
    // 1 Mt a 1 g/t y 100% recuperación = 1.000.000 g = 32.150,7 oz
    const rev = grossRevenue("Au", 2000, 1_000_000, 1, 100);
    expect(rev).toBeCloseTo((1_000_000 / GRAMS_PER_TROY_OZ) * 2000, 0);
  });

  it("convierte Cu de % a libras", () => {
    // 1 Mt a 1% Cu = 10.000 t Cu = 22.046.200 lb
    const rev = grossRevenue("Cu", 4, 1_000_000, 1, 100);
    expect(rev).toBeCloseTo(10_000 * 2204.62 * 4, 0);
  });

  it("convierte Li a carbonato equivalente (×5.323)", () => {
    const rev = grossRevenue("Li", 15_000, 1_000_000, 1, 100);
    expect(rev).toBeCloseTo(10_000 * 5.323 * 15_000, 0);
  });

  it("la recuperación escala linealmente", () => {
    const full = grossRevenue("Au", 2000, 1_000_000, 1, 100);
    const half = grossRevenue("Au", 2000, 1_000_000, 1, 50);
    expect(half).toBeCloseTo(full / 2, 6);
  });
});

describe("npvAt", () => {
  it("a tasa 0 es flujo total menos capex", () => {
    expect(npvAt(10, 25, 5, 0)).toBeCloseTo(10 * 5 - 25, 10);
  });

  it("descuenta a mayor tasa, menor VPN", () => {
    expect(npvAt(10, 25, 5, 0.15)).toBeLessThan(npvAt(10, 25, 5, 0.05));
  });
});

describe("solveIRR", () => {
  it("devuelve null si el flujo anual no es positivo", () => {
    expect(solveIRR(0, 100, 5)).toBeNull();
    expect(solveIRR(-10, 100, 5)).toBeNull();
  });

  it("devuelve null si el proyecto nunca recupera el capex", () => {
    expect(solveIRR(10, 100, 5)).toBeNull(); // 50 < 100
  });

  it("la TIR anula el VPN (definición)", () => {
    const irr = solveIRR(30, 100, 10);
    expect(irr).not.toBeNull();
    expect(npvAt(30, 100, 10, irr!)).toBeCloseTo(0, 4);
  });

  it("capea en 500% para proyectos absurdamente rentables", () => {
    expect(solveIRR(1_000_000, 1, 5)).toBe(5);
  });
});

describe("simulate", () => {
  it("vida de mina = ceil(tonelaje / throughput)", () => {
    expect(simulate(BASE).mine_life).toBe(Math.ceil(BASE.ore_t / ANNUAL_THROUGHPUT));
    expect(simulate({ ...BASE, ore_t: 500_000 }).mine_life).toBe(1);
  });

  it("caso base Au es rentable y coherente", () => {
    const out = simulate(BASE);
    expect(out.gross_revenue).toBeGreaterThan(out.total_opex);
    expect(out.ebitda).toBeCloseTo(out.gross_revenue - out.total_opex, 6);
    expect(out.npv).toBeGreaterThan(0);
    expect(out.irr).not.toBeNull();
    expect(out.payback).toBeGreaterThan(0);
    expect(out.cashflows).toHaveLength(out.mine_life + 1);
    expect(out.cashflows[0]).toBe(-BASE.capex);
  });

  it("proyecto con ley marginal reporta pérdida sin TIR ni payback", () => {
    const out = simulate({ ...BASE, grade: 0.1, price: 1500 });
    expect(out.ebitda).toBeLessThan(0);
    expect(out.irr).toBeNull();
    expect(out.payback).toBeNull();
    expect(out.npv).toBeLessThan(0);
  });

  it("margen EBITDA acotado entre -∞ y 100", () => {
    const out = simulate(BASE);
    expect(out.ebitda_margin).toBeLessThanOrEqual(100);
    expect(out.ebitda_margin).toBeCloseTo((out.ebitda / out.gross_revenue) * 100, 6);
  });
});
