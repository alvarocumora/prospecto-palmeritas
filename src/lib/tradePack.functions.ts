// Document Pack por trade: genera y despacha el set completo de documentos
// (Ficha Técnica, LOI, NCNDA, ICPO, SPA Draft) con los datos reales del trade.
//
// Cada PDF se sube a storage con URL firmada (60 días). El despacho por
// correo reutiliza el template genérico `trade-pack-dispatch`.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createHash } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { publicUrl } from "@/lib/publicUrl";

const asSb = (c: unknown): SupabaseClient => c as SupabaseClient;

const STORAGE_BUCKET = "email-attachments";

/** Canonicaliza un objeto y devuelve SHA-256 hex (12 chars) para huella de términos. */
function termsHashOf(obj: unknown): string {
  const canonical = JSON.stringify(obj, Object.keys(obj as object).sort());
  return createHash("sha256").update(canonical).digest("hex");
}

/** Campos del ctx que definen los "términos" para el hash por doc_type.
 *  Cambios en teléfono/email de la contraparte NO deben generar versión nueva. */
function termsFingerprintCtx(ctx: Awaited<ReturnType<typeof loadTradeCtx>>) {
  return {
    reference: ctx.reference,
    commodity: ctx.commodity,
    form: ctx.form,
    quantityMt: ctx.quantityMt,
    incoterm: ctx.incoterm,
    paymentInstrument: ctx.paymentInstrument,
    unitPriceUsd: ctx.unitPriceUsd,
    totalUsd: ctx.totalUsd,
    destination: ctx.destination,
    notes: ctx.notes,
    buyerName: ctx.buyer.name,
    buyerCompany: (ctx.buyer as { company?: string }).company ?? null,
    sellerName: ctx.seller.name,
    sellerCompany: (ctx.seller as { company?: string }).company ?? null,
  };
}


export const TRADE_PACK_DOCS = ["ficha", "loi", "ncnda", "icpo", "spa"] as const;
export type TradePackDoc = (typeof TRADE_PACK_DOCS)[number];

export const TRADE_PACK_LABELS: Record<TradePackDoc, string> = {
  ficha: "Ficha Técnica · Purchase Terms",
  loi: "LOI · Carta de Intención",
  ncnda: "NCNDA · Confidencialidad + No-Circumvention",
  icpo: "ICPO · Orden de Compra Irrevocable",
  spa: "SPA (Draft) · Sale & Purchase Agreement",
};

type PackDoc = {
  type: TradePackDoc;
  label: string;
  filename: string;
  url: string;
};

const TRADE_COLS = `
  id, reference, commodity, form, quantity_t, incoterm, payment_instrument,
  unit_price_usd, total_value_usd, notes,
  buyer_user_id, seller_user_id, counterparty_role,
  counterparty_name, counterparty_company, counterparty_email, counterparty_phone,
  counterparty_country
`;

async function loadTradeCtx(sb: SupabaseClient, tradeId: string) {
  const { data: t, error } = await sb
    .from("commodity_trades")
    .select(TRADE_COLS)
    .eq("id", tradeId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!t) throw new Error("Trade no encontrado");
  const trade = t as {
    id: string;
    reference: string | null;
    commodity: string | null;
    form: string | null;
    quantity_t: number | null;
    incoterm: string | null;
    payment_instrument: string | null;
    unit_price_usd: number | null;
    total_value_usd: number | null;
    notes: string | null;
    buyer_user_id: string | null;
    seller_user_id: string | null;
    counterparty_role: string | null;
    counterparty_name: string | null;
    counterparty_company: string | null;
    counterparty_email: string | null;
    counterparty_phone: string | null;
    counterparty_country: string | null;
  };

  // Resolver nombres de partes internas via admin (RLS ya verificó al caller)
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const ids = [trade.buyer_user_id, trade.seller_user_id].filter(
    (x): x is string => typeof x === "string",
  );
  const { data: profs } = await supabaseAdmin
    .from("profiles")
    .select("user_id, display_name, email")
    .in("user_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
  const profOf = (uid: string | null) =>
    uid ? ((profs ?? []) as Array<{ user_id: string; display_name: string | null; email: string | null }>).find((p) => p.user_id === uid) : undefined;

  const buyerInternal = profOf(trade.buyer_user_id);
  const sellerInternal = profOf(trade.seller_user_id);
  const cp = {
    name: trade.counterparty_name ?? "",
    company: trade.counterparty_company ?? undefined,
    email: trade.counterparty_email ?? undefined,
    phone: trade.counterparty_phone ?? undefined,
  };

  const buyer = buyerInternal
    ? { role: "Buyer", name: buyerInternal.display_name ?? buyerInternal.email ?? "Buyer", email: buyerInternal.email ?? undefined }
    : trade.counterparty_role === "buyer"
      ? { role: "Buyer", name: cp.name || "Buyer externo", company: cp.company, email: cp.email }
      : { role: "Buyer", name: "Buyer (por confirmar)" };

  const seller = sellerInternal
    ? { role: "Seller", name: sellerInternal.display_name ?? sellerInternal.email ?? "Seller", email: sellerInternal.email ?? undefined }
    : trade.counterparty_role === "seller"
      ? { role: "Seller", name: cp.name || "Seller externo", company: cp.company, email: cp.email }
      : { role: "Seller", name: "Seller (por confirmar)" };

  return {
    reference: trade.reference ?? trade.id.slice(0, 8).toUpperCase(),
    commodity: trade.commodity ?? "Commodity",
    form: trade.form,
    quantityMt: trade.quantity_t,
    incoterm: trade.incoterm,
    paymentInstrument: trade.payment_instrument,
    unitPriceUsd: trade.unit_price_usd,
    totalUsd: trade.total_value_usd,
    destination: trade.counterparty_country,
    notes: trade.notes,
    buyer,
    seller,
    counterpartyPhone: cp.phone,
    counterpartyEmail: cp.email,
    counterpartyName: cp.name,
    counterpartyCompany: cp.company,
  };
}

export const generateTradePack = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        tradeId: z.string().uuid(),
        include: z.array(z.enum(TRADE_PACK_DOCS)).min(1).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const sb = asSb(context.supabase);
    const ctx = await loadTradeCtx(sb, data.tradeId);
    const which = data.include ?? [...TRADE_PACK_DOCS];

    const {
      buildTradeFichaPdf,
      buildTradeLoiPdf,
      buildTradeNcndaPdf,
      buildTradeIcpoPdf,
      buildTradeSpaDraftPdf,
      uploadPdfSigned,
    } = await import("@/lib/documents/officialPdfs.server");

    const builders: Record<TradePackDoc, () => Promise<Uint8Array>> = {
      ficha: () => buildTradeFichaPdf(ctx),
      loi: () => buildTradeLoiPdf(ctx),
      ncnda: () => buildTradeNcndaPdf(ctx),
      icpo: () => buildTradeIcpoPdf(ctx),
      spa: () => buildTradeSpaDraftPdf(ctx),
    };

    const docs: PackDoc[] = [];
    const errors: Array<{ type: TradePackDoc; error: string }> = [];

    for (const type of which) {
      try {
        const bytes = await builders[type]();
        const filename = `${type.toUpperCase()}-${ctx.reference}.pdf`;
        const url = await uploadPdfSigned({
          bytes,
          path: `trade-pack/${data.tradeId}/${type}-${Date.now()}.pdf`,
          ttlDays: 60,
        });
        docs.push({ type, label: TRADE_PACK_LABELS[type], filename, url });
      } catch (e) {
        errors.push({ type, error: e instanceof Error ? e.message : String(e) });
      }
    }

    // Registrar evento en el timeline del trade
    try {
      await sb.from("trade_events").insert({
        trade_id: data.tradeId,
        actor_user_id: context.userId,
        kind: "pack_generated",
        detail: JSON.stringify({ docs: docs.map((d) => d.type), errors }),
      });
    } catch {
      /* no bloquea */
    }

    return {
      reference: ctx.reference,
      operationUrl: publicUrl(`/operacion/${data.tradeId}`),
      counterpartyEmail: ctx.counterpartyEmail ?? null,
      counterpartyPhone: ctx.counterpartyPhone ?? null,
      counterpartyName: ctx.counterpartyName ?? null,
      buyerEmail: ctx.buyer.email ?? null,
      sellerEmail: ctx.seller.email ?? null,
      docs,
      errors,
    };
  });

export const dispatchTradePack = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        tradeId: z.string().uuid(),
        recipients: z.array(z.string().email()).min(1),
        subject: z.string().trim().max(200).optional(),
        message: z.string().trim().max(4000).optional(),
        include: z.array(z.enum(TRADE_PACK_DOCS)).min(1).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const sb = asSb(context.supabase);
    const ctx = await loadTradeCtx(sb, data.tradeId);
    const which = data.include ?? [...TRADE_PACK_DOCS];

    const {
      buildTradeFichaPdf,
      buildTradeLoiPdf,
      buildTradeNcndaPdf,
      buildTradeIcpoPdf,
      buildTradeSpaDraftPdf,
      uploadPdfSigned,
    } = await import("@/lib/documents/officialPdfs.server");

    const builders: Record<TradePackDoc, () => Promise<Uint8Array>> = {
      ficha: () => buildTradeFichaPdf(ctx),
      loi: () => buildTradeLoiPdf(ctx),
      ncnda: () => buildTradeNcndaPdf(ctx),
      icpo: () => buildTradeIcpoPdf(ctx),
      spa: () => buildTradeSpaDraftPdf(ctx),
    };

    const docs: PackDoc[] = [];
    for (const type of which) {
      try {
        const bytes = await builders[type]();
        const url = await uploadPdfSigned({
          bytes,
          path: `trade-pack/${data.tradeId}/${type}-${Date.now()}.pdf`,
          ttlDays: 60,
        });
        docs.push({
          type,
          label: TRADE_PACK_LABELS[type],
          filename: `${type.toUpperCase()}-${ctx.reference}.pdf`,
          url,
        });
      } catch (e) {
        console.error("[trade-pack] build failed", type, e);
      }
    }

    const operationUrl = publicUrl(`/operacion/${data.tradeId}`);
    const { sendInternalEmail } = await import("@/lib/email/send-internal.server");
    const results: Array<{ to: string; ok: boolean; reason?: string }> = [];

    for (const to of data.recipients) {
      try {
        const res = await sendInternalEmail({
          templateName: "trade-pack-dispatch",
          recipientEmail: to,
          idempotencyKey: `trade-pack:${data.tradeId}:${to}:${Date.now()}`,
          templateData: {
            recipientEmail: to,
            tradeReference: ctx.reference,
            commodity: ctx.commodity,
            quantityMt: ctx.quantityMt ?? null,
            incoterm: ctx.incoterm ?? null,
            paymentInstrument: ctx.paymentInstrument ?? null,
            customSubject: data.subject ?? null,
            customMessage: data.message ?? null,
            operationUrl,
            docs: docs.map((d) => ({ label: d.label, url: d.url, filename: d.filename })),
          },
        });
        results.push({
          to,
          ok: res.ok,
          reason:
            res.ok && "queued" in res && res.queued
              ? "queued"
              : "reason" in res
                ? res.reason
                : "error" in res
                  ? res.error
                  : undefined,
        });
      } catch (e) {
        results.push({ to, ok: false, reason: e instanceof Error ? e.message : String(e) });
      }
    }

    try {
      await sb.from("trade_events").insert({
        trade_id: data.tradeId,
        actor_user_id: context.userId,
        kind: "pack_dispatched",
        detail: JSON.stringify({ recipients: data.recipients, docs: docs.map((d) => d.type), results }),
      });
    } catch {
      /* no bloquea */
    }

    return { reference: ctx.reference, operationUrl, docs, results };
  });
