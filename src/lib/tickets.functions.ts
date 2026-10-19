/**
 * Tickets de inversión por proyecto (Cholqui, Los Verdes – Tilama).
 * Inversionista: crea/envía su ticket, firma y declara pago vía RPC SECURITY DEFINER.
 * Staff: configura la ronda de la SPV, emite contrato, liquida o cancela.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Sb = any;

async function isStaff(supabase: Sb, userId: string): Promise<boolean> {
  const { data } = await supabase.rpc("is_geocapitals_staff", { _user_id: userId });
  return !!data;
}

export type RoundSpv = {
  id: string;
  project_code: string;
  legal_name: string;
  rut: string | null;
  total_shares: number;
  share_price: number | null;
  currency: string;
  tickets_open: boolean;
  round_size: number | null;
  min_ticket: number | null;
  round_shares: number | null;
  escrow_instructions: string | null;
};

export type TicketRow = {
  id: string;
  ticket_code: string;
  investor_user_id: string;
  spv_id: string | null;
  amount: number;
  currency: string;
  share_price: number | null;
  shares_allocated: number | null;
  instrument_type: string;
  status: string;
  contract_hash: string | null;
  signed_at: string | null;
  investor_signature_name: string | null;
  payment_proof_url: string | null;
  payment_submitted_at: string | null;
  payment_verified_at: string | null;
  spv_position_id: string | null;
  cancel_reason: string | null;
  created_at: string;
};

const SPV_COLS =
  "id, project_code, legal_name, rut, total_shares, share_price, currency, tickets_open, round_size, min_ticket, round_shares, escrow_instructions";
const TICKET_COLS =
  "id, ticket_code, investor_user_id, spv_id, amount, currency, share_price, shares_allocated, instrument_type, status, contract_hash, signed_at, investor_signature_name, payment_proof_url, payment_submitted_at, payment_verified_at, spv_position_id, cancel_reason, created_at";

const Code = z.object({ projectCode: z.string().min(2).max(40) });

export const getProjectRound = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => Code.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: spv } = await supabase
      .from("spv_entities")
      .select(SPV_COLS)
      .eq("project_code", data.projectCode)
      .maybeSingle();
    const { data: status } = await supabase.rpc("spv_round_status", {
      _project_code: data.projectCode,
    });
    const st = Array.isArray(status) ? status[0] : null;
    let mine: TicketRow[] = [];
    if (spv) {
      const { data: rows } = await supabase
        .from("investment_tickets")
        .select(TICKET_COLS)
        .eq("spv_id", spv.id)
        .eq("investor_user_id", userId)
        .order("created_at", { ascending: false });
      mine = (rows ?? []) as TicketRow[];
    }
    const { data: profile } = await supabase
      .from("investor_profiles")
      .select("review_status")
      .eq("user_id", userId)
      .maybeSingle();
    return {
      spv: (spv ?? null) as RoundSpv | null,
      committed: Number(st?.committed ?? 0),
      settled: Number(st?.settled ?? 0),
      ticketsCount: Number(st?.tickets_count ?? 0),
      mine,
      kycStatus: (profile?.review_status as string | undefined) ?? null,
    };
  });

export const createTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        projectCode: z.string().min(2).max(40),
        amount: z.number().positive().max(1e10),
        riskAccepted: z.literal(true),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: spv } = await supabase
      .from("spv_entities")
      .select("id, currency, tickets_open, min_ticket, share_price")
      .eq("project_code", data.projectCode)
      .maybeSingle();
    if (!spv || !spv.tickets_open) throw new Error("La ronda de este proyecto no está abierta.");
    if (!spv.share_price) throw new Error("La SPV aún no tiene precio por acción definido.");
    if (spv.min_ticket && data.amount < Number(spv.min_ticket))
      throw new Error("El monto está bajo el ticket mínimo.");
    const { data: row, error } = await supabase
      .from("investment_tickets")
      .insert({
        investor_user_id: userId,
        spv_id: spv.id,
        listing_ref: data.projectCode,
        amount: data.amount,
        currency: spv.currency,
        instrument_type: "equity_spv",
        status: "draft",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    const { error: e2 } = await supabase.rpc("ticket_submit_for_review", { _ticket_id: row.id });
    if (e2) throw new Error(e2.message);
    return { id: row.id as string };
  });

export const signTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        ticketId: z.string().uuid(),
        signatureName: z.string().min(3).max(200),
        contractHash: z.string().min(32).max(128),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("ticket_sign_contract", {
      _ticket_id: data.ticketId,
      _signature_name: data.signatureName,
      _contract_hash: data.contractHash,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const submitTicketPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ ticketId: z.string().uuid(), proof: z.string().min(4).max(500) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("ticket_submit_payment", {
      _ticket_id: data.ticketId,
      _proof_url: data.proof,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const cancelTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ ticketId: z.string().uuid(), reason: z.string().max(500).nullable() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("ticket_cancel", {
      _ticket_id: data.ticketId,
      _reason: data.reason ?? undefined,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ---------------------------- Staff ---------------------------- */

export const listTicketsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ codes: z.array(z.string()).max(10) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!(await isStaff(supabase, userId))) throw new Error("No autorizado");
    const { data: spvs } = await supabase
      .from("spv_entities")
      .select(SPV_COLS)
      .in("project_code", data.codes);
    const ids = (spvs ?? []).map((s: { id: string }) => s.id);
    const { data: tickets } = ids.length
      ? await supabase
          .from("investment_tickets")
          .select(TICKET_COLS)
          .in("spv_id", ids)
          .order("created_at", { ascending: false })
      : { data: [] };
    const userIds = Array.from(new Set((tickets ?? []).map((t: TicketRow) => t.investor_user_id)));
    const { data: profiles } = userIds.length
      ? await supabase
          .from("investor_profiles")
          .select("user_id, full_name, company_name, tax_id, review_status, is_accredited")
          .in("user_id", userIds)
      : { data: [] };
    return {
      spvs: (spvs ?? []) as RoundSpv[],
      tickets: (tickets ?? []) as TicketRow[],
      profiles: (profiles ?? []) as Array<{
        user_id: string;
        full_name: string;
        company_name: string | null;
        tax_id: string | null;
        review_status: string;
        is_accredited: boolean | null;
      }>,
    };
  });

export const saveRoundSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        projectCode: z.string().min(2).max(40),
        legalName: z.string().min(2).max(200),
        rut: z.string().max(40).nullable(),
        totalShares: z.number().min(0),
        sharePrice: z.number().positive().nullable(),
        currency: z.enum(["USD", "CLP", "UF"]),
        roundSize: z.number().positive().nullable(),
        minTicket: z.number().positive().nullable(),
        roundShares: z.number().positive().nullable(),
        escrowInstructions: z.string().max(2000).nullable(),
        ticketsOpen: z.boolean(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!(await isStaff(supabase, userId))) throw new Error("No autorizado");
    if (data.ticketsOpen && (!data.sharePrice || !data.minTicket))
      throw new Error("Para abrir la ronda define precio por acción y ticket mínimo.");
    const { error } = await supabase.from("spv_entities").upsert(
      {
        project_code: data.projectCode,
        legal_name: data.legalName,
        rut: data.rut,
        total_shares: data.totalShares,
        share_price: data.sharePrice,
        currency: data.currency,
        round_size: data.roundSize,
        min_ticket: data.minTicket,
        round_shares: data.roundShares,
        escrow_instructions: data.escrowInstructions,
        tickets_open: data.ticketsOpen,
      },
      { onConflict: "project_code" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const staffTicketAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        ticketId: z.string().uuid(),
        action: z.enum(["issue_contract", "settle", "cancel"]),
        reason: z.string().max(500).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!(await isStaff(supabase, userId))) throw new Error("No autorizado");
    if (data.action === "issue_contract") {
      const { data: t } = await supabase
        .from("investment_tickets")
        .select("investor_user_id, status")
        .eq("id", data.ticketId)
        .single();
      const { data: p } = await supabase
        .from("investor_profiles")
        .select("review_status")
        .eq("user_id", t?.investor_user_id ?? "")
        .maybeSingle();
      if (p?.review_status !== "approved")
        throw new Error("El KYC del inversionista no está aprobado.");
      const { error } = await supabase
        .from("investment_tickets")
        .update({ status: "contract_pending" })
        .eq("id", data.ticketId);
      if (error) throw new Error(error.message);
    } else if (data.action === "settle") {
      const { error } = await supabase.rpc("ticket_settle", { _ticket_id: data.ticketId });
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase.rpc("ticket_cancel", {
        _ticket_id: data.ticketId,
        _reason: data.reason ?? undefined,
      });
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });
