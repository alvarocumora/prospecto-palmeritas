// Panel espejo de contraparte (War Room público por token).
// El dueño autenticado del trade emite un link único para su contraparte
// (comprador o vendedor externo). El link permite ver estado, documentos,
// timeline y subir archivos sin cuenta. Solo se persiste el hash del token.

import { createServerFn } from "@tanstack/react-start";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { sha256Hex } from "@/lib/documents/signing";
import { tokenPrefix } from "@/lib/sourcing";
import { publicUrl } from "@/lib/publicUrl";

const asSb = (c: unknown): SupabaseClient => c as SupabaseClient;

export const OPERACION_TOKEN_PREFIX = "gcops_";

function newOpsToken(): string {
  const arr = new Uint8Array(32);
  globalThis.crypto.getRandomValues(arr);
  const hex = Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${OPERACION_TOKEN_PREFIX}${hex}`;
}

function isOpsTokenFormat(t: string): boolean {
  return new RegExp(`^${OPERACION_TOKEN_PREFIX}[0-9a-f]{64}$`).test(t);
}

export const operacionUrl = (token: string) => publicUrl(`/operacion/${token}`);

function serviceClient(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

// ---------- Autenticado: generar / regenerar link de contraparte ----------
export const ensureCounterpartyLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        tradeId: z.string().uuid(),
        party: z.enum(["buyer", "seller"]),
        email: z.string().trim().email().max(160).optional(),
        rotate: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<{ url: string; prefix: string }> => {
    const sb = asSb(context.supabase);
    const hashCol = data.party === "buyer" ? "counterparty_buyer_token_hash" : "counterparty_seller_token_hash";
    const prefCol = data.party === "buyer" ? "counterparty_buyer_token_prefix" : "counterparty_seller_token_prefix";
    const emailCol = data.party === "buyer" ? "counterparty_buyer_email" : "counterparty_seller_email";

    const { data: existing } = await sb
      .from("commodity_trades")
      .select(`id, ${hashCol}, ${prefCol}`)
      .eq("id", data.tradeId)
      .maybeSingle();
    if (!existing) throw new Error("Trade no encontrado o sin acceso.");
    const row = existing as Record<string, string | null>;

    const shouldRotate = data.rotate || !row[hashCol];
    let token: string | null = null;
    let prefix: string;

    if (shouldRotate) {
      token = newOpsToken();
      prefix = tokenPrefix(token);
      const upd: Record<string, string | null> = {
        [hashCol]: await sha256Hex(token),
        [prefCol]: prefix,
      };
      if (data.email) upd[emailCol] = data.email;
      const { error } = await sb.from("commodity_trades").update(upd).eq("id", data.tradeId);
      if (error) throw new Error(error.message);
    } else {
      prefix = row[prefCol] ?? "";
      if (data.email) {
        await sb.from("commodity_trades").update({ [emailCol]: data.email }).eq("id", data.tradeId);
      }
    }

    // Evento de auditoría (best-effort).
    try {
      await sb.from("trade_events").insert({
        trade_id: data.tradeId,
        actor_user_id: context.userId,
        kind: shouldRotate ? "counterparty_link_issued" : "counterparty_link_shared",
        detail: `Link de panel espejo (${data.party}) ${shouldRotate ? "emitido" : "reutilizado"}${data.email ? ` · ${data.email}` : ""}`,
      });
    } catch {
      /* noop */
    }

    // Al rotar retornamos URL con token; si no rotó, retornamos solo el prefix
    // (el token completo ya no existe en claro).
    return {
      url: token ? operacionUrl(token) : "",
      prefix,
    };
  });

// ---------- Público: contraparte accede al War Room con su token ----------
export type OperacionPayload = {
  role: "buyer" | "seller";
  trade: {
    reference: string | null;
    commodity: string | null;
    quantity_t: number | null;
    incoterm: string | null;
    unit_price_usd: number | null;
    total_value_usd: number | null;
    stage: string;
    status: string;
    created_at: string;
  };
  counterparty: { name: string | null; company: string | null };
  events: Array<{ kind: string; detail: string | null; created_at: string }>;
  shipments: Array<{
    reference: string | null;
    vessel_name: string | null;
    port_loading: string | null;
    port_discharge: string | null;
    eta: string | null;
    status: string;
  }>;
  docsCount: number;
};

export const getOperacionByToken = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: z.string().min(10).max(120) }).parse(d))
  .handler(async ({ data }): Promise<OperacionPayload | null> => {
    if (!isOpsTokenFormat(data.token)) return null;
    const sb = serviceClient();
    if (!sb) return null;

    const hash = await sha256Hex(data.token);
    const { data: byBuyer } = await sb
      .from("commodity_trades")
      .select(
        "id, reference, commodity, quantity_t, incoterm, unit_price_usd, total_value_usd, stage, status, created_at, counterparty_name, counterparty_company",
      )
      .eq("counterparty_buyer_token_hash", hash)
      .maybeSingle();
    let role: "buyer" | "seller" | null = byBuyer ? "buyer" : null;
    let trade = byBuyer as Record<string, unknown> | null;
    if (!trade) {
      const { data: bySeller } = await sb
        .from("commodity_trades")
        .select(
          "id, reference, commodity, quantity_t, incoterm, unit_price_usd, total_value_usd, stage, status, created_at, counterparty_name, counterparty_company",
        )
        .eq("counterparty_seller_token_hash", hash)
        .maybeSingle();
      trade = bySeller as Record<string, unknown> | null;
      role = bySeller ? "seller" : null;
    }
    if (!trade || !role) return null;
    const tradeId = trade.id as string;

    const [events, shipments, docs] = await Promise.all([
      sb
        .from("trade_events")
        .select("kind, detail, created_at")
        .eq("trade_id", tradeId)
        .order("created_at", { ascending: true })
        .limit(200),
      sb
        .from("trade_shipments")
        .select("reference, vessel_name, port_loading, port_discharge, eta, status")
        .eq("trade_id", tradeId)
        .order("created_at", { ascending: false }),
      sb.from("trade_documents").select("id", { count: "exact", head: true }).eq("trade_id", tradeId),
    ]);

    return {
      role,
      trade: {
        reference: (trade.reference as string) ?? null,
        commodity: (trade.commodity as string) ?? null,
        quantity_t: (trade.quantity_t as number) ?? null,
        incoterm: (trade.incoterm as string) ?? null,
        unit_price_usd: (trade.unit_price_usd as number) ?? null,
        total_value_usd: (trade.total_value_usd as number) ?? null,
        stage: String(trade.stage ?? ""),
        status: String(trade.status ?? ""),
        created_at: String(trade.created_at ?? ""),
      },
      counterparty: {
        name: (trade.counterparty_name as string) ?? null,
        company: (trade.counterparty_company as string) ?? null,
      },
      events: (events.data ?? []) as OperacionPayload["events"],
      shipments: (shipments.data ?? []) as OperacionPayload["shipments"],
      docsCount: docs.count ?? 0,
    };
  });
