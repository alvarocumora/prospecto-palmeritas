import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

// Mesa de Origen: server fns con RLS del usuario (cliente casteado sin tipar
// por ser tablas nuevas). El dueño del mandato/partner y el super admin acceden.

const asSb = (c: unknown): SupabaseClient => c as SupabaseClient;

export type MandateRow = {
  id: string;
  reference: string | null;
  title: string;
  commodity: string;
  form: string | null;
  spec: string | null;
  quantity_t: number | null;
  frequency: string;
  incoterm: string | null;
  destination: string | null;
  target_price_usd: number | null;
  price_basis: string | null;
  payment_instrument: string | null;
  buyer_company: string | null;
  buyer_contact: string | null;
  status: string;
  priority: string;
  notes: string | null;
  owner_user_id: string;
  created_at: string;
};

export type PartnerRow = {
  id: string;
  company_name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  country: string | null;
  region: string | null;
  partner_type: string;
  commodities: string[];
  forms: string[];
  monthly_capacity_t: number | null;
  vetting_status: string;
  kyc_notes: string | null;
  notes: string | null;
  created_at: string;
};

export type MatchRow = {
  id: string;
  mandate_id: string;
  partner_id: string;
  lot_id: string | null;
  trade_id: string | null;
  stage: string;
  offered_quantity_t: number | null;
  offered_price_usd: number | null;
  assay_summary: string | null;
  next_action: string | null;
  next_action_date: string | null;
  notes: string | null;
  created_at: string;
};

const MANDATE_COLS =
  "id, reference, title, commodity, form, spec, quantity_t, frequency, incoterm, destination, target_price_usd, price_basis, payment_instrument, buyer_company, buyer_contact, status, priority, notes, owner_user_id, created_at";
const PARTNER_COLS =
  "id, company_name, contact_name, email, phone, country, region, partner_type, commodities, forms, monthly_capacity_t, vetting_status, kyc_notes, notes, created_at";
const MATCH_COLS =
  "id, mandate_id, partner_id, lot_id, trade_id, stage, offered_quantity_t, offered_price_usd, assay_summary, next_action, next_action_date, notes, created_at";

/** Estado completo de la mesa: mandatos + proveedores + matches del usuario. */
export const getSupplyDesk = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = asSb(context.supabase);
    const [mandates, partners, matches] = await Promise.all([
      sb.from("supply_mandates").select(MANDATE_COLS).order("created_at", { ascending: false }).limit(200),
      sb.from("supply_partners").select(PARTNER_COLS).order("created_at", { ascending: false }).limit(500),
      sb.from("mandate_matches").select(MATCH_COLS).order("created_at", { ascending: false }).limit(1000),
    ]);
    if (mandates.error) throw new Error(mandates.error.message);
    if (partners.error) throw new Error(partners.error.message);
    if (matches.error) throw new Error(matches.error.message);
    return {
      mandates: (mandates.data ?? []) as MandateRow[],
      partners: (partners.data ?? []) as PartnerRow[],
      matches: (matches.data ?? []) as MatchRow[],
    };
  });

const mandateInput = z.object({
  id: z.string().uuid().optional(),
  reference: z.string().max(60).optional(),
  title: z.string().min(3).max(200),
  commodity: z.string().min(1).max(20),
  form: z.string().max(40).optional(),
  spec: z.string().max(2000).optional(),
  quantityT: z.number().positive().optional(),
  frequency: z.enum(["spot", "monthly", "quarterly", "annual"]).default("spot"),
  incoterm: z.string().max(10).optional(),
  destination: z.string().max(200).optional(),
  targetPriceUsd: z.number().positive().optional(),
  priceBasis: z.string().max(200).optional(),
  paymentInstrument: z.string().max(30).optional(),
  buyerCompany: z.string().max(200).optional(),
  buyerContact: z.string().max(200).optional(),
  status: z.enum(["draft", "active", "paused", "fulfilled", "closed"]).optional(),
  priority: z.enum(["low", "normal", "high", "critical"]).optional(),
  notes: z.string().max(4000).optional(),
});

/** Crea o actualiza un mandato de compra (demanda). */
export const upsertMandate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => mandateInput.parse(d))
  .handler(async ({ data, context }) => {
    const sb = asSb(context.supabase);
    const row = {
      reference: data.reference ?? null,
      title: data.title,
      commodity: data.commodity,
      form: data.form ?? null,
      spec: data.spec ?? null,
      quantity_t: data.quantityT ?? null,
      frequency: data.frequency,
      incoterm: data.incoterm ?? null,
      destination: data.destination ?? null,
      target_price_usd: data.targetPriceUsd ?? null,
      price_basis: data.priceBasis ?? null,
      payment_instrument: data.paymentInstrument ?? null,
      buyer_company: data.buyerCompany ?? null,
      buyer_contact: data.buyerContact ?? null,
      ...(data.status ? { status: data.status } : {}),
      ...(data.priority ? { priority: data.priority } : {}),
      notes: data.notes ?? null,
    };
    if (data.id) {
      const { error } = await sb.from("supply_mandates").update(row).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: inserted, error } = await sb
      .from("supply_mandates")
      .insert({ ...row, owner_user_id: context.userId, created_by: context.userId })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: (inserted as { id: string }).id };
  });

const partnerInput = z.object({
  id: z.string().uuid().optional(),
  companyName: z.string().min(2).max(200),
  contactName: z.string().max(200).optional(),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().max(50).optional(),
  country: z.string().max(80).optional(),
  region: z.string().max(120).optional(),
  partnerType: z.enum(["producer", "trader", "aggregator", "agent", "refiner"]).default("producer"),
  commodities: z.array(z.string().max(20)).max(20).default([]),
  forms: z.array(z.string().max(40)).max(20).default([]),
  monthlyCapacityT: z.number().positive().optional(),
  vettingStatus: z
    .enum(["prospect", "contacted", "nda", "docs_review", "verified", "rejected"])
    .optional(),
  kycNotes: z.string().max(4000).optional(),
  notes: z.string().max(4000).optional(),
});

/** Crea o actualiza un asociado/proveedor de la red. */
export const upsertPartner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => partnerInput.parse(d))
  .handler(async ({ data, context }) => {
    const sb = asSb(context.supabase);
    const row = {
      company_name: data.companyName,
      contact_name: data.contactName ?? null,
      email: data.email || null,
      phone: data.phone ?? null,
      country: data.country ?? null,
      region: data.region ?? null,
      partner_type: data.partnerType,
      commodities: data.commodities,
      forms: data.forms,
      monthly_capacity_t: data.monthlyCapacityT ?? null,
      ...(data.vettingStatus ? { vetting_status: data.vettingStatus } : {}),
      kyc_notes: data.kycNotes ?? null,
      notes: data.notes ?? null,
    };
    if (data.id) {
      const { error } = await sb.from("supply_partners").update(row).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: inserted, error } = await sb
      .from("supply_partners")
      .insert({ ...row, owner_user_id: context.userId, created_by: context.userId })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: (inserted as { id: string }).id };
  });

/** Conecta un proveedor a un mandato (inicia el pipeline en `identified`). */
export const createMatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        mandateId: z.string().uuid(),
        partnerId: z.string().uuid(),
        offeredQuantityT: z.number().positive().optional(),
        notes: z.string().max(4000).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const sb = asSb(context.supabase);
    const { data: inserted, error } = await sb
      .from("mandate_matches")
      .insert({
        mandate_id: data.mandateId,
        partner_id: data.partnerId,
        offered_quantity_t: data.offeredQuantityT ?? null,
        notes: data.notes ?? null,
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (error) {
      if (error.code === "23505") throw new Error("Ese proveedor ya está conectado a este mandato.");
      throw new Error(error.message);
    }
    return { id: (inserted as { id: string }).id };
  });

/** Actualiza el estado del match (etapa, cantidades, ensayo, próximos pasos). */
export const updateMatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        stage: z
          .enum([
            "identified",
            "contacted",
            "ncnda",
            "sampling",
            "qualified",
            "offer",
            "allocated",
            "trade",
            "dropped",
          ])
          .optional(),
        offeredQuantityT: z.number().positive().nullable().optional(),
        offeredPriceUsd: z.number().positive().nullable().optional(),
        assaySummary: z.string().max(2000).nullable().optional(),
        nextAction: z.string().max(500).nullable().optional(),
        nextActionDate: z.string().date().nullable().optional(),
        notes: z.string().max(4000).nullable().optional(),
        tradeId: z.string().uuid().nullable().optional(),
        lotId: z.string().uuid().nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const sb = asSb(context.supabase);
    const row: Record<string, unknown> = {};
    if (data.stage !== undefined) row.stage = data.stage;
    if (data.offeredQuantityT !== undefined) row.offered_quantity_t = data.offeredQuantityT;
    if (data.offeredPriceUsd !== undefined) row.offered_price_usd = data.offeredPriceUsd;
    if (data.assaySummary !== undefined) row.assay_summary = data.assaySummary;
    if (data.nextAction !== undefined) row.next_action = data.nextAction;
    if (data.nextActionDate !== undefined) row.next_action_date = data.nextActionDate;
    if (data.notes !== undefined) row.notes = data.notes;
    if (data.tradeId !== undefined) row.trade_id = data.tradeId;
    if (data.lotId !== undefined) row.lot_id = data.lotId;
    if (Object.keys(row).length === 0) return { id: data.id };
    const { error } = await sb.from("mandate_matches").update(row).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { id: data.id };
  });
