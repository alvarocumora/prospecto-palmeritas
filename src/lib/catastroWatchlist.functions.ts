import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// ============================================================
// listMyWatchlist
// ============================================================
export const listMyWatchlist = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: items, error } = await supabase
      .from("catastro_watchlist")
      .select("id, concession_code, notify_email, notify_push, notes, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const codes = (items ?? []).map((i) => i.concession_code);
    let concessions: Record<
      string,
      {
        code: string;
        holder: string | null;
        name: string | null;
        region: string | null;
        commune: string | null;
        status: string | null;
        area_ha: number | null;
      }
    > = {};
    if (codes.length > 0) {
      const { data: rows } = await supabaseAdmin
        .from("public_concessions_cache")
        .select("code, holder, name, region, commune, status, area_ha")
        .in("code", codes);
      concessions = Object.fromEntries((rows ?? []).map((r) => [r.code, r]));
    }

    const { data: limits } = await supabaseAdmin.rpc("catastro_plan_limits", { _user_id: userId });
    const limit = limits?.[0] ?? { plan: "free", max_watches: 3 };

    return {
      items: items ?? [],
      concessions,
      plan: limit.plan as string,
      maxWatches: limit.max_watches as number,
      used: items?.length ?? 0,
    };
  });

// ============================================================
// addToWatchlist (con chequeo de límite por plan)
// ============================================================
export const addToWatchlist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        code: z.string().trim().min(1).max(60),
        notify_email: z.boolean().optional(),
        notify_push: z.boolean().optional(),
        notes: z.string().max(500).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { count } = await supabase
      .from("catastro_watchlist")
      .select("id", { count: "exact", head: true });

    const { data: limits } = await supabaseAdmin.rpc("catastro_plan_limits", { _user_id: userId });
    const max = limits?.[0]?.max_watches ?? 3;

    if ((count ?? 0) >= max) {
      throw new Error(
        `Alcanzaste el límite de ${max} concesiones en tu plan ${limits?.[0]?.plan ?? "free"}. Actualiza a Pro para monitorear más.`,
      );
    }

    const { data: inserted, error } = await supabase
      .from("catastro_watchlist")
      .insert({
        user_id: userId,
        concession_code: data.code,
        notify_email: data.notify_email ?? true,
        notify_push: data.notify_push ?? false,
        notes: data.notes ?? null,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { item: inserted };
  });

// ============================================================
// removeFromWatchlist
// ============================================================
export const removeFromWatchlist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("catastro_watchlist").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============================================================
// listMyAlerts
// ============================================================
export const listMyAlerts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("catastro_alerts")
      .select("id, concession_code, alert_type, severity, title, message, read_at, created_at")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return { alerts: data ?? [] };
  });

// ============================================================
// markAlertRead
// ============================================================
export const markAlertRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("catastro_alerts")
      .update({ read_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
