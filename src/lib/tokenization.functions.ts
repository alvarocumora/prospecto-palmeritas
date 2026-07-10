import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import {
  offeringStats,
  capTable,
  validateSubscription,
  type OfferingLike,
  type SubscriptionLike,
} from "@/lib/tokenization";

// Sistema de tokenización (ofertas de participación fraccionada). Las tablas
// asset_offerings / offering_subscriptions son nuevas (no están en types.ts), así
// que se accede con el cliente del usuario (RLS aplicado) casteado sin tipar.

type Sb = SupabaseClient;
// El cliente inyectado por el middleware viene tipado con Database; se relaja
// para las tablas nuevas sin perder el enforcement de RLS del rol del usuario.
const asSb = (c: unknown): Sb => c as Sb;

export type OfferingRow = {
  id: string;
  project_id: string;
  token_symbol: string;
  title: string;
  description: string | null;
  instrument: string;
  total_units: number;
  price_per_unit_usd: number;
  currency: string;
  min_units: number;
  status: string;
  terms_url: string | null;
  opens_at: string | null;
  closes_at: string | null;
  created_at: string;
};

const OFFERING_COLS =
  "id, project_id, token_symbol, title, description, instrument, total_units, price_per_unit_usd, currency, min_units, status, terms_url, opens_at, closes_at, created_at";

/** Lista ofertas abiertas + (si aplica) las de proyectos del usuario, con stats. */
export const listOfferings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = asSb(context.supabase);
    const { data: offerings, error } = await sb
      .from("asset_offerings")
      .select(OFFERING_COLS)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    const rows = (offerings ?? []) as OfferingRow[];
    if (rows.length === 0) return [];

    const ids = rows.map((r) => r.id);
    const { data: subs } = await sb
      .from("offering_subscriptions")
      .select("offering_id, investor_user_id, units, status")
      .in("offering_id", ids);
    const byOffering = new Map<string, SubscriptionLike[]>();
    for (const s of (subs ?? []) as Array<SubscriptionLike & { offering_id: string }>) {
      const arr = byOffering.get(s.offering_id) ?? [];
      arr.push(s);
      byOffering.set(s.offering_id, arr);
    }
    return rows.map((o) => ({ ...o, stats: offeringStats(o, byOffering.get(o.id) ?? []) }));
  });

/** Detalle de una oferta + cap table (visible según RLS). */
export const getOfferingDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = asSb(context.supabase);
    const { data: offering, error } = await sb
      .from("asset_offerings")
      .select(OFFERING_COLS)
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!offering) return null;
    const o = offering as OfferingRow;
    const { data: subs } = await sb
      .from("offering_subscriptions")
      .select("investor_user_id, units, status, amount_usd, created_at")
      .eq("offering_id", data.id);
    const list = (subs ?? []) as SubscriptionLike[];
    return { offering: o, stats: offeringStats(o, list), capTable: capTable(list, o) };
  });

const CreateInput = z.object({
  projectId: z.string().uuid(),
  tokenSymbol: z.string().trim().min(1).max(12),
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().max(2000).optional(),
  instrument: z.enum(["participation", "royalty", "equity", "debt"]).default("participation"),
  totalUnits: z.number().int().min(1).max(100_000_000),
  pricePerUnitUsd: z.number().min(0).max(1_000_000_000),
  minUnits: z.number().int().min(1).max(100_000_000).default(1),
  termsUrl: z.string().url().max(500).optional(),
});

/** Crea una oferta (RLS exige rol owner/admin del proyecto). */
export const createOffering = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CreateInput.parse(d))
  .handler(async ({ data, context }) => {
    const sb = asSb(context.supabase);
    const { data: row, error } = await sb
      .from("asset_offerings")
      .insert({
        project_id: data.projectId,
        created_by: context.userId,
        token_symbol: data.tokenSymbol.toUpperCase(),
        title: data.title,
        description: data.description ?? null,
        instrument: data.instrument,
        total_units: data.totalUnits,
        price_per_unit_usd: data.pricePerUnitUsd,
        min_units: Math.min(data.minUnits, data.totalUnits),
        terms_url: data.termsUrl ?? null,
        status: "draft",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: (row as { id: string }).id };
  });

/** Cambia el estado de una oferta (draft→open→closed / cancelled). */
export const setOfferingStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["draft", "open", "closed", "cancelled"]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const sb = asSb(context.supabase);
    const patch: Record<string, unknown> = { status: data.status };
    if (data.status === "open") patch.opens_at = new Date().toISOString();
    if (data.status === "closed") patch.closes_at = new Date().toISOString();
    const { error } = await sb.from("asset_offerings").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Un inversionista compromete unidades en una oferta abierta. */
export const subscribeOffering = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ offeringId: z.string().uuid(), units: z.number().int().min(1) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const sb = asSb(context.supabase);
    const { data: offering } = await sb
      .from("asset_offerings")
      .select("id, total_units, price_per_unit_usd, min_units, status")
      .eq("id", data.offeringId)
      .maybeSingle();
    if (!offering) throw new Error("Oferta no encontrada.");
    const o = offering as OfferingRow & { status: string };
    if (o.status !== "open") throw new Error("La oferta no está abierta.");

    const { data: subs } = await sb
      .from("offering_subscriptions")
      .select("investor_user_id, units, status")
      .eq("offering_id", data.offeringId);
    const stats = offeringStats(o as OfferingLike, (subs ?? []) as SubscriptionLike[]);
    const v = validateSubscription(data.units, o as OfferingLike, stats.unitsAvailable);
    if (!v.ok) throw new Error(v.error);

    const { error } = await sb.from("offering_subscriptions").insert({
      offering_id: data.offeringId,
      investor_user_id: context.userId,
      units: data.units,
      amount_usd: data.units * o.price_per_unit_usd,
      status: "pending",
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Actualiza el estado de una suscripción (inversionista cancela; dueño confirma/rechaza). */
export const setSubscriptionStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["confirmed", "rejected", "cancelled"]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const sb = asSb(context.supabase);
    const { error } = await sb
      .from("offering_subscriptions")
      .update({ status: data.status })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Participaciones del inversionista autenticado, con datos de la oferta. */
export const listMyHoldings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = asSb(context.supabase);
    const { data: subs, error } = await sb
      .from("offering_subscriptions")
      .select("id, offering_id, units, amount_usd, status, created_at")
      .eq("investor_user_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const rows = (subs ?? []) as Array<{
      id: string;
      offering_id: string;
      units: number;
      amount_usd: number;
      status: string;
      created_at: string;
    }>;
    if (rows.length === 0) return [];
    const offeringIds = Array.from(new Set(rows.map((r) => r.offering_id)));
    const { data: offerings } = await sb
      .from("asset_offerings")
      .select("id, token_symbol, title, total_units, price_per_unit_usd, status")
      .in("id", offeringIds);
    const byId = new Map(((offerings ?? []) as OfferingRow[]).map((o) => [o.id, o]));
    return rows.map((r) => {
      const o = byId.get(r.offering_id);
      return {
        ...r,
        token_symbol: o?.token_symbol ?? "—",
        title: o?.title ?? "Oferta",
        pct: o && o.total_units > 0 ? (r.units / o.total_units) * 100 : 0,
        offering_status: o?.status ?? null,
      };
    });
  });
