import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const productSchema = z.object({
  product_name: z.string().min(2),
  hs_code: z.string().optional(),
  purity: z.string().optional(),
  grade: z.string().optional(),
  qty_monthly_mt: z.number().nullable().optional(),
  qty_total_mt: z.number().nullable().optional(),
  preferred_origin: z.string().optional(),
  packaging: z.string().optional(),
  port_loading: z.string().optional(),
  port_destination: z.string().optional(),
  incoterm: z.string().optional(),
  target_price_usd: z.number().nullable().optional(),
});

const rfqSchema = z.object({
  buyer_name: z.string().min(2),
  buyer_company: z.string().optional(),
  destination_country: z.string().optional(),
  destination_port: z.string().optional(),
  incoterm: z.string().optional(),
  currency: z.string().default("USD"),
  validity_date: z.string().optional(),
  contract_duration_months: z.number().int().nullable().optional(),
  notes: z.string().optional(),
  is_public: z.boolean().default(true),
  products: z.array(productSchema).min(1).max(20),
});

function makeRef() {
  const d = new Date();
  const s = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  return `RFQ-${s}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
}

export const createRfq = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => rfqSchema.parse(raw))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rfq, error } = await supabaseAdmin
      .from("rfqs")
      .insert({
        public_ref: makeRef(),
        created_by: context.userId,
        buyer_name: data.buyer_name,
        buyer_company: data.buyer_company,
        destination_country: data.destination_country,
        destination_port: data.destination_port,
        incoterm: data.incoterm,
        currency: data.currency,
        validity_date: data.validity_date || null,
        contract_duration_months: data.contract_duration_months ?? null,
        notes: data.notes,
        is_public: data.is_public,
        status: "publicado",
      })
      .select("id, public_ref")
      .single();
    if (error) throw error;

    const rows = data.products.map((p) => ({ ...p, rfq_id: rfq.id }));
    const { error: perr } = await supabaseAdmin.from("rfq_products").insert(rows);
    if (perr) throw perr;

    return { id: rfq.id, public_ref: rfq.public_ref };
  });

export const listMyRfqs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("rfqs")
      .select("id, public_ref, buyer_company, buyer_name, status, destination_country, incoterm, created_at, is_public")
      .eq("created_by", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  });

export const getRfqDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const { data: rfq, error } = await context.supabase.from("rfqs").select("*").eq("id", data.id).maybeSingle();
    if (error) throw error;
    if (!rfq) throw new Error("RFQ no encontrado o sin acceso");
    const { data: products } = await context.supabase.from("rfq_products").select("*").eq("rfq_id", data.id);
    const { data: apps } = await context.supabase
      .from("rfq_applications")
      .select("id, supplier_id, status, application_score, notes, created_at")
      .eq("rfq_id", data.id)
      .order("created_at", { ascending: false });

    // Enrich applications with supplier + risk
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const ids = (apps ?? []).map((a) => a.supplier_id);
    const { data: suppliers } = ids.length
      ? await supabaseAdmin
          .from("suppliers")
          .select("id, folio, legal_name, country, status")
          .in("id", ids)
      : { data: [] as Array<{ id: string; folio: string; legal_name: string; country: string; status: string }> };
    const supMap = new Map((suppliers ?? []).map((s) => [s.id, s]));

    const enriched = await Promise.all(
      (apps ?? []).map(async (a) => {
        const { data: risk } = await supabaseAdmin.rpc("compute_supplier_risk_score", { _supplier_id: a.supplier_id });
        const r = Array.isArray(risk) ? risk[0] : risk;
        return { ...a, supplier: supMap.get(a.supplier_id), risk: r ?? null };
      }),
    );

    return { rfq, products: products ?? [], applications: enriched };
  });

export const closeRfq = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z.object({ id: z.string().uuid(), status: z.enum(["publicado", "en_evaluacion", "adjudicado", "cerrado", "cancelado"]) }).parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("rfqs").update({ status: data.status }).eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

// application_status enum values (shared with trade module)
export const APP_STATUSES = ["pending", "review", "approved", "rejected"] as const;
export type AppStatus = (typeof APP_STATUSES)[number];

export const decideApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(APP_STATUSES),
        notes: z.string().optional(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("rfq_applications")
      .update({ status: data.status, notes: data.notes ?? null })
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

// Public marketplace — no auth required
export const listPublicRfqs = createServerFn({ method: "GET" }).handler(async () => {
  const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
  const url = process.env.SUPABASE_URL!;
  const anon = createClient(url, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
  const { data: rfqs, error } = await anon
    .from("rfqs")
    .select("id, public_ref, buyer_company, buyer_name, destination_country, incoterm, currency, created_at, validity_date, status")
    .eq("is_public", true)
    .in("status", ["publicado", "en_evaluacion"])
    .order("created_at", { ascending: false })
    .limit(60);
  if (error) throw error;
  const ids = (rfqs ?? []).map((r) => r.id);
  const { data: products } = ids.length
    ? await anon.from("rfq_products").select("rfq_id, product_name, qty_monthly_mt, qty_total_mt, incoterm, port_destination").in("rfq_id", ids)
    : { data: [] };
  const byRfq = new Map<string, Array<Record<string, unknown>>>();
  for (const p of products ?? []) {
    const arr = byRfq.get(p.rfq_id as string) ?? [];
    arr.push(p as Record<string, unknown>);
    byRfq.set(p.rfq_id as string, arr);
  }
  return (rfqs ?? []).map((r) => ({ ...r, products: byRfq.get(r.id) ?? [] }));
});

export const applyToRfq = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z.object({ rfq_id: z.string().uuid(), supplier_id: z.string().uuid(), notes: z.string().optional() }).parse(raw),
  )
  .handler(async ({ data, context }) => {
    // owner check
    const { data: sup } = await context.supabase
      .from("suppliers")
      .select("id, owner_user_id")
      .eq("id", data.supplier_id)
      .maybeSingle();
    if (!sup || sup.owner_user_id !== context.userId) throw new Error("No autorizado sobre este proveedor");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: risk } = await supabaseAdmin.rpc("compute_supplier_risk_score", { _supplier_id: data.supplier_id });
    const r = Array.isArray(risk) ? risk[0] : risk;

    const { data: app, error } = await supabaseAdmin
      .from("rfq_applications")
      .insert({
        rfq_id: data.rfq_id,
        supplier_id: data.supplier_id,
        status: "postulado",
        notes: data.notes,
        application_score: r?.risk_score ?? null,
      })
      .select("id")
      .single();
    if (error) throw error;
    return { id: app.id };
  });
