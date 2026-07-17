import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  aggregateClients,
  PARTNER_ROLES,
  PARTNER_STATUSES,
  type ClientAggregate,
  type TradeForClients,
} from "@/lib/clients";

// CRM de negocios: clientes (contrapartes reales de trades, derivados — no se
// inventa nada) y asociados comerciales (cartera manual en business_partners).

const asSb = (c: unknown): SupabaseClient => c as SupabaseClient;

export type ClientRow = ClientAggregate & {
  name: string | null;
  organization: string | null;
  country: string | null;
  /** Email solo de contrapartes con trade en común (relación ya establecida). */
  email: string | null;
};

export const getClientsOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ClientRow[]> => {
    const sb = asSb(context.supabase);
    const me = context.userId as string;

    const { data: trades } = await sb
      .from("commodity_trades")
      .select("id, buyer_user_id, seller_user_id, total_value_usd, stage, status, created_at")
      .order("created_at", { ascending: false })
      .limit(300);

    const aggs = aggregateClients((trades ?? []) as TradeForClients[], me);
    if (aggs.length === 0) return [];

    // Identidad de las contrapartes vía cliente admin (profiles ya no expone
    // PII entre usuarios): compartir trade ES la relación que lo justifica.
    let profs: Array<{
      user_id: string;
      display_name: string | null;
      organization: string | null;
      country: string | null;
      email: string | null;
    }> = [];
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data } = await supabaseAdmin
        .from("profiles")
        .select("user_id, display_name, organization, country, email")
        .in(
          "user_id",
          aggs.map((a) => a.userId),
        );
      profs = (data ?? []) as typeof profs;
    } catch (e) {
      console.error("[clients] profiles lookup failed", e);
    }
    const byId = new Map(profs.map((p) => [p.user_id, p]));

    return aggs.map((a) => {
      const p = byId.get(a.userId);
      return {
        ...a,
        name: p?.display_name ?? null,
        organization: p?.organization ?? null,
        country: p?.country ?? null,
        email: p?.email ?? null,
      };
    });
  });

// ---------- Asociados (business_partners) ----------

export type PartnerRow = {
  id: string;
  name: string;
  company: string | null;
  role: string;
  email: string | null;
  phone: string | null;
  country: string | null;
  commodities: string[];
  notes: string | null;
  status: string;
  created_at: string;
};

/** La tabla puede no existir hasta que Lovable aplique la migración. */
const isMissingTable = (msg: string) => /does not exist|relation|schema cache/i.test(msg);

export const listPartners = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ pending: boolean; partners: PartnerRow[] }> => {
    const { data, error } = await asSb(context.supabase)
      .from("business_partners")
      .select(
        "id, name, company, role, email, phone, country, commodities, notes, status, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) {
      if (isMissingTable(error.message)) return { pending: true, partners: [] };
      throw new Error(error.message);
    }
    return { pending: false, partners: (data ?? []) as PartnerRow[] };
  });

const PartnerInput = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2).max(120),
  company: z.string().trim().max(160).optional(),
  role: z.enum(PARTNER_ROLES),
  email: z.string().trim().email().max(160).optional(),
  phone: z.string().trim().max(40).optional(),
  country: z.string().trim().max(60).optional(),
  commodities: z.array(z.string().trim().min(1).max(40)).max(12).optional(),
  notes: z.string().trim().max(1000).optional(),
  status: z.enum(PARTNER_STATUSES).default("activo"),
});

export const upsertPartner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => PartnerInput.parse(d))
  .handler(async ({ data, context }) => {
    const sb = asSb(context.supabase);
    const row = {
      owner_user_id: context.userId as string,
      name: data.name,
      company: data.company ?? null,
      role: data.role,
      email: data.email ?? null,
      phone: data.phone ?? null,
      country: data.country ?? null,
      commodities: data.commodities ?? [],
      notes: data.notes ?? null,
      status: data.status,
    };
    const q = data.id
      ? sb
          .from("business_partners")
          .update(row)
          .eq("id", data.id)
          .eq("owner_user_id", context.userId as string)
          .select("id")
          .single()
      : sb.from("business_partners").insert(row).select("id").single();
    const { data: saved, error } = await q;
    if (error) {
      if (isMissingTable(error.message))
        throw new Error(
          "El módulo de asociados estará disponible tras aplicar la última migración.",
        );
      throw new Error(error.message);
    }
    return { id: (saved as { id: string }).id };
  });

export const deletePartner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await asSb(context.supabase)
      .from("business_partners")
      .delete()
      .eq("id", data.id)
      .eq("owner_user_id", context.userId as string);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
