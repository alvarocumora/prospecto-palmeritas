import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { DOC_BY_KEY } from "@/lib/tradeDocuments";

// Trade Desk: server fns con RLS del usuario (cliente casteado sin tipar por ser
// tablas nuevas). Solo comprador/vendedor de un trade acceden a él y a sus docs.

const asSb = (c: unknown): SupabaseClient => c as SupabaseClient;

export type TradeRow = {
  id: string;
  reference: string | null;
  lot_id: string | null;
  inquiry_id: string | null;
  buyer_user_id: string;
  seller_user_id: string;
  commodity: string | null;
  form: string | null;
  quantity_t: number | null;
  incoterm: string | null;
  unit_price_usd: number | null;
  total_value_usd: number | null;
  currency: string;
  payment_instrument: string | null;
  stage: string;
  status: string;
  notes: string | null;
  created_at: string;
};

export type TradeDocRow = {
  id: string;
  trade_id: string;
  doc_type: string;
  phase: string | null;
  status: string;
  file_url: string | null;
  issuer: string | null;
  reference: string | null;
  signed_by: string | null;
  signed_at: string | null;
  notes: string | null;
  updated_at: string;
};

const TRADE_COLS =
  "id, reference, lot_id, inquiry_id, buyer_user_id, seller_user_id, commodity, form, quantity_t, incoterm, unit_price_usd, total_value_usd, currency, payment_instrument, stage, status, notes, created_at";
const DOC_COLS =
  "id, trade_id, doc_type, phase, status, file_url, issuer, reference, signed_by, signed_at, notes, updated_at";

/** Trades donde el usuario es comprador o vendedor. */
export const listMyTrades = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = asSb(context.supabase);
    const { data, error } = await sb
      .from("commodity_trades")
      .select(TRADE_COLS)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    const trades = (data ?? []) as TradeRow[];
    if (trades.length === 0) return [];
    const ids = trades.map((t) => t.id);
    const { data: docs } = await sb
      .from("trade_documents")
      .select("trade_id, doc_type, status")
      .in("trade_id", ids);
    const byTrade = new Map<string, Array<{ doc_type: string; status: string }>>();
    for (const d of (docs ?? []) as Array<{ trade_id: string; doc_type: string; status: string }>) {
      const arr = byTrade.get(d.trade_id) ?? [];
      arr.push({ doc_type: d.doc_type, status: d.status });
      byTrade.set(d.trade_id, arr);
    }
    return trades.map((t) => ({
      ...t,
      role: t.buyer_user_id === context.userId ? ("buyer" as const) : ("seller" as const),
      docs: byTrade.get(t.id) ?? [],
    }));
  });

/** Detalle de un trade + documentos. */
export const getTradeDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = asSb(context.supabase);
    const { data: trade, error } = await sb
      .from("commodity_trades")
      .select(TRADE_COLS)
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!trade) return null;
    const t = trade as TradeRow;
    const { data: docs } = await sb
      .from("trade_documents")
      .select(DOC_COLS)
      .eq("trade_id", data.id)
      .order("created_at", { ascending: true });
    return {
      trade: {
        ...t,
        role: t.buyer_user_id === context.userId ? ("buyer" as const) : ("seller" as const),
      },
      documents: (docs ?? []) as TradeDocRow[],
    };
  });

const CreateTrade = z.object({
  counterpartyUserId: z.string().uuid().optional(),
  counterpartyEmail: z.string().email().max(200).optional(),
  side: z.enum(["buy", "sell"]), // el creador compra o vende
  lotId: z.string().uuid().optional(),
  inquiryId: z.string().uuid().optional(),
  reference: z.string().trim().max(60).optional(),
  commodity: z.string().trim().max(40).optional(),
  form: z.string().trim().max(40).optional(),
  quantityT: z.number().min(0).max(1e12).optional(),
  incoterm: z.string().trim().max(20).optional(),
  unitPriceUsd: z.number().min(0).max(1e12).optional(),
  paymentInstrument: z.enum(["sblc_mt760", "dlc", "tt", "escrow"]).optional(),
});

/** Crea un trade; el creador es comprador o vendedor según `side`. */
export const createTrade = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CreateTrade.parse(d))
  .handler(async ({ data, context }) => {
    const sb = asSb(context.supabase);
    let counterparty = data.counterpartyUserId ?? null;
    if (!counterparty && data.counterpartyEmail) {
      const { data: prof } = await sb
        .from("profiles")
        .select("user_id")
        .eq("email", data.counterpartyEmail)
        .maybeSingle();
      counterparty = (prof as { user_id: string } | null)?.user_id ?? null;
    }
    if (!counterparty) throw new Error("No se encontró la contraparte (revisa el email).");
    if (counterparty === context.userId) throw new Error("La contraparte no puede ser tú mismo.");
    const buyer = data.side === "buy" ? context.userId : counterparty;
    const seller = data.side === "sell" ? context.userId : counterparty;
    const total =
      data.quantityT != null && data.unitPriceUsd != null
        ? data.quantityT * data.unitPriceUsd
        : null;
    const { data: row, error } = await sb
      .from("commodity_trades")
      .insert({
        reference: data.reference ?? null,
        lot_id: data.lotId ?? null,
        inquiry_id: data.inquiryId ?? null,
        buyer_user_id: buyer,
        seller_user_id: seller,
        commodity: data.commodity ?? null,
        form: data.form ?? null,
        quantity_t: data.quantityT ?? null,
        incoterm: data.incoterm ?? null,
        unit_price_usd: data.unitPriceUsd ?? null,
        total_value_usd: total,
        payment_instrument: data.paymentInstrument ?? null,
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: (row as { id: string }).id };
  });

export const setTradeStage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        stage: z.enum(["icpo", "fco", "spa", "payment", "shipping", "delivered", "closed"]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const sb = asSb(context.supabase);
    const patch: Record<string, unknown> = { stage: data.stage };
    if (data.stage === "closed") patch.status = "closed";
    const { error } = await sb.from("commodity_trades").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const UpsertDoc = z.object({
  tradeId: z.string().uuid(),
  docType: z.string().trim().min(1).max(60),
  status: z.enum(["pending", "uploaded", "signed", "verified", "rejected"]).optional(),
  fileUrl: z.string().url().max(2000).optional(),
  issuer: z.string().trim().max(120).optional(),
  reference: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(1000).optional(),
});

/** Crea o actualiza un documento del trade (por tipo). */
export const upsertTradeDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => UpsertDoc.parse(d))
  .handler(async ({ data, context }) => {
    const sb = asSb(context.supabase);
    const phase = DOC_BY_KEY[data.docType]?.phase ?? null;
    const { data: existing } = await sb
      .from("trade_documents")
      .select("id")
      .eq("trade_id", data.tradeId)
      .eq("doc_type", data.docType)
      .maybeSingle();

    const fields: Record<string, unknown> = {};
    if (data.status !== undefined) fields.status = data.status;
    if (data.fileUrl !== undefined) fields.file_url = data.fileUrl;
    if (data.issuer !== undefined) fields.issuer = data.issuer;
    if (data.reference !== undefined) fields.reference = data.reference;
    if (data.notes !== undefined) fields.notes = data.notes;

    if (existing) {
      const { error } = await sb
        .from("trade_documents")
        .update(fields)
        .eq("id", (existing as { id: string }).id);
      if (error) throw new Error(error.message);
      return { id: (existing as { id: string }).id };
    }
    const { data: row, error } = await sb
      .from("trade_documents")
      .insert({
        trade_id: data.tradeId,
        doc_type: data.docType,
        phase,
        status: data.status ?? (data.fileUrl ? "uploaded" : "pending"),
        file_url: data.fileUrl ?? null,
        issuer: data.issuer ?? null,
        reference: data.reference ?? null,
        notes: data.notes ?? null,
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: (row as { id: string }).id };
  });

/** Marca un documento como firmado por el usuario actual (atribución + fecha). */
export const signTradeDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ docId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = asSb(context.supabase);
    const { error } = await sb
      .from("trade_documents")
      .update({ status: "signed", signed_by: context.userId, signed_at: new Date().toISOString() })
      .eq("id", data.docId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
