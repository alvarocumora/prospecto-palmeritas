import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getAdvanceOffer } from "@/lib/underwriting.functions";
import {
  canRequestAdvance,
  validateRequestedAmount,
  canTransition,
  type AdvanceStatus,
} from "@/lib/advanceRequests";

// Registro y workflow de solicitudes de anticipo. El productor solicita contra
// su lote (snapshot de la oferta del motor de underwriting); el financista
// (super admin) avanza el estado. No mueve dinero.

const asSb = (c: unknown): SupabaseClient => c as SupabaseClient;

export type AdvanceRequestRow = {
  id: string;
  lot_id: string;
  lot_title: string | null;
  eligibility: string;
  advance_rate_pct: number;
  max_advance_usd: number;
  requested_amount_usd: number;
  purpose: string | null;
  status: AdvanceStatus;
  decision_notes: string | null;
  created_at: string;
  requester_user_id: string;
};

// ---------- Productor: crear solicitud ----------
const CreateInput = z.object({
  lotId: z.string().uuid(),
  requestedAmountUsd: z.number().positive(),
  purpose: z.string().trim().max(500).optional(),
});

export const createAdvanceRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CreateInput.parse(d))
  .handler(async ({ data, context }) => {
    const userId = context.userId as string;

    // Solo el vendedor del lote puede solicitar un anticipo contra él.
    const { data: lot } = await supabaseAdmin
      .from("commodity_lots")
      .select("seller_user_id, title")
      .eq("id", data.lotId)
      .maybeSingle();
    if (!lot) throw new Error("Lote no encontrado.");
    if ((lot as { seller_user_id: string }).seller_user_id !== userId) {
      throw new Error("Solo el vendedor del lote puede solicitar un anticipo.");
    }

    // No permitir una segunda solicitud activa sobre el mismo lote.
    const { data: existing } = await asSb(context.supabase)
      .from("advance_requests")
      .select("id, status")
      .eq("lot_id", data.lotId)
      .eq("requester_user_id", userId)
      .in("status", ["requested", "under_review", "approved"])
      .maybeSingle();
    if (existing) throw new Error("Ya existe una solicitud activa para este lote.");

    // Recalcular la oferta en el servidor (no confiar en el cliente).
    const offer = await getAdvanceOffer({ data: { lotId: data.lotId } });
    if (!canRequestAdvance(offer.eligibility)) {
      throw new Error("El lote no es elegible para un anticipo por ahora.");
    }
    const check = validateRequestedAmount(data.requestedAmountUsd, offer.maxAdvanceUsd);
    if (!check.ok) throw new Error(check.error);

    const { data: row, error } = await asSb(context.supabase)
      .from("advance_requests")
      .insert({
        lot_id: data.lotId,
        requester_user_id: userId,
        eligibility: offer.eligibility,
        advance_rate_pct: offer.advanceRatePct,
        max_advance_usd: offer.maxAdvanceUsd,
        lot_value_usd: offer.lotValueUsd,
        risk_score: offer.riskScore,
        indicative_fee_pct: offer.indicativeFeePct,
        tenor_days: offer.tenorDays,
        offer_snapshot: { factors: offer.factors, conditions: offer.conditions },
        requested_amount_usd: data.requestedAmountUsd,
        purpose: data.purpose ?? null,
        status: "requested",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: (row as { id: string }).id };
  });

// ---------- Productor: listar mis solicitudes ----------
export const listMyAdvanceRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdvanceRequestRow[]> => {
    const userId = context.userId as string;
    const { data } = await asSb(context.supabase)
      .from("advance_requests")
      .select("*, lot:commodity_lots(title)")
      .eq("requester_user_id", userId)
      .order("created_at", { ascending: false });
    return mapRows(data ?? []);
  });

// ---------- Productor: cancelar ----------
export const cancelAdvanceRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = asSb(context.supabase);
    const { data: req } = await sb
      .from("advance_requests")
      .select("status, requester_user_id")
      .eq("id", data.id)
      .maybeSingle();
    if (!req) throw new Error("Solicitud no encontrada.");
    if ((req as { requester_user_id: string }).requester_user_id !== context.userId) {
      throw new Error("No autorizado.");
    }
    const current = (req as { status: AdvanceStatus }).status;
    if (!canTransition("requester", current, "cancelled")) {
      throw new Error("La solicitud no se puede cancelar en su estado actual.");
    }
    const { error } = await sb
      .from("advance_requests")
      .update({ status: "cancelled" })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Financista (super admin): cola y decisión ----------
async function assertFunder(context: { supabase: unknown; userId: unknown }): Promise<void> {
  const { data: isAdmin } = await asSb(context.supabase).rpc("is_super_admin", {
    _user_id: context.userId as string,
  });
  if (!isAdmin) throw new Error("Solo un financista autorizado puede revisar solicitudes.");
}

export const listAdvanceFundingQueue = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdvanceRequestRow[]> => {
    await assertFunder(context);
    // RLS deja al super admin ver todas.
    const { data } = await asSb(context.supabase)
      .from("advance_requests")
      .select("*, lot:commodity_lots(title)")
      .order("created_at", { ascending: false })
      .limit(500);
    return mapRows(data ?? []);
  });

const StatusInput = z.object({
  id: z.string().uuid(),
  status: z.enum(["under_review", "approved", "funded", "rejected"]),
  notes: z.string().trim().max(1000).optional(),
});

export const setAdvanceRequestStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => StatusInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertFunder(context);
    const sb = asSb(context.supabase);
    const { data: req } = await sb
      .from("advance_requests")
      .select("status")
      .eq("id", data.id)
      .maybeSingle();
    if (!req) throw new Error("Solicitud no encontrada.");
    const current = (req as { status: AdvanceStatus }).status;
    if (!canTransition("funder", current, data.status)) {
      throw new Error(`Transición no permitida: ${current} → ${data.status}.`);
    }
    const { error } = await sb
      .from("advance_requests")
      .update({
        status: data.status,
        decision_notes: data.notes ?? null,
        reviewer_user_id: context.userId as string,
        decided_at: new Date().toISOString(),
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

function mapRows(rows: unknown[]): AdvanceRequestRow[] {
  return (rows as Array<Record<string, unknown>>).map((r) => ({
    id: r.id as string,
    lot_id: r.lot_id as string,
    lot_title: ((r.lot as { title?: string } | null)?.title ?? null) as string | null,
    eligibility: r.eligibility as string,
    advance_rate_pct: Number(r.advance_rate_pct),
    max_advance_usd: Number(r.max_advance_usd),
    requested_amount_usd: Number(r.requested_amount_usd),
    purpose: (r.purpose ?? null) as string | null,
    status: r.status as AdvanceStatus,
    decision_notes: (r.decision_notes ?? null) as string | null,
    created_at: r.created_at as string,
    requester_user_id: r.requester_user_id as string,
  }));
}
