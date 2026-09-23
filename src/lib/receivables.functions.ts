import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireTradeRole } from "@/lib/access/roleMiddleware";
import { effectivePaymentStatus, isValidPaymentAmount } from "@/lib/payments";
import {
  classifyReceivable,
  summarizeSide,
  agingByCounterparty,
  type ReceivableInput,
  type ReceivableItem,
  type SideSummary,
  type CounterpartyAging,
} from "@/lib/receivables";

// Cartera de cobranza cross-trade (RLS del usuario): reúne los pagos pendientes
// de todos mis trades, resuelve la contraparte y arma el aging. "Por cobrar" =
// trades donde soy vendedor; "por pagar" = donde soy comprador. Degrada elegante
// si trade_payments aún no está migrada.

const asSb = (c: unknown): SupabaseClient => c as SupabaseClient;
const isMissingTable = (msg: string) => /does not exist|relation|schema cache/i.test(msg);

type TradeRow = {
  id: string;
  reference: string | null;
  commodity: string | null;
  currency: string | null;
  buyer_user_id: string | null;
  seller_user_id: string | null;
  counterparty_name: string | null;
  counterparty_company: string | null;
};

type PaymentRow = {
  id: string;
  trade_id: string;
  kind: string;
  label: string | null;
  amount_usd: number | null;
  currency: string | null;
  due_date: string | null;
  status: string;
  paid_at: string | null;
};

export type ReceivablesSide = {
  summary: SideSummary;
  items: ReceivableItem[];
  byCounterparty: CounterpartyAging[];
};

export type ReceivablesOverview = {
  /** true si trade_payments aún no está migrada (vista vacía, no error). */
  pending: boolean;
  cobrar: ReceivablesSide;
  pagar: ReceivablesSide;
};

const emptySide = (): ReceivablesSide => ({
  summary: summarizeSide([]),
  items: [],
  byCounterparty: [],
});

export const getReceivablesOverview = createServerFn({ method: "GET" })
  .middleware([requireTradeRole])
  .handler(async ({ context }): Promise<ReceivablesOverview> => {
    const sb = asSb(context.supabase);
    const me = context.userId as string;
    const now = new Date();

    // Pagos pendientes de mis trades (RLS party-of-trade).
    const { data: paysData, error: paysErr } = await sb
      .from("trade_payments")
      .select("id, trade_id, kind, label, amount_usd, currency, due_date, status, paid_at")
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(2000);
    if (paysErr) {
      if (isMissingTable(paysErr.message)) {
        return { pending: true, cobrar: emptySide(), pagar: emptySide() };
      }
      throw new Error(paysErr.message);
    }
    const payments = (paysData ?? []) as PaymentRow[];

    // Solo pendientes con monto válido (programado o vencido). Los pagados y
    // cancelados no forman cartera.
    const outstanding = payments.filter((p) => {
      const st = effectivePaymentStatus(
        { status: p.status, amount_usd: p.amount_usd, due_date: p.due_date, paid_at: p.paid_at },
        now,
      );
      return st !== "pagado" && st !== "cancelado" && isValidPaymentAmount(p.amount_usd);
    });
    if (outstanding.length === 0) {
      return { pending: false, cobrar: emptySide(), pagar: emptySide() };
    }

    // Trades de esos pagos, para dirección y contraparte.
    const tradeIds = [...new Set(outstanding.map((p) => p.trade_id))];
    const { data: tradesData } = await sb
      .from("commodity_trades")
      .select(
        "id, reference, commodity, currency, buyer_user_id, seller_user_id, counterparty_name, counterparty_company",
      )
      .in("id", tradeIds);
    const trades = (tradesData ?? []) as TradeRow[];
    const tradeById = new Map(trades.map((t) => [t.id, t]));

    // Nombres reales de las contrapartes con cuenta (profiles va por admin: el
    // caller ya probó ser parte del trade vía RLS). Igual patrón que trades.functions.
    const partyIds = [
      ...new Set(
        trades
          .flatMap((t) => [t.buyer_user_id, t.seller_user_id])
          .filter((x): x is string => typeof x === "string" && x.length > 0 && x !== me),
      ),
    ];
    let nameById = new Map<string, string>();
    if (partyIds.length > 0) {
      try {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: profs } = await supabaseAdmin
          .from("profiles")
          .select("user_id, display_name, email")
          .in("user_id", partyIds);
        nameById = new Map(
          (
            (profs ?? []) as Array<{
              user_id: string;
              display_name: string | null;
              email: string | null;
            }>
          ).map((p) => [p.user_id, p.display_name ?? p.email ?? ""]),
        );
      } catch (e) {
        console.error("[receivables] profiles lookup failed", e);
      }
    }

    const cobrar: ReceivableItem[] = [];
    const pagar: ReceivableItem[] = [];

    for (const p of outstanding) {
      const t = tradeById.get(p.trade_id);
      if (!t) continue; // trade no visible (no debería pasar por RLS)
      const iAmBuyer = t.buyer_user_id === me;
      const otherId = iAmBuyer ? t.seller_user_id : t.buyer_user_id;
      const externalName =
        t.counterparty_name && t.counterparty_company
          ? `${t.counterparty_name} · ${t.counterparty_company}`
          : (t.counterparty_name ?? t.counterparty_company ?? null);
      const counterpartyLabel =
        (otherId ? nameById.get(otherId) : null) || externalName || "Contraparte";
      const counterpartyKey = otherId ?? `ext:${externalName ?? t.id}`;

      const input: ReceivableInput = {
        id: p.id,
        tradeId: p.trade_id,
        tradeLabel: t.reference ?? t.commodity ?? "Operación",
        direction: iAmBuyer ? "por_pagar" : "por_cobrar",
        counterpartyKey,
        counterpartyLabel,
        kind: p.kind,
        label: p.label,
        amountUsd: p.amount_usd as number,
        currency: p.currency ?? t.currency ?? "USD",
        dueDate: p.due_date,
      };
      const item = classifyReceivable(input, now);
      if (item.direction === "por_cobrar") cobrar.push(item);
      else pagar.push(item);
    }

    return {
      pending: false,
      cobrar: {
        summary: summarizeSide(cobrar),
        items: cobrar,
        byCounterparty: agingByCounterparty(cobrar),
      },
      pagar: {
        summary: summarizeSide(pagar),
        items: pagar,
        byCounterparty: agingByCounterparty(pagar),
      },
    };
  });
