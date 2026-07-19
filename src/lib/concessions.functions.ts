import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  CONCESSION_TYPES,
  CONCESSION_STATUSES,
  normalizeConcessionType,
  normalizeConcessionStatus,
  type ConcessionType,
  type ConcessionStatus,
} from "@/lib/concessions";

// Catastro/concesiones de un proyecto (mining_concessions). Lectura por
// miembros; guardado (bulk replace) por owner/admin. Degrada si la tabla o la
// columna parcel_ids aún no están migradas.

const asSb = (c: unknown): SupabaseClient => c as SupabaseClient;
const isMissingTable = (msg: string) => /does not exist|relation|schema cache/i.test(msg);
const isMissingColumn = (msg: string) => /column|schema cache|parcel_ids/i.test(msg);
const EDIT_ROLES = new Set(["owner", "admin"]);

async function myRole(sb: SupabaseClient, projectId: string, me: string): Promise<string | null> {
  const { data } = await sb
    .from("project_members")
    .select("role")
    .eq("project_id", projectId)
    .eq("user_id", me)
    .maybeSingle();
  return (data as { role: string } | null)?.role ?? null;
}

/** Geometría GeoJSON serializable (Polygon | MultiPolygon). */
export type GeoJsonValue = { type: string; coordinates: number[][][] | number[][][][] };

export type Concession = {
  id: string;
  code: string;
  name: string;
  type: ConcessionType;
  status: ConcessionStatus;
  holder: string | null;
  areaHa: number | null;
  region: string | null;
  commune: string | null;
  grantedAt: string | null;
  expiresAt: string | null;
  parcelIds: string | null;
  notes: string | null;
  geometry: GeoJsonValue | null;
};

export type ConcessionsView = {
  canEdit: boolean;
  pending: boolean;
  concessions: Concession[];
};

const COLS =
  "id, code, name, concession_type, status, holder, area_ha, region, commune, granted_at, expires_at, parcel_ids, notes, geometry_geojson";
const COLS_NO_PARCEL =
  "id, code, name, concession_type, status, holder, area_ha, region, commune, granted_at, expires_at, notes, geometry_geojson";

function rowToConcession(r: Record<string, unknown>): Concession {
  return {
    id: String(r.id),
    code: String(r.code ?? ""),
    name: String(r.name ?? ""),
    type: normalizeConcessionType(r.concession_type as string | null),
    status: normalizeConcessionStatus(r.status as string | null),
    holder: (r.holder as string | null) ?? null,
    areaHa: r.area_ha != null ? Number(r.area_ha) : null,
    region: (r.region as string | null) ?? null,
    commune: (r.commune as string | null) ?? null,
    grantedAt: (r.granted_at as string | null) ?? null,
    expiresAt: (r.expires_at as string | null) ?? null,
    parcelIds: (r.parcel_ids as string | null) ?? null,
    notes: (r.notes as string | null) ?? null,
    geometry: (r.geometry_geojson as GeoJsonValue | null) ?? null,
  };
}

/** Lee concesiones con parcel_ids; reintenta sin esa columna si aún no existe. */
async function selectConcessions(
  sb: SupabaseClient,
  projectId: string,
): Promise<Array<Record<string, unknown>> | "missing_table"> {
  const first = await sb
    .from("mining_concessions")
    .select(COLS)
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });
  if (!first.error) return (first.data ?? []) as Array<Record<string, unknown>>;
  if (isMissingTable(first.error.message) && !isMissingColumn(first.error.message)) {
    return "missing_table";
  }
  const second = await sb
    .from("mining_concessions")
    .select(COLS_NO_PARCEL)
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });
  if (second.error) {
    if (isMissingTable(second.error.message)) return "missing_table";
    throw new Error(second.error.message);
  }
  return (second.data ?? []) as Array<Record<string, unknown>>;
}

export const getProjectConcessions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ projectId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<ConcessionsView> => {
    const sb = asSb(context.supabase);
    const me = context.userId as string;
    const role = await myRole(sb, data.projectId, me);
    const canEdit = role != null && EDIT_ROLES.has(role);

    const rows = await selectConcessions(sb, data.projectId);
    if (rows === "missing_table") return { canEdit, pending: true, concessions: [] };
    return { canEdit, pending: false, concessions: rows.map(rowToConcession) };
  });

const ConcessionInput = z.object({
  code: z.string().trim().min(1).max(80),
  name: z.string().trim().min(1).max(160),
  type: z.enum(CONCESSION_TYPES),
  status: z.enum(CONCESSION_STATUSES),
  holder: z.string().trim().max(200).nullable().optional(),
  areaHa: z.number().min(0).max(1e9).nullable().optional(),
  region: z.string().trim().max(120).nullable().optional(),
  commune: z.string().trim().max(120).nullable().optional(),
  grantedAt: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  expiresAt: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  parcelIds: z.string().trim().max(200).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  geometry: z.any().nullable().optional(),
});

const SaveInput = z.object({
  projectId: z.string().uuid(),
  concessions: z.array(ConcessionInput).max(100),
});

export const saveProjectConcessions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SaveInput.parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true; count: number }> => {
    const sb = asSb(context.supabase);
    const me = context.userId as string;
    const role = await myRole(sb, data.projectId, me);
    if (!role || !EDIT_ROLES.has(role)) {
      throw new Error("Solo el owner o admin del proyecto puede editar el catastro.");
    }

    const del = await sb.from("mining_concessions").delete().eq("project_id", data.projectId);
    if (del.error) {
      if (isMissingTable(del.error.message)) {
        throw new Error("El catastro estará disponible tras aplicar la migración.");
      }
      throw new Error(del.error.message);
    }

    if (data.concessions.length > 0) {
      const withParcel = data.concessions.map((c) => ({
        project_id: data.projectId,
        created_by: me,
        code: c.code,
        name: c.name,
        concession_type: c.type,
        status: c.status,
        holder: c.holder ?? null,
        area_ha: c.areaHa ?? null,
        region: c.region ?? null,
        commune: c.commune ?? null,
        granted_at: c.grantedAt || null,
        expires_at: c.expiresAt || null,
        parcel_ids: c.parcelIds ?? null,
        notes: c.notes ?? null,
        geometry_geojson: c.geometry ?? null,
        source: "manual",
      }));
      let ins = await sb.from("mining_concessions").insert(withParcel);
      if (ins.error && isMissingColumn(ins.error.message) && !isMissingTable(ins.error.message)) {
        // parcel_ids aún no migrada: reintenta sin esa columna.
        const noParcel = withParcel.map(({ parcel_ids: _pi, ...rest }) => rest);
        ins = await sb.from("mining_concessions").insert(noParcel);
      }
      if (ins.error) throw new Error(ins.error.message);
    }
    return { ok: true, count: data.concessions.length };
  });
