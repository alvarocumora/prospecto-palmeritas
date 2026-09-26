// End-to-end del flujo sourcing → trade → firma → pago sobre una capa in-memory
// que replica las invariantes de negocio (RLS + trazabilidad + resumen financiero).
// El test previene regresiones de los hallazgos de auditoría:
//   • Vinculación firma ↔ trade por trade_id (feed unificado).
//   • Pagos sin monto no se aceptan y no inflan el progreso.
//   • cancelTradePayment deja evento payment_cancelled en el feed.
//   • Contraparte externa queda visible aunque no exista seller_user_id.

import { describe, expect, it } from "vitest";
import { summarizePayments, type PaymentLike } from "./payments";

type UUID = string;
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

type Trade = {
  id: UUID;
  reference: string;
  buyer_user_id: UUID;
  seller_user_id: UUID | null;
  counterparty_name: string | null;
};
type SignRequest = {
  id: UUID;
  trade_id: UUID | null;
  status: "pending" | "signed" | "void";
};
type TradeEvent = { trade_id: UUID; kind: string; detail: string };
type Payment = PaymentLike & { id: UUID; trade_id: UUID };

// Motor mínimo: valida las mismas invariantes que las server fns.
function createEngine() {
  const trades: Trade[] = [];
  const signRequests: SignRequest[] = [];
  const events: TradeEvent[] = [];
  const payments: Payment[] = [];

  return {
    trades,
    signRequests,
    events,
    payments,
    // Sourcing → trade con proveedor externo: seller_user_id NULL y contraparte visible.
    convertSubmissionToTrade(input: {
      buyerUserId: UUID;
      externalSupplierName: string;
      reference: string;
    }): Trade {
      const t: Trade = {
        id: uuid(trades.length + 1),
        reference: input.reference,
        buyer_user_id: input.buyerUserId,
        seller_user_id: null,
        counterparty_name: input.externalSupplierName,
      };
      trades.push(t);
      events.push({ trade_id: t.id, kind: "trade_created", detail: input.reference });
      return t;
    },
    // Firma vinculada por trade_id: al firmarse deja evento en el feed del trade.
    createSignRequest(tradeId: UUID | null): SignRequest {
      const r: SignRequest = {
        id: uuid(1000 + signRequests.length),
        trade_id: tradeId,
        status: "pending",
      };
      signRequests.push(r);
      return r;
    },
    signSignRequest(id: UUID, signerName: string) {
      const r = signRequests.find((x) => x.id === id);
      if (!r) throw new Error("sign request no encontrada");
      if (r.status !== "pending") throw new Error("no se puede firmar");
      r.status = "signed";
      if (r.trade_id) {
        events.push({
          trade_id: r.trade_id,
          kind: "doc_signed",
          detail: `firmado por ${signerName}`,
        });
      }
    },
    // Pagos: monto obligatorio y > 0.
    schedulePayment(input: {
      tradeId: UUID;
      amount_usd: number;
      due_date: string | null;
      label?: string;
    }): Payment {
      if (!(typeof input.amount_usd === "number" && input.amount_usd > 0)) {
        throw new Error("El monto debe ser mayor a 0.");
      }
      const p: Payment = {
        id: uuid(2000 + payments.length),
        trade_id: input.tradeId,
        status: "programado",
        amount_usd: input.amount_usd,
        due_date: input.due_date,
        paid_at: null,
      };
      payments.push(p);
      events.push({
        trade_id: input.tradeId,
        kind: "payment_scheduled",
        detail: `${input.label ?? "pago"} · ${input.amount_usd}`,
      });
      return p;
    },
    markPaymentPaid(id: UUID) {
      const p = payments.find((x) => x.id === id);
      if (!p || p.status !== "programado") throw new Error("pago no programado");
      p.status = "pagado";
      p.paid_at = "2026-07-25T00:00:00Z";
      events.push({ trade_id: p.trade_id, kind: "payment_paid", detail: `${p.amount_usd}` });
    },
    cancelPayment(id: UUID) {
      const p = payments.find((x) => x.id === id);
      if (!p) throw new Error("pago no encontrado");
      if (p.status === "pagado") throw new Error("no se puede cancelar un pago pagado");
      p.status = "cancelado";
      // Trazabilidad: cancelación queda en el feed del trade.
      events.push({
        trade_id: p.trade_id,
        kind: "payment_cancelled",
        detail: `${p.amount_usd} cancelado`,
      });
    },
  };
}

const NOW = new Date("2026-07-30T00:00:00Z");
const BUYER = uuid(1);

describe("flujo e2e sourcing → trade → firma → pago", () => {
  it("cubre la operación completa con las invariantes de trazabilidad y pagos", () => {
    const e = createEngine();

    // 1. Sourcing convertido a trade con proveedor externo.
    const trade = e.convertSubmissionToTrade({
      buyerUserId: BUYER,
      externalSupplierName: "Minera Andes SpA",
      reference: "GC-TRD-001",
    });
    expect(trade.seller_user_id).toBeNull();
    expect(trade.counterparty_name).toBe("Minera Andes SpA");

    // 2. Firma vinculada al trade y evento en el feed.
    const sr = e.createSignRequest(trade.id);
    e.signSignRequest(sr.id, "J. Pérez");
    expect(sr.status).toBe("signed");
    expect(e.events.some((ev) => ev.trade_id === trade.id && ev.kind === "doc_signed")).toBe(true);

    // 3. Pago sin monto es rechazado (no infla el progreso).
    expect(() =>
      e.schedulePayment({ tradeId: trade.id, amount_usd: 0, due_date: "2026-08-01" }),
    ).toThrow(/mayor a 0/);
    expect(() =>
      e.schedulePayment({
        tradeId: trade.id,
        amount_usd: Number.NaN,
        due_date: "2026-08-01",
      }),
    ).toThrow();

    // 4. Cronograma válido: anticipo + balance.
    const anticipo = e.schedulePayment({
      tradeId: trade.id,
      amount_usd: 30_000,
      due_date: "2026-08-01",
      label: "Anticipo",
    });
    const balance = e.schedulePayment({
      tradeId: trade.id,
      amount_usd: 70_000,
      due_date: "2026-09-15",
      label: "Balance",
    });

    // 5. Se cobra el anticipo y se cancela el balance: el cancelado NO cuenta.
    e.markPaymentPaid(anticipo.id);
    e.cancelPayment(balance.id);

    // Trazabilidad: la cancelación queda en el feed del trade.
    expect(e.events.some((ev) => ev.trade_id === trade.id && ev.kind === "payment_cancelled")).toBe(
      true,
    );

    // Resumen financiero: progreso 100% porque el único pago vivo fue cobrado.
    const summary = summarizePayments(e.payments, NOW);
    expect(summary.scheduledUsd).toBe(30_000);
    expect(summary.paidUsd).toBe(30_000);
    expect(summary.outstandingUsd).toBe(0);
    expect(summary.progressPct).toBe(100);
  });

  it("filas con monto nulo o cero no inflan el progreso del trade", () => {
    const rows: PaymentLike[] = [
      { status: "pagado", amount_usd: 50_000, due_date: "2026-06-01", paid_at: "2026-06-02" },
      // Registros inválidos que en el pasado inflaban scheduledUsd:
      { status: "programado", amount_usd: null, due_date: "2026-08-01", paid_at: null },
      { status: "programado", amount_usd: 0, due_date: "2026-08-05", paid_at: null },
    ];
    const s = summarizePayments(rows, NOW);
    expect(s.scheduledUsd).toBe(50_000);
    expect(s.paidUsd).toBe(50_000);
    expect(s.progressPct).toBe(100);
    expect(s.outstandingUsd).toBe(0);
  });
});
