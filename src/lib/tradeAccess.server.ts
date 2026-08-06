// Resolución server-only de tokens de participantes adicionales.
// Complementa a los tokens legados buyer/seller de `commodity_trades`.

import type { SupabaseClient } from "@supabase/supabase-js";

export type AccessLinkRole = "buyer" | "seller" | "broker" | "advisor" | "observer" | "geocapitals";

export type ResolvedAccessLink = {
  id: string;
  tradeId: string;
  role: AccessLinkRole;
  canUpload: boolean;
  canNegotiate: boolean;
};

/** Busca un token (por hash) en trade_access_links; registra el acceso. */
export async function resolveAccessLinkByHash(
  sb: SupabaseClient,
  hash: string,
): Promise<ResolvedAccessLink | null> {
  const { data } = await sb
    .from("trade_access_links")
    .select("id, trade_id, role, can_upload, can_negotiate, expires_at, revoked_at, access_count")
    .eq("token_hash", hash)
    .maybeSingle();
  if (!data) return null;
  const r = data as unknown as {
    id: string;
    trade_id: string;
    role: AccessLinkRole;
    can_upload: boolean;
    can_negotiate: boolean;
    expires_at: string | null;
    revoked_at: string | null;
    access_count: number | null;
  };
  if (r.revoked_at) return null;
  if (r.expires_at && new Date(r.expires_at) <= new Date()) return null;

  try {
    await sb
      .from("trade_access_links")
      .update({ last_access_at: new Date().toISOString(), access_count: (r.access_count ?? 0) + 1 })
      .eq("id", r.id);
  } catch {
    /* auxiliar */
  }

  return {
    id: r.id,
    tradeId: r.trade_id,
    role: r.role,
    canUpload: r.can_upload,
    canNegotiate: r.can_negotiate,
  };
}
