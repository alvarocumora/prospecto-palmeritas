// Puerta de acceso de los paneles privados de operación (/operacion/$token).
// El token del enlace ya no basta: la contraparte debe validar su correo con un
// código de un solo uso. La sesión resultante vive 12 h y se guarda hasheada.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { sha256Hex } from "@/lib/documents/signing";

export const OPERACION_TOKEN_PREFIX = "gcops_";
const SESSION_TTL_HOURS = 12;
const OTP_TTL_MINUTES = 15;
const MAX_ATTEMPTS = 6;

export function isOpsTokenFormat(t: string): boolean {
  return new RegExp(`^${OPERACION_TOKEN_PREFIX}[0-9a-f]{64}$`).test(t);
}

export function serviceClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL ?? (import.meta.env.VITE_SUPABASE_URL as string);
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
  if (!url || !key) throw new Error("Missing Supabase server env vars");
  return createClient(url, key, { auth: { persistSession: false } });
}

function randomHex(bytes: number): string {
  const arr = new Uint8Array(bytes);
  globalThis.crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

function randomCode(): string {
  const arr = new Uint32Array(1);
  globalThis.crypto.getRandomValues(arr);
  return String(100000 + ((arr[0] ?? 0) % 900000));
}

export type ResolvedTrade = {
  sb: SupabaseClient;
  tokenHash: string;
  tradeId: string;
  role: "buyer" | "seller";
  reference: string | null;
  commodity: string | null;
  counterpartyEmail: string | null;
  counterpartyName: string | null;
};

const TRADE_SEL =
  "id, reference, commodity, counterparty_email, counterparty_name";

export async function resolveTradeByOpsToken(token: string): Promise<ResolvedTrade | null> {
  if (!isOpsTokenFormat(token)) return null;
  const sb = serviceClient();
  const tokenHash = await sha256Hex(token);

  for (const [col, role] of [
    ["counterparty_buyer_token_hash", "buyer"],
    ["counterparty_seller_token_hash", "seller"],
  ] as const) {
    const { data } = await sb
      .from("commodity_trades")
      .select(TRADE_SEL)
      .eq(col, tokenHash)
      .maybeSingle();
    if (data) {
      const t = data as Record<string, unknown>;
      return {
        sb,
        tokenHash,
        tradeId: t.id as string,
        role,
        reference: (t.reference as string) ?? null,
        commodity: (t.commodity as string) ?? null,
        counterpartyEmail: (t.counterparty_email as string) ?? null,
        counterpartyName: (t.counterparty_name as string) ?? null,
      };
    }
  }
  return null;
}

/** Correos habilitados para abrir este panel: contraparte del trade + participantes activos. */
export async function allowedEmailsFor(t: ResolvedTrade): Promise<string[]> {
  const out = new Set<string>();
  if (t.counterpartyEmail) out.add(t.counterpartyEmail.trim().toLowerCase());
  const { data } = await t.sb
    .from("trade_participants")
    .select("email, status")
    .eq("trade_id", t.tradeId);
  for (const r of (data ?? []) as Array<{ email: string; status: string }>) {
    if (r.status === "active" && r.email) out.add(r.email.trim().toLowerCase());
  }
  return [...out];
}

export function maskEmail(email: string): string {
  const [user = "", domain = ""] = email.split("@");
  const head = user.slice(0, 2);
  return `${head}${"•".repeat(Math.max(1, user.length - 2))}@${domain}`;
}

/** Crea un código de un solo uso. Devuelve null si el correo no está habilitado. */
export async function createOtpChallenge(
  t: ResolvedTrade,
  email: string,
): Promise<{ code: string } | null> {
  const normalized = email.trim().toLowerCase();
  const allowed = await allowedEmailsFor(t);
  if (!allowed.includes(normalized)) return null;

  const code = randomCode();
  await t.sb.from("portal_otp_challenges").insert({
    token_hash: t.tokenHash,
    email: normalized,
    code_hash: await sha256Hex(`${t.tokenHash}:${normalized}:${code}`),
    expires_at: new Date(Date.now() + OTP_TTL_MINUTES * 60_000).toISOString(),
  });
  return { code };
}

/** Valida el código y abre una sesión de panel. Devuelve la clave de sesión. */
export async function consumeOtpChallenge(
  t: ResolvedTrade,
  email: string,
  code: string,
): Promise<{ session: string; expiresAt: string } | null> {
  const normalized = email.trim().toLowerCase();
  const { data } = await t.sb
    .from("portal_otp_challenges")
    .select("id, code_hash, attempts, expires_at, consumed_at")
    .eq("token_hash", t.tokenHash)
    .eq("email", normalized)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const row = data as
    | { id: string; code_hash: string; attempts: number; expires_at: string; consumed_at: string | null }
    | null;
  if (!row) return null;
  if (row.consumed_at) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) return null;
  if (row.attempts >= MAX_ATTEMPTS) return null;

  const hash = await sha256Hex(`${t.tokenHash}:${normalized}:${code.trim()}`);
  if (hash !== row.code_hash) {
    await t.sb
      .from("portal_otp_challenges")
      .update({ attempts: row.attempts + 1 })
      .eq("id", row.id);
    return null;
  }

  await t.sb
    .from("portal_otp_challenges")
    .update({ consumed_at: new Date().toISOString() })
    .eq("id", row.id);

  const session = `gcses_${randomHex(32)}`;
  const expiresAt = new Date(Date.now() + SESSION_TTL_HOURS * 3600_000).toISOString();
  await t.sb.from("portal_sessions").insert({
    token_hash: t.tokenHash,
    session_hash: await sha256Hex(session),
    email: normalized,
    expires_at: expiresAt,
  });
  return { session, expiresAt };
}

export type PortalSession = ResolvedTrade & { email: string };

/** Valida token + sesión. Devuelve null si el acceso no está autorizado. */
export async function getPortalSession(
  token: string,
  session: string | null | undefined,
): Promise<PortalSession | null> {
  if (!session) return null;
  const t = await resolveTradeByOpsToken(token);
  if (!t) return null;
  const { data } = await t.sb
    .from("portal_sessions")
    .select("id, email, expires_at")
    .eq("session_hash", await sha256Hex(session))
    .eq("token_hash", t.tokenHash)
    .maybeSingle();
  const row = data as { id: string; email: string; expires_at: string } | null;
  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) return null;
  await t.sb
    .from("portal_sessions")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("id", row.id);
  return { ...t, email: row.email };
}

/** Igual que getPortalSession pero lanza cuando no hay acceso. */
export async function requirePortalSession(
  token: string,
  session: string | null | undefined,
): Promise<PortalSession> {
  const s = await getPortalSession(token, session);
  if (!s) throw new Error("Sesión del panel expirada. Vuelve a validar tu correo.");
  return s;
}
