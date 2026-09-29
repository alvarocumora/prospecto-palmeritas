// Shared auth helpers for Edge Functions.
// - requireUser: verifies the caller's Supabase JWT from the Authorization header.
// - requireProjectMember: verifies the user belongs to the target project.
// Returns a Response on failure (caller should return it as-is), or the user id on success.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export async function requireUser(
  req: Request,
): Promise<{ userId: string; isServiceRole?: boolean } | { error: Response }> {
  const auth = req.headers.get("Authorization") ?? req.headers.get("authorization");
  if (!auth || !auth.toLowerCase().startsWith("bearer ")) {
    return { error: json(401, { error: "Unauthorized: missing bearer token" }) };
  }
  const token = auth.slice(7).trim();
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const ANON = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !ANON) {
    return { error: json(500, { error: "Server misconfigured" }) };
  }
  // Trusted internal callers (cron, sync-all-projects) use the service-role key.
  if (SERVICE && token === SERVICE) {
    return { userId: "service-role", isServiceRole: true };
  }
  const client = createClient(SUPABASE_URL, ANON, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.getUser();
  if (error || !data?.user?.id) {
    return { error: json(401, { error: "Unauthorized: invalid token" }) };
  }
  return { userId: data.user.id };
}

// Minimal structural type: any Supabase client with rpc() works, regardless of
// the Database generic the caller used (avoids protected-prop type clashes).
type RpcClient = {
  rpc: (
    fn: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message: string } | null }>;
};

export async function requireProjectMember(
  admin: RpcClient,
  userId: string,
  projectId: string,
  opts?: { isServiceRole?: boolean },
): Promise<{ ok: true } | { error: Response }> {
  if (!projectId) return { error: json(400, { error: "project_id required" }) };
  if (opts?.isServiceRole || userId === "service-role") return { ok: true };
  // Super admins bypass tenant checks.
  const { data: sa } = await admin.rpc("is_super_admin", { _user_id: userId });
  if (sa === true) return { ok: true };
  const { data, error } = await admin.rpc("is_project_member", {
    _user_id: userId,
    _project_id: projectId,
  });
  if (error) return { error: json(500, { error: `Membership check failed: ${error.message}` }) };
  if (data !== true) return { error: json(403, { error: "Forbidden: not a project member" }) };
  return { ok: true };
}
