import { describe, expect, it } from "vitest";
import {
  daysOverdue,
  agingBucket,
  classifyReceivable,
  summarizeSide,
  agingByCounterparty,
  type ReceivableInput,
} from "./receivables";

const NOW = new Date("2026-07-18T12:00:00Z");

const base: Omit<ReceivableInput, "id" | "dueDate" | "counterpartyKey" | "counterpartyLabel"> = {
  tradeId: "t1",
  tradeLabel: "GC-001",
  direction: "por_cobrar",
  kind: "balance",
  label: "Balance final",
  amountUsd: 1000,
  currency: "USD",
};

const mk = (
  id: string,
  dueDate: string | null,
  amountUsd: number,
  cp = "cpA",
  overrides: Partial<ReceivableInput> = {},
): ReceivableInput => ({
  ...base,
  id,
  dueDate,
  amountUsd,
  counterpartyKey: cp,
  counterpartyLabel: cp === "cpA" ? "Cliente A" : "Cliente B",
  ...overrides,
});

describe("receivables aging", () => {
  it("daysOverdue: futuro y sin fecha = 0; pasado cuenta días", () => {
    expect(daysOverdue(null, NOW)).toBe(0);
    expect(daysOverdue("2026-08-01", NOW)).toBe(0); // futuro
    expect(daysOverdue("2026-07-08", NOW)).toBe(10); // 10 días atrás
  });

  it("agingBucket: tramos por mora", () => {
    expect(agingBucket(null, NOW)).toBe("current");
    expect(agingBucket("2026-08-01", NOW)).toBe("current");
    expect(agingBucket("2026-07-01", NOW)).toBe("d1_30"); // 17 días
    expect(agingBucket("2026-06-01", NOW)).toBe("d31_60"); // 47 días
    expect(agingBucket("2026-05-01", NOW)).toBe("d61_90"); // 78 días
    expect(agingBucket("2026-01-01", NOW)).toBe("d90_plus");
  });

  it("classifyReceivable marca overdue y tramo", () => {
    const c = classifyReceivable(mk("p1", "2026-07-01", 500), NOW);
    expect(c.overdue).toBe(true);
    expect(c.bucket).toBe("d1_30");
    expect(c.daysOverdue).toBe(17);
  });
});

describe("summarizeSide", () => {
  it("acumula saldo, vencido, tramos y próximo vencimiento", () => {
    const items = [
      mk("p1", "2026-08-10", 1000), // por vencer
      mk("p2", "2026-08-01", 400), // por vencer, más cercano
      mk("p3", "2026-07-01", 600), // vencido 17d → d1_30
      mk("p4", "2026-04-01", 300), // vencido → d90_plus
    ].map((i) => classifyReceivable(i, NOW));

    const s = summarizeSide(items);
    expect(s.outstandingUsd).toBe(2300);
    expect(s.overdueUsd).toBe(900);
    expect(s.count).toBe(4);
    expect(s.overdueCount).toBe(2);
    expect(s.buckets.current).toBe(1400);
    expect(s.buckets.d1_30).toBe(600);
    expect(s.buckets.d90_plus).toBe(300);
    expect(s.nextDue?.dueDate).toBe("2026-08-01"); // el futuro más cercano
    expect(s.nextDue?.amountUsd).toBe(400);
  });

  it("cartera vacía = ceros y sin próximo vencimiento", () => {
    const s = summarizeSide([]);
    expect(s.outstandingUsd).toBe(0);
    expect(s.nextDue).toBeNull();
  });
});

describe("agingByCounterparty", () => {
  it("agrupa y ordena por gravedad y saldo", () => {
    const items = [
      mk("p1", "2026-08-10", 1000, "cpA"), // A: por vencer
      mk("p2", "2026-01-01", 200, "cpB"), // B: +90 (más grave)
      mk("p3", "2026-08-01", 500, "cpB"), // B: por vencer
    ].map((i) => classifyReceivable(i, NOW));

    const rows = agingByCounterparty(items);
    expect(rows).toHaveLength(2);
    // B primero por tener el tramo más grave (+90)
    expect(rows[0].counterpartyKey).toBe("cpB");
    expect(rows[0].outstandingUsd).toBe(700);
    expect(rows[0].overdueUsd).toBe(200);
    expect(rows[0].worstBucket).toBe("d90_plus");
    expect(rows[1].counterpartyKey).toBe("cpA");
    expect(rows[1].worstBucket).toBe("current");
  });
});
