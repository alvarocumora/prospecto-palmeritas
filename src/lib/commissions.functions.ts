import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { COMMISSION_STATUSES, commissionTotals, type CommissionTotals } from "@/lib/commissions";

// Comisiones de asociados por deal (RLS owner-only). Degrada elegante si la
// tabla aún no existe (banner "migración pendiente" en la UI, sin crash).

const asSb = (c: unknown): SupabaseClient => c as SupabaseClient;
const isMissingTable = (msg: string) => /does not exist|relation|schema cache/i.test(msg);

export type CommissionRow = {
  id: string;
  partner_id: string;
  trade_id: string | null;
  listing_id: string | null;
  deal_value_usd: number | null;
  commission_pct: number | null;
  commission_usd: number | null;
  status: string;
  notes: string | null;
  settled_at: string | null;
  created_at: string;
  partnerName: string | null;
  tradeReference: string | null;
};

export const listCommissions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(
    async ({
      context,
    }): Promise<{ pending: boolean; rows: CommissionRow[]; totals: CommissionTotals }> => {
      const sb = asSb(context.supabase);
      const { data, error } = await sb
        .from("deal_commissions")
        .select(
          "id, partner_id, trade_id, listing_id, deal_value_usd, commission_pct, commission_usd, status, notes, settled_at, created_at, partner:business_partners(name), trade:commodity_trades(reference)",
        )
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) {
        if (isMissingTable(error.message))
          return {
            pending: true,
            rows: [],
            totals: { count: 0, accruedUsd: 0, outstandingUsd: 0, settledUsd: 0 },
          };
        throw new Error(error.message);
      }
      const rows: CommissionRow[] = (
        (data ?? []) as Array<
          Record<string, unknown> & {
            partner?: { name?: string | null } | null;
            trade?: { reference?: string | null } | null;
          }
        >
      ).map((r) => ({
        id: String(r.id),
        partner_id: String(r.partner_id),
        trade_id: (r.trade_id ?? null) as string | null,
        listing_id: (r.listing_id ?? null) as string | null,
        deal_value_usd: (r.deal_value_usd ?? null) as number | null,
        commission_pct: (r.commission_pct ?? null) as number | null,
        commission_usd: (r.commission_usd ?? null) as number | null,
        status: String(r.status),
        notes: (r.notes ?? null) as string | null,
        settled_at: (r.settled_at ?? null) as string | null,
        created_at: String(r.created_at),
        partnerName: r.partner?.name ?? null,
        tradeReference: r.trade?.reference ?? null,
      }));
      return { pending: false, rows, totals: commissionTotals(rows) };
    },
  );

const UpsertInput = z.object({
  id: z.string().uuid().optional(),
  partnerId: z.string().uuid(),
  tradeId: z.string().uuid().optional(),
  listingId: z.string().uuid().optional(),
  dealValueUsd: z.number().min(0).max(1e12).optional(),
  commissionPct: z.number().min(0).max(100).optional(),
  commissionUsd: z.number().min(0).max(1e12).optional(),
  status: z.enum(COMMISSION_STATUSES).default("pendiente"),
  notes: z.string().trim().max(1000).optional(),
});

export const upsertCommission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => UpsertInput.parse(d))
  .handler(async ({ data, context }) => {
    const sb = asSb(context.supabase);
    const row = {
      owner_user_id: context.userId as string,
      partner_id: data.partnerId,
      trade_id: data.tradeId ?? null,
      listing_id: data.listingId ?? null,
      deal_value_usd: data.dealValueUsd ?? null,
      commission_pct: data.commissionPct ?? null,
      commission_usd: data.commissionUsd ?? null,
      status: data.status,
      notes: data.notes ?? null,
      settled_at: data.status === "liquidada" ? new Date().toISOString() : null,
    };
    const q = data.id
      ? sb
          .from("deal_commissions")
          .update(row)
          .eq("id", data.id)
          .eq("owner_user_id", context.userId as string)
          .select("id")
          .single()
      : sb.from("deal_commissions").insert(row).select("id").single();
    const { data: saved, error } = await q;
    if (error) {
      if (isMissingTable(error.message))
        throw new Error(
          "El módulo de comisiones estará disponible tras aplicar la última migración.",
        );
      throw new Error(error.message);
    }
    return { id: (saved as { id: string }).id };
  });

export const setCommissionStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), status: z.enum(COMMISSION_STATUSES) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await asSb(context.supabase)
      .from("deal_commissions")
      .update({
        status: data.status,
        settled_at: data.status === "liquidada" ? new Date().toISOString() : null,
      })
      .eq("id", data.id)
      .eq("owner_user_id", context.userId as string);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteCommission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await asSb(context.supabase)
      .from("deal_commissions")
      .delete()
      .eq("id", data.id)
      .eq("owner_user_id", context.userId as string);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
