import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  buildFunnel,
  winRatePct,
  avgCycleDays,
  topCommodities,
  type FunnelStage,
  type CommodityAgg,
} from "@/lib/analytics";

// Analítica del negocio (RLS del usuario). Agrega el funnel comercial, tiempo
// de ciclo, valor por commodity y finanzas — todo best-effort: si una tabla
// nueva aún no está migrada, ese bloque queda en cero sin romper la vista.

const asSb = (c: unknown): SupabaseClient => c as SupabaseClient;

async function safeCount(sb: SupabaseClient, table: string): Promise<number> {
  try {
    const { count } = await sb.from(table).select("id", { count: "exact", head: true }).limit(1);
    return count ?? 0;
  } catch {
    return 0;
  }
}

export type BusinessAnalytics = {
  funnel: FunnelStage[];
  winRatePct: number;
  avgCycleDays: number;
  pipeline: { activeUsd: number; closedUsd: number };
  topCommodities: CommodityAgg[];
  finance: { receivedUsd: number; outstandingUsd: number; commissionsAccruedUsd: number };
};

export const getBusinessAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<BusinessAnalytics> => {
    const sb = asSb(context.supabase);

    // Trades (RLS: donde soy parte).
    const { data: tradesData } = await sb
      .from("commodity_trades")
      .select("id, commodity, total_value_usd, stage, status, created_at, updated_at")
      .limit(1000);
    const trades = (tradesData ?? []) as Array<{
      commodity: string | null;
      total_value_usd: number | null;
      stage: string;
      status: string;
      created_at: string;
      updated_at: string;
    }>;
    const activeTrades = trades.filter((t) => t.status !== "cancelled" && t.stage !== "closed");
    const closedTrades = trades.filter((t) => t.stage === "closed");

    const [requests, proposals] = await Promise.all([
      safeCount(sb, "sourcing_requests"),
      safeCount(sb, "sourcing_submissions"),
    ]);

    const funnel = buildFunnel({
      requests,
      proposals,
      trades: trades.length,
      closed: closedTrades.length,
    });

    const cycle = avgCycleDays(
      closedTrades.map((t) => ({ startIso: t.created_at, endIso: t.updated_at })),
    );

    // Finanzas (best-effort).
    const finance = { receivedUsd: 0, outstandingUsd: 0, commissionsAccruedUsd: 0 };
    try {
      const { data: pays } = await sb
        .from("trade_payments")
        .select("amount_usd, status")
        .limit(2000);
      for (const p of (pays ?? []) as Array<{ amount_usd: number | null; status: string }>) {
        if (p.status === "cancelado") continue;
        if (p.status === "pagado") finance.receivedUsd += p.amount_usd ?? 0;
        else finance.outstandingUsd += p.amount_usd ?? 0;
      }
    } catch {
      /* trade_payments no migrada */
    }
    try {
      const { data: comms } = await sb
        .from("deal_commissions")
        .select("commission_usd, commission_pct, deal_value_usd, status")
        .limit(2000);
      for (const c of (comms ?? []) as Array<{
        commission_usd: number | null;
        commission_pct: number | null;
        deal_value_usd: number | null;
        status: string;
      }>) {
        if (c.status === "cancelada") continue;
        const amount =
          c.commission_usd ??
          (c.deal_value_usd != null && c.commission_pct != null
            ? (c.deal_value_usd * c.commission_pct) / 100
            : 0);
        finance.commissionsAccruedUsd += amount ?? 0;
      }
    } catch {
      /* deal_commissions no migrada */
    }

    return {
      funnel,
      winRatePct: winRatePct(trades.length, closedTrades.length),
      avgCycleDays: cycle,
      pipeline: {
        activeUsd: activeTrades.reduce((a, t) => a + (t.total_value_usd ?? 0), 0),
        closedUsd: closedTrades.reduce((a, t) => a + (t.total_value_usd ?? 0), 0),
      },
      topCommodities: topCommodities(trades),
      finance,
    };
  });
