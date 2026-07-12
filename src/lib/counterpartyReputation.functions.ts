import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import {
  scoreReputation,
  type ReputationResult,
  type ReputationSignals,
} from "@/lib/counterpartyReputation";

// Buró de Reputación de Contrapartes: agrega el historial del vendedor de un
// lote (trades + lotes publicados/verificados) y devuelve un score de
// reputación. Lectura pública de solo lectura (señal de confianza del vendedor).

export type CounterpartyReputation = ReputationResult & {
  orgName: string | null;
  memberSince: string | null;
  generatedAt: string;
};

const input = z.object({ lotId: z.string().uuid() });

export const getCounterpartyReputation = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => input.parse(d))
  .handler(async ({ data }): Promise<CounterpartyReputation | null> => {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return null;
    // Cliente sin tipar: commodity_trades es nueva (no está en types.ts).
    const sb = createClient(url, key, { auth: { persistSession: false } });

    const { data: lot } = await sb
      .from("commodity_lots")
      .select("seller_user_id, organization_id")
      .eq("id", data.lotId)
      .maybeSingle();
    if (!lot?.seller_user_id) return null;
    const sellerId = lot.seller_user_id as string;

    // Historial de trades como vendedor.
    const { data: trades } = await sb
      .from("commodity_trades")
      .select("status, total_value_usd")
      .eq("seller_user_id", sellerId)
      .limit(2000);
    let tradesClosed = 0;
    let tradesActive = 0;
    let tradesCancelled = 0;
    let gmvUsd = 0;
    for (const t of trades ?? []) {
      if (t.status === "closed") {
        tradesClosed++;
        const v = Number(t.total_value_usd);
        if (Number.isFinite(v) && v > 0) gmvUsd += v;
      } else if (t.status === "cancelled") tradesCancelled++;
      else tradesActive++;
    }

    // Lotes publicados / verificados.
    const { data: lots } = await sb
      .from("commodity_lots")
      .select("status, is_verified, created_at")
      .eq("seller_user_id", sellerId)
      .limit(2000);
    let lotsPublished = 0;
    let lotsVerified = 0;
    let memberSince: string | null = null;
    for (const l of lots ?? []) {
      if (l.status === "published" || l.status === "sold" || l.status === "under_negotiation") {
        lotsPublished++;
      }
      if (l.is_verified) lotsVerified++;
      const created = l.created_at as string | null;
      if (created && (!memberSince || created < memberSince)) memberSince = created;
    }

    // Nombre de la organización (opcional).
    let orgName: string | null = null;
    if (lot.organization_id) {
      const { data: org } = await sb
        .from("organizations")
        .select("name")
        .eq("id", lot.organization_id)
        .maybeSingle();
      orgName = org?.name ?? null;
    }

    const signals: ReputationSignals = {
      tradesClosed,
      tradesActive,
      tradesCancelled,
      lotsPublished,
      lotsVerified,
      gmvUsd,
      avgLotTrust: null, // reservado para promedio KYM (cálculo pesado, futura ronda)
    };

    const result = scoreReputation(signals);
    return {
      ...result,
      orgName,
      memberSince,
      generatedAt: new Date().toISOString(),
    };
  });
