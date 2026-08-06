// Ficha pública de la operación (precio de VENTA, sin margen ni reparto).
//
// Único punto de entrada de datos públicos de un trade: valida el token de
// contraparte (hash) y llama a `get_trade_public_ficha`. Jamás consulta
// trade_pricing / trade_commission_splits (esas traen base y reparto interno).

import { createServerFn } from "@tanstack/react-start";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { sha256Hex } from "@/lib/documents/signing";
import { publicUrl } from "@/lib/publicUrl";
import { sendInternalEmail } from "@/lib/email/send-internal.server";

const TOKEN_PREFIX = "gcops_";
const TOKEN_RE = new RegExp(`^${TOKEN_PREFIX}[0-9a-f]{64}$`);

export type FichaPricing = {
  unit: string | null;
  sale_price: number | null;
  currency: string | null;
  iva_pct: number | null;
  qty_per_order: number | null;
  order_frequency: string | null;
  contract_months: number | null;
} | null;

export type FichaProduct = {
  product_name: string | null;
  presentation: string | null;
  hs_code: string | null;
  purity: string | null;
  grade_value: number | null;
  grade_unit: string | null;
  tonnage_total_t: number | null;
  tonnage_monthly_t: number | null;
  packaging: string | null;
  origin_country: string | null;
  origin_region: string | null;
  incoterm: string | null;
};

export type PublicFicha = {
  trade_id: string;
  commodity: string | null;
  reference: string | null;
  pricing: FichaPricing;
  products: FichaProduct[];
  role: string;
  roleLabel: string;
  permissions: { documents: boolean; negotiate: boolean; upload: boolean };
  operacionUrl: string;
  fichaUrl: string;
};

function serviceClient(): SupabaseClient | null {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

export type ResolvedFichaAccess = {
  sb: SupabaseClient;
  tradeId: string;
  role: string;
  participantId?: string;
  permissions: { documents: boolean; negotiate: boolean; upload: boolean };
};

const FULL_PERMS = { documents: true, negotiate: true, upload: true };

const ROLE_LABELS: Record<string, string> = {
  buyer: "Comprador",
  seller: "Vendedor",
  broker: "Bróker / intermediario",
  advisor: "Asesor",
  observer: "Observador",
};

async function resolveTrade(token: string): Promise<ResolvedFichaAccess | null> {
  if (!TOKEN_RE.test(token)) return null;
  const sb = serviceClient();
  if (!sb) return null;
  const hash = await sha256Hex(token);
  const { data: b } = await sb
    .from("commodity_trades")
    .select("id")
    .eq("counterparty_buyer_token_hash", hash)
    .maybeSingle();
  if (b) return { sb, tradeId: (b as { id: string }).id, role: "buyer", permissions: FULL_PERMS };
  const { data: s } = await sb
    .from("commodity_trades")
    .select("id")
    .eq("counterparty_seller_token_hash", hash)
    .maybeSingle();
  if (s) return { sb, tradeId: (s as { id: string }).id, role: "seller", permissions: FULL_PERMS };

  // Participante invitado (bróker, asesor, observador o contraparte adicional).
  const { data: part } = await sb
    .from("trade_participants")
    .select("id, trade_id, role, can_view_documents, can_negotiate, can_upload, status")
    .eq("token_hash", hash)
    .eq("status", "active")
    .maybeSingle();
  if (part) {
    const pr = part as {
      id: string;
      trade_id: string;
      role: string;
      can_view_documents: boolean;
      can_negotiate: boolean;
      can_upload: boolean;
    };
    void sb
      .from("trade_participants")
      .update({ last_access_at: new Date().toISOString() })
      .eq("id", pr.id);
    return {
      sb,
      tradeId: pr.trade_id,
      role: pr.role,
      participantId: pr.id,
      permissions: {
        documents: pr.can_view_documents,
        negotiate: pr.can_negotiate,
        upload: pr.can_upload,
      },
    };
  }
  return null;
}

const tokenInput = (d: unknown) => z.object({ token: z.string().min(10).max(120) }).parse(d);

/** Ficha pública segura por token. Solo commodity, specs y precio de venta. */
export const getPublicFicha = createServerFn({ method: "POST" })
  .inputValidator(tokenInput)
  .handler(async ({ data }): Promise<PublicFicha | null> => {
    const resolved = await resolveTrade(data.token);
    if (!resolved) return null;
    const { sb, tradeId, role, permissions } = resolved;
    const { data: ficha, error } = await sb.rpc("get_trade_public_ficha" as never, {
      p_trade_id: tradeId,
    } as never);
    if (error || !ficha) return null;
    const f = ficha as unknown as {
      trade_id: string;
      commodity: string | null;
      reference: string | null;
      pricing: FichaPricing;
      products: FichaProduct[] | null;
    };
    return {
      trade_id: f.trade_id,
      commodity: f.commodity ?? null,
      reference: f.reference ?? null,
      pricing: f.pricing ?? null,
      products: f.products ?? [],
      role,
      roleLabel: ROLE_LABELS[role] ?? role,
      permissions,
      operacionUrl: publicUrl(`/operacion/${data.token}`),
      fichaUrl: publicUrl(`/ficha/${data.token}`),
    };
  });

function money(n: number | null | undefined, currency: string | null | undefined, unit?: string | null) {
  if (n == null) return "—";
  const cur = currency === "USD" ? "US$" : "$";
  return `${cur} ${Math.round(n).toLocaleString("es-CL")}${unit ? ` / ${unit}` : ""}`;
}

/** Envía la ficha (sin margen) a info@geocapitals.com con el link de la operación. */
export const emailFichaToGeocapitals = createServerFn({ method: "POST" })
  .inputValidator(tokenInput)
  .handler(async ({ data }): Promise<{ ok: boolean; error?: string }> => {
    const resolved = await resolveTrade(data.token);
    if (!resolved) return { ok: false, error: "Enlace no válido" };
    const { sb, tradeId } = resolved;
    const { data: ficha } = await sb.rpc("get_trade_public_ficha" as never, {
      p_trade_id: tradeId,
    } as never);
    if (!ficha) return { ok: false, error: "Ficha no disponible" };
    const f = ficha as unknown as {
      commodity: string | null;
      reference: string | null;
      pricing: FichaPricing;
      products: FichaProduct[] | null;
    };
    const p0 = (f.products ?? [])[0];
    const res = await sendInternalEmail({
      templateName: "trade-ficha-internal",
      recipientEmail: "info@geocapitals.com",
      idempotencyKey: `trade-ficha-${tradeId}-${new Date().toISOString().slice(0, 10)}`,
      templateData: {
        commodity: f.commodity ?? "Commodity",
        reference: f.reference ?? "",
        productName: p0?.product_name ?? "",
        presentation: p0?.presentation ?? "",
        purity: p0?.purity ?? "",
        packaging: p0?.packaging ?? "",
        origin: [p0?.origin_region, p0?.origin_country].filter(Boolean).join(", "),
        incoterm: p0?.incoterm ?? "",
        quantity:
          f.pricing?.qty_per_order != null
            ? `${Number(f.pricing.qty_per_order).toLocaleString("es-CL")} ${f.pricing.unit ?? ""}`
            : p0?.tonnage_total_t != null
              ? `${Number(p0.tonnage_total_t).toLocaleString("es-CL")} t`
              : "",
        frequency: f.pricing?.order_frequency ?? "",
        contractMonths: f.pricing?.contract_months ?? "",
        price: money(f.pricing?.sale_price ?? null, f.pricing?.currency ?? null, f.pricing?.unit ?? null),
        operacionUrl: publicUrl(`/operacion/${data.token}`),
        fichaUrl: publicUrl(`/ficha/${data.token}`),
      },
    });
    if (!res.ok) return { ok: false, error: res.error };
    return { ok: true };
  });
