// Tenencia · server function sobre el RPC tenencia_overlaps.
// Dado un polígono (GeoJSON WGS84 4326) devuelve las concesiones intersectadas
// con métricas de solape, un resumen y el semáforo de tenencia.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  mapOverlapRow,
  summarizeOverlaps,
  tenureSemaphore,
  type TenureOverlap,
  type OverlapSummary,
} from "./overlaps";

const asSb = (c: unknown): SupabaseClient => c as SupabaseClient;

const GeometrySchema = z
  .object({
    type: z.enum(["Polygon", "MultiPolygon"]),
    coordinates: z.array(z.any()),
  })
  .passthrough();

const Input = z.object({
  /** Geometría del AOI en GeoJSON WGS84 (4326). */
  geometry: GeometrySchema,
  /** Si se indica, se excluyen las concesiones de ese proyecto (solo terceros). */
  excludeProjectId: z.string().uuid().optional(),
});

export type TenureOverlapResult = {
  rows: TenureOverlap[];
  summary: OverlapSummary;
  semaphore: "rojo" | "amarillo" | "verde";
  generatedAt: string;
};

export const checkTenureOverlaps = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data, context }): Promise<TenureOverlapResult> => {
    const sb = asSb(context.supabase);
    const { data: rpcRows, error } = await sb.rpc("tenencia_overlaps", {
      p_geom: data.geometry,
      p_exclude_project: data.excludeProjectId ?? null,
    });
    if (error) throw new Error(error.message);
    const rows = ((rpcRows ?? []) as Array<Record<string, unknown>>).map(mapOverlapRow);
    const summary = summarizeOverlaps(rows);
    return {
      rows,
      summary,
      semaphore: tenureSemaphore(summary),
      generatedAt: new Date().toISOString(),
    };
  });
