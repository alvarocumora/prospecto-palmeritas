// Preferencias del tablero por usuario: etapas ocultas, WIP y vista preferida.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

const asSb = (c: unknown): SupabaseClient => c as SupabaseClient;

export type BoardPrefs = {
  hidden_stages: string[];
  wip_limits: Record<string, number>;
  column_order: string[];
  preferred_view: "kanban" | "timeline";
};

const DEFAULT: BoardPrefs = {
  hidden_stages: [],
  wip_limits: {},
  column_order: [],
  preferred_view: "kanban",
};

export const getBoardPrefs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<BoardPrefs> => {
    const sb = asSb(context.supabase);
    const { data } = await sb
      .from("trade_board_prefs")
      .select("hidden_stages, wip_limits, column_order, preferred_view")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!data) return DEFAULT;
    const row = data as {
      hidden_stages: string[] | null;
      wip_limits: Record<string, number> | null;
      column_order: string[] | null;
      preferred_view: string | null;
    };
    return {
      hidden_stages: row.hidden_stages ?? [],
      wip_limits: row.wip_limits ?? {},
      column_order: row.column_order ?? [],
      preferred_view: (row.preferred_view === "timeline" ? "timeline" : "kanban") as
        "kanban" | "timeline",
    };
  });

export const saveBoardPrefs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        hidden_stages: z.array(z.string()).optional(),
        wip_limits: z.record(z.string(), z.number().int().min(0)).optional(),
        column_order: z.array(z.string()).optional(),
        preferred_view: z.enum(["kanban", "timeline"]).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const sb = asSb(context.supabase);
    const payload = {
      user_id: context.userId,
      hidden_stages: data.hidden_stages ?? [],
      wip_limits: data.wip_limits ?? {},
      column_order: data.column_order ?? [],
      preferred_view: data.preferred_view ?? "kanban",
    };
    const { error } = await sb.from("trade_board_prefs").upsert(payload, { onConflict: "user_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
