import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireAnyModuleRole } from "@/lib/access/roleMiddleware";
import {
  FACT_SECTIONS,
  PROVENANCE_STATES,
  normalizeProvenance,
  normalizeSection,
  type FactSection,
  type Provenance,
} from "@/lib/provenance";

// Ficha de datos del proyecto con procedencia (project_facts). Lectura por
// miembros; guardado (bulk replace) por owner/admin. Degrada si la tabla aún no
// está migrada.

const asSb = (c: unknown): SupabaseClient => c as SupabaseClient;
const isMissingTable = (msg: string) => /does not exist|relation|schema cache/i.test(msg);
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

export type ProjectFact = {
  id: string;
  section: FactSection;
  label: string;
  value: string | null;
  unit: string | null;
  provenance: Provenance;
  source: string | null;
  note: string | null;
};

export type FactSheetView = {
  canEdit: boolean;
  pending: boolean;
  facts: ProjectFact[];
};

export const getProjectFactSheet = createServerFn({ method: "GET" })
  .middleware([requireAnyModuleRole])
  .inputValidator((d: unknown) => z.object({ projectId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<FactSheetView> => {
    const sb = asSb(context.supabase);
    const me = context.userId as string;
    const role = await myRole(sb, data.projectId, me);
    const canEdit = role != null && EDIT_ROLES.has(role);

    const { data: rows, error } = await sb
      .from("project_facts")
      .select("id, section, label, value, unit, provenance, source, note, sort_order")
      .eq("project_id", data.projectId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) {
      if (isMissingTable(error.message)) return { canEdit, pending: true, facts: [] };
      throw new Error(error.message);
    }
    const facts: ProjectFact[] = ((rows ?? []) as Array<Record<string, unknown>>).map((r) => ({
      id: String(r.id),
      section: normalizeSection(r.section as string | null),
      label: String(r.label ?? ""),
      value: (r.value as string | null) ?? null,
      unit: (r.unit as string | null) ?? null,
      provenance: normalizeProvenance(r.provenance as string | null),
      source: (r.source as string | null) ?? null,
      note: (r.note as string | null) ?? null,
    }));
    return { canEdit, pending: false, facts };
  });

const FactInput = z.object({
  section: z.enum(FACT_SECTIONS),
  label: z.string().trim().min(1).max(120),
  value: z.string().trim().max(400).nullable().optional(),
  unit: z.string().trim().max(40).nullable().optional(),
  provenance: z.enum(PROVENANCE_STATES),
  source: z.string().trim().max(200).nullable().optional(),
  note: z.string().trim().max(600).nullable().optional(),
});

const SaveInput = z.object({
  projectId: z.string().uuid(),
  facts: z.array(FactInput).max(200),
});

export const saveProjectFactSheet = createServerFn({ method: "POST" })
  .middleware([requireAnyModuleRole])
  .inputValidator((d: unknown) => SaveInput.parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true; count: number }> => {
    const sb = asSb(context.supabase);
    const me = context.userId as string;
    const role = await myRole(sb, data.projectId, me);
    if (!role || !EDIT_ROLES.has(role)) {
      throw new Error("Solo el owner o admin del proyecto puede editar la ficha de datos.");
    }

    // Reemplazo completo: borra los datos actuales e inserta el set enviado.
    const del = await sb.from("project_facts").delete().eq("project_id", data.projectId);
    if (del.error) {
      if (isMissingTable(del.error.message)) {
        throw new Error("La ficha de datos estará disponible tras aplicar la migración.");
      }
      throw new Error(del.error.message);
    }

    if (data.facts.length > 0) {
      const rows = data.facts.map((f, i) => ({
        project_id: data.projectId,
        created_by: me,
        section: f.section,
        label: f.label,
        value: f.value ?? null,
        unit: f.unit ?? null,
        provenance: f.provenance,
        source: f.source ?? null,
        note: f.note ?? null,
        sort_order: i,
      }));
      const { error } = await sb.from("project_facts").insert(rows);
      if (error) throw new Error(error.message);
    }
    return { ok: true, count: data.facts.length };
  });
