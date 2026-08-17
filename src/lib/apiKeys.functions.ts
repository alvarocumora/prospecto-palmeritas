import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireAdminRole } from "@/lib/access/roleMiddleware";
import { generateApiKey, hashApiKey, keyPrefix } from "@/lib/apiKeys";

// Gestión de API keys del catastro unificado. La llave completa se devuelve
// UNA sola vez (al crear); después solo existe su hash en la base.

const asSb = (c: unknown): SupabaseClient => c as SupabaseClient;

export type ApiKeyRow = {
  id: string;
  name: string;
  key_prefix: string;
  plan: string;
  is_active: boolean;
  monthly_count: number;
  requests_total: number;
  last_used_at: string | null;
  created_at: string;
};

export const createApiKey = createServerFn({ method: "POST" })
  .middleware([requireAdminRole])
  .inputValidator((d: unknown) => z.object({ name: z.string().trim().min(1).max(60) }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = asSb(context.supabase);
    // Límite defensivo de llaves activas por usuario.
    const { count } = await sb
      .from("api_keys")
      .select("id", { count: "exact", head: true })
      .eq("user_id", context.userId as string)
      .eq("is_active", true);
    if ((count ?? 0) >= 5) throw new Error("Máximo 5 llaves activas. Revoca alguna primero.");

    const key = generateApiKey();
    const { error } = await sb.from("api_keys").insert({
      user_id: context.userId as string,
      name: data.name,
      key_prefix: keyPrefix(key),
      key_hash: await hashApiKey(key),
    });
    if (error) throw new Error(error.message);
    // Única vez que la llave viaja en claro.
    return { key };
  });

export const listMyApiKeys = createServerFn({ method: "GET" })
  .middleware([requireAdminRole])
  .handler(async ({ context }): Promise<ApiKeyRow[]> => {
    const { data } = await asSb(context.supabase)
      .from("api_keys")
      .select(
        "id, name, key_prefix, plan, is_active, monthly_count, requests_total, last_used_at, created_at",
      )
      .eq("user_id", context.userId as string)
      .order("created_at", { ascending: false });
    return (data ?? []) as ApiKeyRow[];
  });

export const revokeApiKey = createServerFn({ method: "POST" })
  .middleware([requireAdminRole])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await asSb(context.supabase)
      .from("api_keys")
      .update({ is_active: false })
      .eq("id", data.id)
      .eq("user_id", context.userId as string);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
