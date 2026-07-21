import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { partnerHubSummary, type HubTrade, type PartnerHubSummary } from "@/lib/partnerHub";
import type { CommissionStatus } from "@/lib/commissions";

// Hub de relación de una contraparte: agrega sus trades (por email/nombre de
// contraparte, que es como linkPartnerToTrade los vincula) y sus comisiones
// (deal_commissions.partner_id). Todo con RLS del usuario. Degrada elegante.

const asSb = (c: unknown): SupabaseClient => c as SupabaseClient;
const isMissing = (msg: string) => /does not exist|relation|schema cache/i.test(msg);

export type PartnerHead = {
  id: string;
  name: string;
  company: string | null;
  role: string;
  email: string | null;
  phone: string | null;
  country: string | null;
  commodities: string[];
  status: string;
};

export type HubCommission = {
  id: string;
  trade_id: string | null;
  deal_value_usd: number | null;
  commission_pct: number | null;
  commission_usd: number | null;
  status: CommissionStatus;
};

export type PartnerHubView = {
  partner: PartnerHead;
  trades: HubTrade[];
  commissions: HubCommission[];
  summary: PartnerHubSummary;
};

export const getPartnerHub = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ partnerId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<PartnerHubView | null> => {
    const sb = asSb(context.supabase);
    const me = context.userId as string;

    const { data: pr } = await sb
      .from("business_partners")
      .select("id, name, company, role, email, phone, country, commodities, status")
      .eq("id", data.partnerId)
      .eq("owner_user_id", me)
      .maybeSingle();
    if (!pr) return null;
    const p = pr as Record<string, unknown>;
    const partner: PartnerHead = {
      id: String(p.id),
      name: String(p.name),
      company: (p.company as string | null) ?? null,
      role: String(p.role ?? "otro"),
      email: (p.email as string | null) ?? null,
      phone: (p.phone as string | null) ?? null,
      country: (p.country as string | null) ?? null,
      commodities: Array.isArray(p.commodities) ? (p.commodities as string[]) : [],
      status: String(p.status ?? "activo"),
    };

    // Trades donde esta contraparte está registrada (email preferido, si no nombre).
    let trades: HubTrade[] = [];
    try {
      const cols =
        "id, reference, commodity, quantity_t, total_value_usd, stage, status, buyer_user_id, seller_user_id, created_at";
      let q = sb.from("commodity_trades").select(cols).order("created_at", { ascending: false });
      q = partner.email
        ? q.ilike("counterparty_email", partner.email)
        : q.ilike("counterparty_name", partner.name);
      const { data: tr } = await q;
      trades = ((tr ?? []) as Array<Record<string, unknown>>).map((t) => ({
        id: String(t.id),
        reference: (t.reference as string | null) ?? null,
        commodity: (t.commodity as string | null) ?? null,
        quantity_t: t.quantity_t != null ? Number(t.quantity_t) : null,
        total_value_usd: t.total_value_usd != null ? Number(t.total_value_usd) : null,
        stage: String(t.stage ?? "icpo"),
        status: String(t.status ?? "active"),
        role: t.buyer_user_id === me ? "buyer" : t.seller_user_id === me ? "seller" : "desk",
        created_at: String(t.created_at),
      }));
    } catch (e) {
      console.error("[partnerHub] trades lookup failed", e);
    }

    // Comisiones del socio.
    let commissions: HubCommission[] = [];
    try {
      const { data: cm, error } = await sb
        .from("deal_commissions")
        .select("id, trade_id, deal_value_usd, commission_pct, commission_usd, status")
        .eq("partner_id", data.partnerId)
        .order("created_at", { ascending: false });
      if (error && !isMissing(error.message)) throw new Error(error.message);
      commissions = ((cm ?? []) as Array<Record<string, unknown>>).map((c) => ({
        id: String(c.id),
        trade_id: (c.trade_id as string | null) ?? null,
        deal_value_usd: c.deal_value_usd != null ? Number(c.deal_value_usd) : null,
        commission_pct: c.commission_pct != null ? Number(c.commission_pct) : null,
        commission_usd: c.commission_usd != null ? Number(c.commission_usd) : null,
        status: String(c.status ?? "pendiente") as CommissionStatus,
      }));
    } catch (e) {
      console.error("[partnerHub] commissions lookup failed", e);
    }

    return {
      partner,
      trades,
      commissions,
      summary: partnerHubSummary(trades, commissions),
    };
  });
