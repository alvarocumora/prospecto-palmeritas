import { describe, expect, it } from "vitest";
import { effectivePaymentStatus, summarizePayments, type PaymentLike } from "./payments";

const now = new Date("2026-07-20T00:00:00Z");

describe("effectivePaymentStatus", () => {
  it("pagado y cancelado se respetan", () => {
    expect(
      effectivePaymentStatus(
        { status: "pagado", amount_usd: 1, due_date: "2026-01-01", paid_at: null },
        now,
      ),
    ).toBe("pagado");
    expect(
      effectivePaymentStatus(
        { status: "cancelado", amount_usd: 1, due_date: "2026-01-01", paid_at: null },
        now,
      ),
    ).toBe("cancelado");
  });
  it("programado con fecha pasada → vencido", () => {
    expect(
      effectivePaymentStatus(
        { status: "programado", amount_usd: 1, due_date: "2026-07-10", paid_at: null },
        now,
      ),
    ).toBe("vencido");
  });
  it("programado con fecha futura o sin fecha → programado", () => {
    expect(
      effectivePaymentStatus(
        { status: "programado", amount_usd: 1, due_date: "2026-08-10", paid_at: null },
        now,
      ),
    ).toBe("programado");
    expect(
      effectivePaymentStatus(
        { status: "programado", amount_usd: 1, due_date: null, paid_at: null },
        now,
      ),
    ).toBe("programado");
  });
});

describe("summarizePayments", () => {
  const rows: PaymentLike[] = [
    { status: "pagado", amount_usd: 30000, due_date: "2026-06-01", paid_at: "2026-06-02" },
    { status: "programado", amount_usd: 40000, due_date: "2026-07-10", paid_at: null }, // vencido
    { status: "programado", amount_usd: 30000, due_date: "2026-08-15", paid_at: null }, // futuro
    { status: "cancelado", amount_usd: 99999, due_date: "2026-07-01", paid_at: null },
  ];

  it("comprometido excluye cancelados", () => {
    expect(summarizePayments(rows, now).scheduledUsd).toBe(100000);
  });
  it("cobrado, por cobrar y vencido", () => {
    const s = summarizePayments(rows, now);
    expect(s.paidUsd).toBe(30000);
    expect(s.outstandingUsd).toBe(70000);
    expect(s.overdueUsd).toBe(40000);
  });
  it("progreso = cobrado / comprometido", () => {
    expect(summarizePayments(rows, now).progressPct).toBe(30);
  });
  it("próximo pago = menor due_date pendiente", () => {
    expect(summarizePayments(rows, now).nextDue).toEqual({
      amountUsd: 40000,
      dueDate: "2026-07-10",
    });
  });
  it("lista vacía → ceros y sin próximo", () => {
    const s = summarizePayments([], now);
    expect(s).toEqual({
      scheduledUsd: 0,
      paidUsd: 0,
      outstandingUsd: 0,
      overdueUsd: 0,
      nextDue: null,
      progressPct: 0,
    });
  });
});
