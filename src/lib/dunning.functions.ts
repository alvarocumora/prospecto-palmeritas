import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireTradeRole } from "@/lib/access/roleMiddleware";
import { effectivePaymentStatus, isValidPaymentAmount, PAYMENT_KIND_LABELS } from "@/lib/payments";
import { daysOverdue } from "@/lib/receivables";
import { dunningStage, shouldRemind, dunningPriority, type DunningStage } from "@/lib/dunning";

// Cola de cobranza (dunning) y envío de recordatorios. Solo "por cobrar" (soy
// vendedor): recuerdo a mi contraparte los pagos próximos o vencidos, con
// cadencia. El email se encola (sendInternalEmail) y se registra en la
// trazabilidad del trade. Degrada elegante si trade_payments / columnas de
// recordatorio aún no están migradas.

const asSb = (c: unknown): SupabaseClient => c as SupabaseClient;
const isMissingTable = (msg: string) => /does not exist|relation|schema cache/i.test(msg);
const isMissingColumn = (msg: string) =>
  /column .* does not exist|last_reminder_at|reminder_count|schema cache/i.test(msg);

const usd0 = (n: number | null | undefined) =>
  n != null ? `US$ ${Math.round(n).toLocaleString("es-CL")}` : "—";
const fmtDate = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString("es-CL", { day: "numeric", month: "long", year: "numeric" })
    : "—";

type PaymentRow = {
  id: string;
  trade_id: string;
  kind: string;
  label: string | null;
  amount_usd: number | null;
  currency: string | null;
  due_date: string | null;
  status: string;
  paid_at: string | null;
  last_reminder_at: string | null;
  reminder_count: number | null;
};

type TradeRow = {
  id: string;
  reference: string | null;
  commodity: string | null;
  currency: string | null;
  buyer_user_id: string | null;
  seller_user_id: string | null;
  counterparty_role: string | null;
  counterparty_name: string | null;
  counterparty_company: string | null;
  counterparty_email: string | null;
};

export type DunningItem = {
  paymentId: string;
  tradeId: string;
  tradeLabel: string;
  commodity: string | null;
  counterpartyLabel: string;
  counterpartyEmail: string | null;
  kind: string;
  label: string | null;
  amountUsd: number;
  currency: string;
  dueDate: string | null;
  daysOverdue: number;
  stage: DunningStage;
  lastReminderAt: string | null;
  reminderCount: number;
  shouldRemind: boolean;
};

export type DunningQueue = {
  /** true si trade_payments aún no está migrada. */
  pending: boolean;
  items: DunningItem[];
  /** Cuántos deberían recordarse hoy (cadencia). */
  dueNow: number;
  /** Cuántos de la cola tienen email de contraparte para poder enviar. */
  contactable: number;
  overdueUsd: number;
};

/** Lee pagos incluyendo columnas de recordatorio; reintenta sin ellas si aún no existen. */
async function selectPayments(sb: SupabaseClient): Promise<PaymentRow[] | "missing_table"> {
  const withReminders =
    "id, trade_id, kind, label, amount_usd, currency, due_date, status, paid_at, last_reminder_at, reminder_count";
  const withoutReminders =
    "id, trade_id, kind, label, amount_usd, currency, due_date, status, paid_at";
  const first = await sb.from("trade_payments").select(withReminders).limit(2000);
  if (!first.error) return (first.data ?? []) as PaymentRow[];
  if (isMissingTable(first.error.message) && !isMissingColumn(first.error.message)) {
    // Puede ser tabla faltante o columna faltante (ambas matchean); intenta sin columnas.
  }
  const second = await sb.from("trade_payments").select(withoutReminders).limit(2000);
  if (second.error) {
    if (isMissingTable(second.error.message)) return "missing_table";
    throw new Error(second.error.message);
  }
  return (
    (second.data ?? []) as Array<Omit<PaymentRow, "last_reminder_at" | "reminder_count">>
  ).map((p) => ({ ...p, last_reminder_at: null, reminder_count: 0 }));
}

export const getDunningQueue = createServerFn({ method: "GET" })
  .middleware([requireTradeRole])
  .handler(async ({ context }): Promise<DunningQueue> => {
    const sb = asSb(context.supabase);
    const me = context.userId as string;
    const now = new Date();

    const paysResult = await selectPayments(sb);
    if (paysResult === "missing_table") {
      return { pending: true, items: [], dueNow: 0, contactable: 0, overdueUsd: 0 };
    }
    const outstanding = paysResult.filter((p) => {
      const st = effectivePaymentStatus(
        { status: p.status, amount_usd: p.amount_usd, due_date: p.due_date, paid_at: p.paid_at },
        now,
      );
      return st !== "pagado" && st !== "cancelado" && isValidPaymentAmount(p.amount_usd);
    });
    if (outstanding.length === 0) {
      return { pending: false, items: [], dueNow: 0, contactable: 0, overdueUsd: 0 };
    }

    const tradeIds = [...new Set(outstanding.map((p) => p.trade_id))];
    const { data: tradesData } = await sb
      .from("commodity_trades")
      .select(
        "id, reference, commodity, currency, buyer_user_id, seller_user_id, counterparty_role, counterparty_name, counterparty_company, counterparty_email",
      )
      .in("id", tradeIds);
    const trades = (tradesData ?? []) as TradeRow[];
    const tradeById = new Map(trades.map((t) => [t.id, t]));

    // Email/nombre de las contrapartes con cuenta (buyer). profiles va por admin.
    const buyerIds = [
      ...new Set(
        trades
          .filter((t) => t.seller_user_id === me && t.buyer_user_id && t.buyer_user_id !== me)
          .map((t) => t.buyer_user_id as string),
      ),
    ];
    let profById = new Map<string, { name: string | null; email: string | null }>();
    if (buyerIds.length > 0) {
      try {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: profs } = await supabaseAdmin
          .from("profiles")
          .select("user_id, display_name, email")
          .in("user_id", buyerIds);
        profById = new Map(
          (
            (profs ?? []) as Array<{
              user_id: string;
              display_name: string | null;
              email: string | null;
            }>
          ).map((p) => [p.user_id, { name: p.display_name, email: p.email }]),
        );
      } catch (e) {
        console.error("[dunning] profiles lookup failed", e);
      }
    }

    const items: DunningItem[] = [];
    for (const p of outstanding) {
      const t = tradeById.get(p.trade_id);
      if (!t) continue;
      // Solo cobranza: pagos donde soy el vendedor (me deben a mí).
      if (t.seller_user_id !== me) continue;
      const buyerProf = t.buyer_user_id ? profById.get(t.buyer_user_id) : undefined;
      const externalName =
        t.counterparty_name && t.counterparty_company
          ? `${t.counterparty_name} · ${t.counterparty_company}`
          : (t.counterparty_name ?? t.counterparty_company ?? null);
      const counterpartyLabel = buyerProf?.name || externalName || "Contraparte";
      const counterpartyEmail =
        buyerProf?.email ?? (t.counterparty_role === "buyer" ? t.counterparty_email : null) ?? null;
      const stage = dunningStage(p.due_date, now);
      if (stage === "scheduled") continue; // aún lejos: no entra a la cola

      items.push({
        paymentId: p.id,
        tradeId: p.trade_id,
        tradeLabel: t.reference ?? t.commodity ?? "Operación",
        commodity: t.commodity,
        counterpartyLabel,
        counterpartyEmail,
        kind: p.kind,
        label: p.label,
        amountUsd: p.amount_usd as number,
        currency: p.currency ?? t.currency ?? "USD",
        dueDate: p.due_date,
        daysOverdue: daysOverdue(p.due_date, now),
        stage,
        lastReminderAt: p.last_reminder_at,
        reminderCount: p.reminder_count ?? 0,
        shouldRemind: shouldRemind(
          { dueDate: p.due_date, lastReminderAt: p.last_reminder_at },
          now,
        ),
      });
    }

    items.sort((a, b) => dunningPriority(b.dueDate, now) - dunningPriority(a.dueDate, now));

    return {
      pending: false,
      items,
      dueNow: items.filter((i) => i.shouldRemind).length,
      contactable: items.filter((i) => i.counterpartyEmail).length,
      overdueUsd: items.filter((i) => i.daysOverdue > 0).reduce((a, i) => a + i.amountUsd, 0),
    };
  });

export const sendPaymentReminder = createServerFn({ method: "POST" })
  .middleware([requireTradeRole])
  .inputValidator((d: unknown) => z.object({ paymentId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true; email: string }> => {
    const sb = asSb(context.supabase);
    const me = context.userId as string;
    const now = new Date();

    const { data: payRow, error: payErr } = await sb
      .from("trade_payments")
      .select("id, trade_id, kind, label, amount_usd, currency, due_date, status, paid_at")
      .eq("id", data.paymentId)
      .maybeSingle();
    if (payErr) throw new Error(payErr.message);
    if (!payRow) throw new Error("Pago no encontrado.");
    const p = payRow as Omit<PaymentRow, "last_reminder_at" | "reminder_count">;

    const st = effectivePaymentStatus(
      { status: p.status, amount_usd: p.amount_usd, due_date: p.due_date, paid_at: p.paid_at },
      now,
    );
    if (st === "pagado" || st === "cancelado") {
      throw new Error("Este pago ya no está pendiente.");
    }

    const { data: tradeRow } = await sb
      .from("commodity_trades")
      .select(
        "id, reference, commodity, buyer_user_id, seller_user_id, counterparty_role, counterparty_name, counterparty_company, counterparty_email",
      )
      .eq("id", p.trade_id)
      .maybeSingle();
    const t = tradeRow as TradeRow | null;
    if (!t) throw new Error("Operación no encontrada.");
    if (t.seller_user_id !== me) {
      throw new Error("Solo puedes enviar recordatorios de cobros donde eres el vendedor.");
    }

    // Resolver email de la contraparte (comprador): cuenta o contacto externo.
    let counterpartyName: string | null =
      t.counterparty_name && t.counterparty_company
        ? `${t.counterparty_name} · ${t.counterparty_company}`
        : (t.counterparty_name ?? t.counterparty_company ?? null);
    let email: string | null = t.counterparty_role === "buyer" ? t.counterparty_email : null;
    if (t.buyer_user_id && t.buyer_user_id !== me) {
      try {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: prof } = await supabaseAdmin
          .from("profiles")
          .select("display_name, email")
          .eq("user_id", t.buyer_user_id)
          .maybeSingle();
        const pr = prof as { display_name: string | null; email: string | null } | null;
        if (pr?.email) email = pr.email;
        if (pr?.display_name) counterpartyName = pr.display_name;
      } catch (e) {
        console.error("[dunning] buyer profile lookup failed", e);
      }
    }
    if (!email) {
      throw new Error("La contraparte no tiene email registrado para enviarle el recordatorio.");
    }

    const stage = dunningStage(p.due_date, now);
    const od = daysOverdue(p.due_date, now);
    const amountLabel = usd0(p.amount_usd);

    // Encolar el email (idempotente por día: máximo un recordatorio diario por pago).
    const { sendInternalEmail } = await import("@/lib/email/send-internal.server");
    const dayKey = now.toISOString().slice(0, 10);
    const result = await sendInternalEmail({
      templateName: "payment-reminder",
      recipientEmail: email,
      idempotencyKey: `payment-reminder:${p.id}:${dayKey}`,
      templateData: {
        counterpartyName: counterpartyName ?? undefined,
        tradeRef: t.reference ?? undefined,
        commodity: t.commodity ?? undefined,
        amount: amountLabel,
        dueDate: fmtDate(p.due_date),
        stage,
        daysOverdue: od,
        fromName: "Geocapitals",
      },
    });
    if (!result.ok) throw new Error(result.error);

    // Marcar el recordatorio (degrada si las columnas aún no existen).
    try {
      const { data: cur } = await sb
        .from("trade_payments")
        .select("reminder_count")
        .eq("id", p.id)
        .maybeSingle();
      const prev = (cur as { reminder_count: number | null } | null)?.reminder_count ?? 0;
      await sb
        .from("trade_payments")
        .update({ last_reminder_at: now.toISOString(), reminder_count: prev + 1 })
        .eq("id", p.id);
    } catch (e) {
      console.error("[dunning] mark reminder failed (columns pending?)", e);
    }

    // Trazabilidad del trade.
    try {
      await sb.from("trade_events").insert({
        trade_id: p.trade_id,
        actor_user_id: me,
        kind: "payment_reminder",
        detail: `Recordatorio de cobro enviado · ${p.label ?? PAYMENT_KIND_LABELS[p.kind as keyof typeof PAYMENT_KIND_LABELS] ?? p.kind} · ${amountLabel}`,
      });
    } catch {
      /* feed auxiliar */
    }

    return { ok: true, email };
  });
