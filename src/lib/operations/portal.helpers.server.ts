// Server-only helpers for portal token flows.
// Extracts the authenticated user directly from the incoming request
// so we can support "claim invitation" flows that don't run through
// requireSupabaseAuth middleware (portal endpoints are token-based first,
// then optionally attach a signed-in user to bind the invitation).
import { getRequest } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";

export async function requireSupabaseAuthDirect(): Promise<{ userId: string; email: string | null }> {
  const req = getRequest();
  const auth = req.headers.get("authorization") ?? req.headers.get("Authorization");
  if (!auth || !auth.toLowerCase().startsWith("bearer ")) {
    throw new Error("Debes iniciar sesión para vincular tu acceso");
  }
  const token = auth.slice(7).trim();
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
  const client = createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.getUser();
  if (error || !data?.user?.id) throw new Error("Sesión inválida");
  return { userId: data.user.id, email: data.user.email ?? null };
}
