import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireCapitalRole } from "@/lib/access/roleMiddleware";
import {
  normalizeProvenance,
  normalizeSection,
  type FactSection,
  type Provenance,
} from "@/lib/provenance";

// Pipeline interno de adquisición de pedimentos/proyectos pre-exploración:
// projects + pedimentos + project_facts + follow_up_tasks. Deliberadamente
// NO usa `public.deals` (ni deal_comparables ni deal_certifier_assignments):
// esa tabla está marcada DEPRECADA en el propio schema —
// supabase/migrations/20260821230028_1fe2541e-53e9-4046-87a9-e20ab68afc31.sql:1
// dice "reemplazada por property_deal_inquiries + deal_stage_events ... No
// usar en UI ni en métricas". Esas tablas de reemplazo modelan el flujo de
// VENTA (comprador externo sobre un property_listing publicado, el motor
// detrás de /dashboard/deals "Deal Flow") y no encajan con una oportunidad
// de adquisición sourceada internamente — así que todo el contenido de
// "deal" (código, estructura de negocio, comparables, QP propuesto) vive
// como filas de project_facts en vez de forzar un modelo que no corresponde.

const asSb = (c: unknown): SupabaseClient => c as SupabaseClient;
const isMissingTable = (msg: string) => /does not exist|relation|schema cache/i.test(msg);

// Convención de este pipeline: solo se listan proyectos en fase de
// adquisición/pedimento, no proyectos ya activos (Cholqui, Los Verdes, etc.).
const ACQUISITION_STATUSES = ["pedimento"];

export type AcquisitionProjectSummary = {
  id: string;
  code: string;
  name: string;
  commodity: string | null;
  region: string | null;
  status: string;
  openAlerts: number;
  createdAt: string;
};

export const listAcquisitionProjects = createServerFn({ method: "GET" })
  .middleware([requireCapitalRole])
  .handler(
    async ({ context }): Promise<{ pending: boolean; projects: AcquisitionProjectSummary[] }> => {
      const sb = asSb(context.supabase);

      const { data: projects, error } = await sb
        .from("projects")
        .select("id, code, name, commodity, region, status, created_at")
        .in("status", ACQUISITION_STATUSES)
        .order("created_at", { ascending: false });
      if (error) {
        if (isMissingTable(error.message)) return { pending: true, projects: [] };
        throw new Error(error.message);
      }
      const rows = (projects ?? []) as Array<{
        id: string;
        code: string;
        name: string;
        commodity: string | null;
        region: string | null;
        status: string;
        created_at: string;
      }>;

      const projectIds = rows.map((p) => p.id);
      const alertCountByProject = new Map<string, number>();
      if (projectIds.length > 0) {
        const { data: alerts } = await sb
          .from("follow_up_tasks")
          .select("project_id")
          .in("project_id", projectIds)
          .eq("status", "open");
        for (const a of (alerts ?? []) as Array<{ project_id: string }>) {
          alertCountByProject.set(a.project_id, (alertCountByProject.get(a.project_id) ?? 0) + 1);
        }
      }

      return {
        pending: false,
        projects: rows.map((p) => ({
          id: p.id,
          code: p.code,
          name: p.name,
          commodity: p.commodity,
          region: p.region,
          status: p.status,
          openAlerts: alertCountByProject.get(p.id) ?? 0,
          createdAt: p.created_at,
        })),
      };
    },
  );

export type AcquisitionPedimento = {
  id: string;
  nombre: string;
  estado: string;
  areaHa: number;
  juzgado: string | null;
  region: string | null;
  datum: string;
  utmZone: number | null;
  notas: string | null;
};

export type AcquisitionFact = {
  id: string;
  section: FactSection;
  label: string;
  value: string | null;
  unit: string | null;
  provenance: Provenance;
  note: string | null;
};

export type AcquisitionAlert = {
  id: string;
  title: string;
  description: string | null;
  category: string;
  priority: string;
  status: string;
  dueDate: string | null;
};

export type AcquisitionProjectDetail = {
  project: {
    id: string;
    code: string;
    name: string;
    description: string | null;
    commodity: string | null;
    region: string | null;
    status: string;
    centerLat: number | null;
    centerLng: number | null;
  };
  pedimentos: AcquisitionPedimento[];
  facts: AcquisitionFact[];
  alerts: AcquisitionAlert[];
};

const DetailInput = z.object({ projectId: z.string().uuid() });

export const getAcquisitionProjectDetail = createServerFn({ method: "GET" })
  .middleware([requireCapitalRole])
  .inputValidator((input) => DetailInput.parse(input))
  .handler(async ({ data, context }): Promise<AcquisitionProjectDetail | null> => {
    const sb = asSb(context.supabase);

    const { data: project, error: projectErr } = await sb
      .from("projects")
      .select("id, code, name, description, commodity, region, status, center_lat, center_lng")
      .eq("id", data.projectId)
      .maybeSingle();
    if (projectErr) throw new Error(projectErr.message);
    if (!project) return null;

    // Solo alertas abiertas: una resuelta/descartada no debería seguir
    // mostrándose como advertencia activa en la ficha de adquisición.
    const [pedimentosRes, factsRes, alertsRes] = await Promise.all([
      sb
        .from("pedimentos")
        .select("id, nombre, estado, area_ha, juzgado, region, datum, utm_zone, notas")
        .eq("project_id", project.id)
        .order("nombre", { ascending: true }),
      sb
        .from("project_facts")
        .select("id, section, label, value, unit, provenance, note, sort_order")
        .eq("project_id", project.id)
        .order("sort_order", { ascending: true }),
      sb
        .from("follow_up_tasks")
        .select("id, title, description, category, priority, status, due_date")
        .eq("project_id", project.id)
        .eq("status", "open")
        .order("priority", { ascending: false }),
    ]);

    return {
      project: {
        id: project.id,
        code: project.code,
        name: project.name,
        description: project.description,
        commodity: project.commodity,
        region: project.region,
        status: project.status,
        centerLat: project.center_lat,
        centerLng: project.center_lng,
      },
      pedimentos: ((pedimentosRes.data ?? []) as Array<Record<string, unknown>>).map((r) => ({
        id: String(r.id),
        nombre: String(r.nombre),
        estado: String(r.estado),
        areaHa: Number(r.area_ha ?? 0),
        juzgado: (r.juzgado as string | null) ?? null,
        region: (r.region as string | null) ?? null,
        datum: String(r.datum ?? ""),
        utmZone: (r.utm_zone as number | null) ?? null,
        notas: (r.notas as string | null) ?? null,
      })),
      facts: ((factsRes.data ?? []) as Array<Record<string, unknown>>).map((r) => ({
        id: String(r.id),
        section: normalizeSection(r.section as string | null),
        label: String(r.label ?? ""),
        value: (r.value as string | null) ?? null,
        unit: (r.unit as string | null) ?? null,
        provenance: normalizeProvenance(r.provenance as string | null),
        note: (r.note as string | null) ?? null,
      })),
      alerts: ((alertsRes.data ?? []) as Array<Record<string, unknown>>).map((r) => ({
        id: String(r.id),
        title: String(r.title),
        description: (r.description as string | null) ?? null,
        category: String(r.category),
        priority: String(r.priority),
        status: String(r.status),
        dueDate: (r.due_date as string | null) ?? null,
      })),
    };
  });
