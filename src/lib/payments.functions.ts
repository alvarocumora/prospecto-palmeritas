import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { PAYMENT_KINDS, summarizePayments, type PaymentsSummary } from "@/lib/payments";

// Pagos de un trade (RLS party-of-trade). Cada mutación registra un evento en
// la trazabilidad del trade (trade_events → timeline unificado). Degrada
// elegante si la tabla aún no está migrada.

const asSb = (c: unknown): SupabaseClient => c as SupabaseClient;
const isMissingTable = (msg: string) => /does not exist|relation|schema cache/i.test(msg);

async function logEvent(
  sb: SupabaseClient,
  tradeId: string,
  actorId: string,
  kind: string,
  detail: string,
) {
  try {
    await sb
      .from("trade_events")
      .insert({ trade_id: tradeId, actor_user_id: actorId, kind, detail });
  } catch {
    /* el feed es auxiliar */
  }
}

const usd0 = (n: number | null | undefined) =>
  n != null ? `US$ ${Math.round(n).toLocaleString("es-CL")}` : "—";

export type PaymentRow = {
  id: string;
  trade_id: string;
  kind: string;
  label: string | null;
  amount_usd: number | null;
  currency: string;
  instrument: string | null;
  reference: string | null;
  due_date: string | null;
  status: string;
  paid_at: string | null;
  notes: string | null;
  created_at: string;
};

const EMPTY_SUMMARY: PaymentsSummary = {
  scheduledUsd: 0,
  paidUsd: 0,
  outstandingUsd: 0,
  overdueUsd: 0,
  nextDue: null,
  progressPct: 0,
};

export const listTradePayments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ tradeId: z.string().uuid() }).parse(d))
  .handler(
    async ({
      data,
      context,
    }): Promise<{ pending: boolean; payments: PaymentRow[]; summary: PaymentsSummary }> => {
      const { data: rows, error } = await asSb(context.supabase)
        .from("trade_payments")
        .select(
          "id, trade_id, kind, label, amount_usd, currency, instrument, reference, due_date, status, paid_at, notes, created_at",
        )
        .eq("trade_id", data.tradeId)
        .order("due_date", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: true });
      if (error) {
        if (isMissingTable(error.message))
          return { pending: true, payments: [], summary: EMPTY_SUMMARY };
        throw new Error(error.message);
      }
      const payments = (rows ?? []) as PaymentRow[];
      return { pending: false, payments, summary: summarizePayments(payments, new Date()) };
    },
  );

const CreateInput = z.object({
  tradeId: z.string().uuid(),
  kind: z.enum(PAYMENT_KINDS),
  label: z.string().trim().max(120).optional(),
  // Un pago debe tener monto positivo: sin monto el progreso queda inconsistente.
  amountUsd: z
    .number({ error: "El monto es obligatorio." })
    .positive("El monto debe ser mayor a 0.")
    .max(1e12),

  instrument: z.enum(["sblc_mt760", "dlc", "tt", "escrow", "otro"]).optional(),
  reference: z.string().trim().max(120).optional(),
  dueDate: z.string().trim().max(10).optional(),
  notes: z.string().trim().max(1000).optional(),
});


export const createTradePayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CreateInput.parse(d))
  .handler(async ({ data, context }) => {
    const sb = asSb(context.supabase);
    const { data: row, error } = await sb
      .from("trade_payments")
      .insert({
        trade_id: data.tradeId,
        created_by: context.userId as string,
        kind: data.kind,
        label: data.label ?? null,
        amount_usd: data.amountUsd,
        instrument: data.instrument ?? null,
        reference: data.reference ?? null,
        due_date: data.dueDate || null,
        notes: data.notes ?? null,
      })
      .select("id")
      .single();
    if (error) {
      if (isMissingTable(error.message))
        throw new Error("Los pagos estarán disponibles tras aplicar la última migración.");
      throw new Error(error.message);
    }
    await logEvent(
      sb,
      data.tradeId,
      context.userId as string,
      "payment_scheduled",
      `${data.label ?? data.kind} · ${usd0(data.amountUsd)}${data.dueDate ? ` · vence ${data.dueDate}` : ""}`,
    );
    return { id: (row as { id: string }).id };
  });

export const markTradePaymentPaid = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = asSb(context.supabase);
    // Carrera: solo pasa a pagado si estaba programado.
    const { data: updated, error } = await sb
      .from("trade_payments")
      .update({ status: "pagado", paid_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("status", "programado")
      .select("trade_id, label, kind, amount_usd")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!updated) throw new Error("El pago ya no está programado.");
    const u = updated as {
      trade_id: string;
      label: string | null;
      kind: string;
      amount_usd: number | null;
    };
    await logEvent(
      sb,
      u.trade_id,
      context.userId as string,
      "payment_paid",
      `${u.label ?? u.kind} · ${usd0(u.amount_usd)} recibido`,
    );
    return { ok: true };
  });

export const cancelTradePayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = asSb(context.supabase);
    // Se lee la fila antes de cancelar para poder describir el evento en el feed
    // del trade (trazabilidad) sin depender de la respuesta del update.
    const { data: before } = await sb
      .from("trade_payments")
      .select("trade_id, kind, label, amount_usd, status")
      .eq("id", data.id)
      .maybeSingle();
    const { error } = await sb
      .from("trade_payments")
      .update({ status: "cancelado" })
      .eq("id", data.id)
      .neq("status", "pagado");
    if (error) throw new Error(error.message);
    const b = before as
      | { trade_id: string; kind: string; label: string | null; amount_usd: number | null; status: string }
      | null;
    if (b && b.status !== "cancelado" && b.status !== "pagado") {
      await logEvent(
        sb,
        b.trade_id,
        context.userId as string,
        "payment_cancelled",
        `${b.label ?? b.kind} · ${usd0(b.amount_usd)} cancelado`,
      );
    }
    return { ok: true };
  });

