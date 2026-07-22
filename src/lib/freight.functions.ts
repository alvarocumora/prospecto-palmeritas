// Tarifas de flete marítimo por ruta. Lectura para cualquier autenticado;
// CRUD sólo super_admin (via RLS). El cálculo CIF = FOB + flete + seguro se
// hace en el cliente.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

const asSb = (c: unknown): SupabaseClient => c as SupabaseClient;

export type FreightRate = {
  id: string;
  port_origin: string;
  port_destination: string;
  container_type: "20ft" | "40ft" | "bulk_mt";
  usd_rate: number;
  transit_days: number | null;
  valid_from: string;
  source: string | null;
  notes: string | null;
  updated_at: string;
};

export const listFreightRates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<FreightRate[]> => {
    const sb = asSb(context.supabase);
    const { data, error } = await sb
      .from("freight_rates")
      .select(
        "id, port_origin, port_destination, container_type, usd_rate, transit_days, valid_from, source, notes, updated_at",
      )
      .order("port_origin", { ascending: true })
      .order("port_destination", { ascending: true })
      .order("valid_from", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as FreightRate[];
  });

const upsertSchema = z.object({
  id: z.string().uuid().optional(),
  port_origin: z.string().min(2),
  port_destination: z.string().min(2),
  container_type: z.enum(["20ft", "40ft", "bulk_mt"]),
  usd_rate: z.number().positive(),
  transit_days: z.number().int().positive().nullable().optional(),
  valid_from: z.string().optional(),
  source: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export const upsertFreightRate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => upsertSchema.parse(d))
  .handler(async ({ data, context }): Promise<{ id: string }> => {
    const sb = asSb(context.supabase);
    const payload = {
      port_origin: data.port_origin,
      port_destination: data.port_destination,
      container_type: data.container_type,
      usd_rate: data.usd_rate,
      transit_days: data.transit_days ?? null,
      valid_from: data.valid_from ?? new Date().toISOString().slice(0, 10),
      source: data.source ?? null,
      notes: data.notes ?? null,
      created_by: context.userId,
    };
    if (data.id) {
      const { error } = await sb.from("freight_rates").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: ins, error } = await sb
      .from("freight_rates")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: (ins as { id: string }).id };
  });

export const deleteFreightRate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const sb = asSb(context.supabase);
    const { error } = await sb.from("freight_rates").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
