// Accesos multiparte de una operación (trade_access_links).
//
// El comprador y el vendedor originales viven en `commodity_trades`
// (counterparty_*_token_hash). Esta tabla permite sumar participantes
// adicionales a la MISMA operación: otro bróker, un asesor legal, un
// inspector u observador, cada uno con su enlace propio, caducidad y
// revocación. Solo se persiste el hash del token.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { sha256Hex } from "@/lib/documents/signing";
import { tokenPrefix } from "@/lib/sourcing";
import { publicUrl } from "@/lib/publicUrl";

export const TRADE_PARTICIPANT_ROLES = [
  "buyer",
  "seller",
  "broker",
  "advisor",
  "observer",
  "geocapitals",
] as const;
export type TradeParticipantRole = (typeof TRADE_PARTICIPANT_ROLES)[number];

export const PARTICIPANT_ROLE_LABEL: Record<TradeParticipantRole, string> = {
  buyer: "Comprador",
  seller: "Vendedor",
  broker: "Bróker",
  advisor: "Asesor",
  observer: "Observador",
  geocapitals: "GeoCapitals",
};

export type TradeAccessRow = {
  id: string;
  role: TradeParticipantRole;
  email: string;
  full_name: string | null;
  company: string | null;
  token_prefix: string;
  can_upload: boolean;
  can_negotiate: boolean;
  expires_at: string | null;
  revoked_at: string | null;
  last_access_at: string | null;
  access_count: number;
  created_at: string;
  active: boolean;
};

export type LegacyPartyRow = {
  party: "buyer" | "seller";
  email: string | null;
  token_prefix: string | null;
  active: boolean;
};

const TOKEN_PREFIX = "gcops_";

function newToken(): string {
  const arr = new Uint8Array(32);
  globalThis.crypto.getRandomValues(arr);
  const hex = Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${TOKEN_PREFIX}${hex}`;
}

const isActive = (r: { revoked_at: string | null; expires_at: string | null }) =>
  !r.revoked_at && (!r.expires_at || new Date(r.expires_at) > new Date());

/** Verifica que el usuario sea staff GC, dueño o parte del trade. */
async function assertTradeAuthority(
  supabase: {
    rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown }>;
    from: (t: string) => {
      select: (c: string) => {
        eq: (c: string, v: string) => { maybeSingle: () => Promise<{ data: unknown }> };
      };
    };
  },
  userId: string,
  tradeId: string,
) {
  const { data: staff } = await supabase.rpc("is_gc_staff", { _user_id: userId });
  if (staff === true) return;
  const { data: trade } = await supabase
    .from("commodity_trades")
    .select("id, created_by, buyer_user_id, seller_user_id")
    .eq("id", tradeId)
    .maybeSingle();
  const t = trade as {
    created_by?: string | null;
    buyer_user_id?: string | null;
    seller_user_id?: string | null;
  } | null;
  if (!t) throw new Error("Operación no encontrada o sin acceso.");
  if (t.created_by !== userId && t.buyer_user_id !== userId && t.seller_user_id !== userId) {
    throw new Error("No tienes permisos sobre esta operación.");
  }
}

/** Lista los accesos de la operación: partes originales + participantes extra. */
export const listTradeAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ tradeId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<{ legacy: LegacyPartyRow[]; participants: TradeAccessRow[] }> => {
    const sb = context.supabase as never as Parameters<typeof assertTradeAuthority>[0];
    await assertTradeAuthority(sb, context.userId as string, data.tradeId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as never as {
      from: (t: string) => {
        select: (c: string) => {
          eq: (c: string, v: string) => {
            order: (c: string, o: { ascending: boolean }) => Promise<{ data: unknown }>;
          };
        };
      };
    };

    const [{ data: trade }, { data: rows }] = await Promise.all([
      (context.supabase as never as {
        from: (t: string) => {
          select: (c: string) => {
            eq: (c: string, v: string) => { maybeSingle: () => Promise<{ data: unknown }> };
          };
        };
      })
        .from("commodity_trades")
        .select(
          "counterparty_buyer_email, counterparty_buyer_token_prefix, counterparty_buyer_token_hash, counterparty_seller_email, counterparty_seller_token_prefix, counterparty_seller_token_hash",
        )
        .eq("id", data.tradeId)
        .maybeSingle(),
      admin
        .from("trade_access_links")
        .select(
          "id, role, email, full_name, company, token_prefix, can_upload, can_negotiate, expires_at, revoked_at, last_access_at, access_count, created_at",
        )
        .eq("trade_id", data.tradeId)
        .order("created_at", { ascending: true }),
    ]);

    const t = (trade ?? {}) as Record<string, string | null>;
    const legacy: LegacyPartyRow[] = [
      {
        party: "buyer",
        email: t["counterparty_buyer_email"] ?? null,
        token_prefix: t["counterparty_buyer_token_prefix"] ?? null,
        active: !!t["counterparty_buyer_token_hash"],
      },
      {
        party: "seller",
        email: t["counterparty_seller_email"] ?? null,
        token_prefix: t["counterparty_seller_token_prefix"] ?? null,
        active: !!t["counterparty_seller_token_hash"],
      },
    ];

    const participants = ((rows ?? []) as Array<Omit<TradeAccessRow, "active">>).map((r) => ({
      ...r,
      active: isActive(r),
    }));

    return { legacy, participants };
  });

/** Emite un enlace privado nuevo para un participante adicional. */
export const issueTradeAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        tradeId: z.string().uuid(),
        role: z.enum(TRADE_PARTICIPANT_ROLES),
        email: z.string().trim().email().max(160),
        fullName: z.string().trim().max(160).optional(),
        company: z.string().trim().max(160).optional(),
        canUpload: z.boolean().optional(),
        canNegotiate: z.boolean().optional(),
        expiresInDays: z.number().int().min(1).max(365).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<{ url: string; prefix: string }> => {
    const sb = context.supabase as never as Parameters<typeof assertTradeAuthority>[0];
    await assertTradeAuthority(sb, context.userId as string, data.tradeId);

    const token = newToken();
    const prefix = tokenPrefix(token);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as never as {
      from: (t: string) => { insert: (v: Record<string, unknown>) => Promise<{ error: { message: string } | null }> };
    })
      .from("trade_access_links")
      .insert({
        trade_id: data.tradeId,
        role: data.role,
        email: data.email.toLowerCase(),
        full_name: data.fullName ?? null,
        company: data.company ?? null,
        token_hash: await sha256Hex(token),
        token_prefix: prefix,
        can_upload: data.canUpload ?? false,
        can_negotiate: data.canNegotiate ?? false,
        expires_at: data.expiresInDays
          ? new Date(Date.now() + data.expiresInDays * 86_400_000).toISOString()
          : null,
        created_by: context.userId as string,
      });
    if (error) throw new Error(error.message);

    return { url: publicUrl(`/operacion/${token}`), prefix };
  });

/** Revoca (desactiva) un acceso emitido. */
export const revokeTradeAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ tradeId: z.string().uuid(), accessId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const sb = context.supabase as never as Parameters<typeof assertTradeAuthority>[0];
    await assertTradeAuthority(sb, context.userId as string, data.tradeId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as never as {
      from: (t: string) => {
        update: (v: Record<string, unknown>) => {
          eq: (c: string, v: string) => { eq: (c: string, v: string) => Promise<{ error: { message: string } | null }> };
        };
      };
    })
      .from("trade_access_links")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", data.accessId)
      .eq("trade_id", data.tradeId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
