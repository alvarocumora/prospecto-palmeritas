import { describe, expect, it } from "vitest";
import {
  RATE_STEPS,
  breakevenRate,
  buildRamp,
  fleetForRate,
  projectCashflow,
  tariffForGrade,
  unitCosts,
} from "./minePlan";

describe("buildRamp", () => {
  it("parte en startRate y llega a la meseta", () => {
    const r = buildRamp({
      startRate: 1000,
      plateau: 15000,
      rampMonths: 12,
      totalMonths: 24,
      gradePct: 1.5,
    });
    expect(r).toHaveLength(24);
    expect(r[0]).toBe(1000);
    expect(r[11]).toBe(15000);
    expect(r[23]).toBe(15000);
  });

  it("es monótona no decreciente", () => {
    const r = buildRamp({
      startRate: 1000,
      plateau: 20000,
      rampMonths: 10,
      totalMonths: 24,
      gradePct: 2,
    });
    for (let i = 1; i < r.length; i++) expect(r[i]).toBeGreaterThanOrEqual(r[i - 1]);
  });
});

describe("fleetForRate", () => {
  it("siempre asigna al menos una unidad por equipo", () => {
    expect(fleetForRate(500).lines.every((l) => l.units >= 1)).toBe(true);
  });

  it("escala unidades y costo con el tonelaje", () => {
    const a = fleetForRate(5000);
    const b = fleetForRate(20000);
    expect(b.monthlyClp).toBeGreaterThan(a.monthlyClp);
  });
});

describe("unitCosts", () => {
  it("el costo unitario baja al escalar", () => {
    const costs = RATE_STEPS.map((r) => unitCosts(r).totalClpT);
    for (let i = 1; i < costs.length; i++) expect(costs[i]).toBeLessThan(costs[i - 1]);
  });

  it("descompone el costo sin residuo", () => {
    const c = unitCosts(10000);
    expect(c.variableClpT + c.fixedClpT + c.fleetClpT + c.contingencyClpT).toBeCloseTo(
      c.totalClpT,
      6,
    );
  });
});

describe("tariffForGrade", () => {
  it("reproduce la tarifa de 1,5 % de la Circular N°27", () => {
    expect(Math.round(tariffForGrade(1.5))).toBe(89_571);
  });
});

describe("projectCashflow", () => {
  it("acumula tonelaje y flujo de forma coherente", () => {
    const p = projectCashflow({ plateau: 15000 });
    const sum = p.months.reduce((a, m) => a + m.rate, 0);
    expect(p.totalTonnes).toBe(sum);
    expect(p.months[p.months.length - 1].cumulativeCashflowClp).toBeCloseTo(
      p.operatingSurplusClp - p.capexClp,
      3,
    );
    expect(p.operatingSurplusClp).toBeCloseTo(p.totalRevenueClp - p.totalCostClp, 3);
    expect(p.scenarioPaybackMonth).toBe(p.paybackMonth);
    expect(p.decisionGradePaybackMonth).toBeNull();
    expect(p.commercialReadiness).toBe("PENDING_DD");
  });

  it("20.000 t/mes produce más mineral y más superávit que 15.000", () => {
    const a = projectCashflow({ plateau: 15000 });
    const b = projectCashflow({ plateau: 20000 });
    expect(b.totalTonnes).toBeGreaterThan(a.totalTonnes);
    expect(b.operatingSurplusClp).toBeGreaterThan(a.operatingSurplusClp);
  });

  it("expone un punto de equilibrio en t/mes", () => {
    const be = breakevenRate(1.5);
    expect(be).not.toBeNull();
    expect(be!).toBeGreaterThan(0);
  });
});

describe("flota con respaldo", () => {
  it("da al menos una unidad de respaldo a cada equipo crítico en la meseta", () => {
    for (const line of fleetForRate(15_000).lines) {
      if (line.spec.critical) expect(line.standbyUnits).toBeGreaterThanOrEqual(1);
      expect(line.units).toBe(line.operatingUnits + line.standbyUnits);
    }
  });

  it("dimensiona sobre capacidad efectiva, no nominal", () => {
    for (const line of fleetForRate(20_000).lines) {
      const effective = line.spec.capacityTMonth * line.spec.availability;
      expect(line.operatingUnits * effective).toBeGreaterThanOrEqual(20_000 - 1e-6);
    }
  });

  it("suma costos operativos y de respaldo en el total", () => {
    const f = fleetForRate(10_000);
    expect(f.operatingClp + f.standbyClp).toBe(f.monthlyClp);
    expect(f.standbyClp).toBeGreaterThan(0);
  });

  it("mantiene el costo unitario decreciente al escalar pese al respaldo", () => {
    const costs = [1_000, 3_000, 5_000, 10_000, 15_000, 20_000].map((r) => unitCosts(r).totalClpT);
    for (let i = 1; i < costs.length; i++) expect(costs[i]).toBeLessThan(costs[i - 1]);
  });
});
