import { describe, expect, it } from "vitest";
import { commissionAmount, commissionTotals, type CommissionLike } from "./commissions";

describe("commissionAmount", () => {
  it("respeta el monto explícito por sobre el %", () => {
    expect(commissionAmount({ commissionUsd: 5000, dealValueUsd: 100000, commissionPct: 2 })).toBe(
      5000,
    );
  });
  it("deriva de valor × %", () => {
    expect(commissionAmount({ dealValueUsd: 100000, commissionPct: 2.5 })).toBe(2500);
  });
  it("null si faltan datos", () => {
    expect(commissionAmount({ dealValueUsd: 100000 })).toBeNull();
    expect(commissionAmount({})).toBeNull();
  });
  it("nunca negativo", () => {
    expect(commissionAmount({ commissionUsd: -10 })).toBe(0);
  });
});

describe("commissionTotals", () => {
  const rows: CommissionLike[] = [
    { status: "pendiente", commission_usd: 1000, commission_pct: null, deal_value_usd: null },
    { status: "por_cobrar", commission_usd: null, commission_pct: 2, deal_value_usd: 100000 },
    { status: "liquidada", commission_usd: 3000, commission_pct: null, deal_value_usd: null },
    { status: "cancelada", commission_usd: 9999, commission_pct: null, deal_value_usd: null },
  ];

  it("devengado excluye canceladas", () => {
    const t = commissionTotals(rows);
    expect(t.count).toBe(3);
    expect(t.accruedUsd).toBe(1000 + 2000 + 3000);
  });
  it("separa liquidado de pendiente de cobro", () => {
    const t = commissionTotals(rows);
    expect(t.settledUsd).toBe(3000);
    expect(t.outstandingUsd).toBe(1000 + 2000);
  });
  it("lista vacía → ceros", () => {
    expect(commissionTotals([])).toEqual({
      count: 0,
      accruedUsd: 0,
      outstandingUsd: 0,
      settledUsd: 0,
    });
  });
});
