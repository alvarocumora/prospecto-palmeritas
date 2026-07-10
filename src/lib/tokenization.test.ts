import { describe, expect, it } from "vitest";
import {
  offeringStats,
  ownershipPct,
  capTable,
  validateSubscription,
  type OfferingLike,
  type SubscriptionLike,
} from "./tokenization";

const offering: OfferingLike = { total_units: 1000, price_per_unit_usd: 50, min_units: 10 };

const subs: SubscriptionLike[] = [
  { investor_user_id: "a", units: 200, status: "confirmed" },
  { investor_user_id: "b", units: 100, status: "pending" },
  { investor_user_id: "a", units: 50, status: "confirmed" },
  { investor_user_id: "c", units: 300, status: "rejected" }, // no cuenta
  { investor_user_id: "d", units: 40, status: "cancelled" }, // no cuenta
];

describe("offeringStats", () => {
  it("suma solo compromisos activos (pending + confirmed)", () => {
    const s = offeringStats(offering, subs);
    expect(s.unitsCommitted).toBe(350); // 200 + 100 + 50
    expect(s.unitsConfirmed).toBe(250); // 200 + 50
    expect(s.unitsAvailable).toBe(650);
    expect(s.targetRaiseUsd).toBe(50000);
    expect(s.committedUsd).toBe(17500);
    expect(s.raisedUsd).toBe(12500);
    expect(s.pctSubscribed).toBeCloseTo(35);
    expect(s.pctConfirmed).toBeCloseTo(25);
    expect(s.investorCount).toBe(2); // a y b
  });

  it("oferta vacía no divide por cero", () => {
    const s = offeringStats({ total_units: 0, price_per_unit_usd: 10, min_units: 1 }, []);
    expect(s.pctSubscribed).toBe(0);
    expect(s.unitsAvailable).toBe(0);
  });
});

describe("ownershipPct", () => {
  it("calcula el porcentaje de participación", () => {
    expect(ownershipPct(250, 1000)).toBe(25);
    expect(ownershipPct(1, 0)).toBe(0);
  });
});

describe("capTable", () => {
  it("agrega por inversionista y ordena por unidades", () => {
    const ct = capTable(subs, offering);
    expect(ct).toHaveLength(2);
    expect(ct[0]).toMatchObject({ investorUserId: "a", units: 250, pct: 25, status: "confirmed" });
    expect(ct[0].amountUsd).toBe(12500);
    expect(ct[1]).toMatchObject({ investorUserId: "b", units: 100, status: "pending" });
  });
});

describe("validateSubscription", () => {
  const avail = 650;
  it("acepta un compromiso válido", () => {
    expect(validateSubscription(100, offering, avail)).toEqual({ ok: true });
  });
  it("rechaza bajo el mínimo", () => {
    const r = validateSubscription(5, offering, avail);
    expect(r.ok).toBe(false);
  });
  it("rechaza sobre la disponibilidad", () => {
    const r = validateSubscription(700, offering, avail);
    expect(r.ok).toBe(false);
  });
  it("rechaza no enteros o negativos", () => {
    expect(validateSubscription(0, offering, avail).ok).toBe(false);
    expect(validateSubscription(-3, offering, avail).ok).toBe(false);
    expect(validateSubscription(10.5, offering, avail).ok).toBe(false);
  });
});
