import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Json } from "@/integrations/supabase/types";
import { requireCapitalRole } from "@/lib/access/roleMiddleware";
import {
  normalizeProvenance,
  normalizeSection,
  type FactSection,
  type Provenance,
} from "@/lib/provenance";

// Pipeline interno de adquisición de pedimentos/proyectos pre-exploración
// (deals + pedimentos + project_facts + follow_up_tasks + deal_comparables +
// deal_certifier_assignments). Distinto del marketplace de venta en
// /dashboard/deals ("Deal Flow", property_listings) — acá es el lado de
// adquisición/opción, no de venta.

const asSb = (c: unknown): SupabaseClient => c as SupabaseClient;
const isMissingTable = (msg: string) => /does not exist|relation|schema cache/i.test(msg);

export type AcquisitionDealSummary = {
  id: string;
  code: string;
  name: string;
  commodity: string | null;
  region: string | null;
  dealStatus: string;
  projectId: string | null;
  projectName: string | null;
  openAlerts: number;
  createdAt: string;
};

export const listAcquisitionDeals = createServerFn({ method: "GET" })
  .middleware([requireCapitalRole])
  .handler(async ({ context }): Promise<{ pending: boolean; deals: AcquisitionDealSummary[] }> => {
    const sb = asSb(context.supabase);

    const { data: deals, error } = await sb
      .from("deals")
      .select("id, code, name, commodity, region, deal_status, project_id, created_at")
      .order("created_at", { ascending: false });
    if (error) {
      if (isMissingTable(error.message)) return { pending: true, deals: [] };
      throw new Error(error.message);
    }
    const rows = (deals ?? []) as Array<{
      id: string;
      code: string;
      name: string;
      commodity: string | null;
      region: string | null;
      deal_status: string;
      project_id: string | null;
      created_at: string;
    }>;

    const projectIds = Array.from(
      new Set(rows.map((d) => d.project_id).filter((id): id is string => !!id)),
    );
    const projectNameById = new Map<string, string>();
    if (projectIds.length > 0) {
      const { data: projects } = await sb.from("projects").select("id, name").in("id", projectIds);
      for (const p of (projects ?? []) as Array<{ id: string; name: string }>) {
        projectNameById.set(p.id, p.name);
      }
    }

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
      deals: rows.map((d) => ({
        id: d.id,
        code: d.code,
        name: d.name,
        commodity: d.commodity,
        region: d.region,
        dealStatus: d.deal_status,
        projectId: d.project_id,
        projectName: d.project_id ? (projectNameById.get(d.project_id) ?? null) : null,
        openAlerts: d.project_id ? (alertCountByProject.get(d.project_id) ?? 0) : 0,
        createdAt: d.created_at,
      })),
    };
  });

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

export type AcquisitionComparable = {
  id: string;
  comparableProject: string;
  country: string | null;
  year: number | null;
  notes: string | null;
};

export type AcquisitionCertifierAssignment = {
  id: string;
  discipline: string;
  standard: string;
  role: string;
  status: string;
  qualifiedPersonName: string | null;
};

export type AcquisitionDealDetail = {
  deal: {
    id: string;
    code: string;
    name: string;
    description: string | null;
    commodity: string | null;
    region: string | null;
    dealStatus: string;
    acquisitionStructure: string;
    acquisitionTerms: Json;
  };
  project: {
    id: string;
    name: string;
    centerLat: number | null;
    centerLng: number | null;
    region: string | null;
    commodity: string | null;
    status: string;
  } | null;
  pedimentos: AcquisitionPedimento[];
  facts: AcquisitionFact[];
  alerts: AcquisitionAlert[];
  comparables: AcquisitionComparable[];
  certifiers: AcquisitionCertifierAssignment[];
};

const DetailInput = z.object({ dealId: z.string().uuid() });

export const getAcquisitionDealDetail = createServerFn({ method: "GET" })
  .middleware([requireCapitalRole])
  .inputValidator((input) => DetailInput.parse(input))
  .handler(async ({ data, context }): Promise<AcquisitionDealDetail | null> => {
    const sb = asSb(context.supabase);

    const { data: deal, error: dealErr } = await sb
      .from("deals")
      .select(
        "id, code, name, description, commodity, region, deal_status, acquisition_structure, acquisition_terms, project_id",
      )
      .eq("id", data.dealId)
      .maybeSingle();
    if (dealErr) throw new Error(dealErr.message);
    if (!deal) return null;

    let project: AcquisitionDealDetail["project"] = null;
    if (deal.project_id) {
      const { data: p } = await sb
        .from("projects")
        .select("id, name, center_lat, center_lng, region, commodity, status")
        .eq("id", deal.project_id)
        .maybeSingle();
      if (p) {
        project = {
          id: p.id,
          name: p.name,
          centerLat: p.center_lat,
          centerLng: p.center_lng,
          region: p.region,
          commodity: p.commodity,
          status: p.status,
        };
      }
    }

    const [pedimentosRes, factsRes, alertsRes, comparablesRes, certifiersRes] = await Promise.all([
      deal.project_id
        ? sb
            .from("pedimentos")
            .select("id, nombre, estado, area_ha, juzgado, region, datum, utm_zone, notas")
            .eq("project_id", deal.project_id)
            .order("nombre", { ascending: true })
        : Promise.resolve({ data: [], error: null }),
      deal.project_id
        ? sb
            .from("project_facts")
            .select("id, section, label, value, unit, provenance, note, sort_order")
            .eq("project_id", deal.project_id)
            .order("sort_order", { ascending: true })
        : Promise.resolve({ data: [], error: null }),
      deal.project_id
        ? sb
            .from("follow_up_tasks")
            .select("id, title, description, category, priority, status, due_date")
            .eq("project_id", deal.project_id)
            .order("priority", { ascending: false })
        : Promise.resolve({ data: [], error: null }),
      sb
        .from("deal_comparables")
        .select("id, comparable_project, country, year, notes")
        .eq("deal_id", deal.id),
      sb
        .from("deal_certifier_assignments")
        .select("id, discipline, standard, role, status, qualified_persons(full_name)")
        .eq("deal_id", deal.id),
    ]);

    return {
      deal: {
        id: deal.id,
        code: deal.code,
        name: deal.name,
        description: deal.description,
        commodity: deal.commodity,
        region: deal.region,
        dealStatus: deal.deal_status,
        acquisitionStructure: deal.acquisition_structure,
        acquisitionTerms: deal.acquisition_terms,
      },
      project,
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
      comparables: ((comparablesRes.data ?? []) as Array<Record<string, unknown>>).map((r) => ({
        id: String(r.id),
        comparableProject: String(r.comparable_project),
        country: (r.country as string | null) ?? null,
        year: (r.year as number | null) ?? null,
        notes: (r.notes as string | null) ?? null,
      })),
      certifiers: ((certifiersRes.data ?? []) as Array<Record<string, unknown>>).map((r) => ({
        id: String(r.id),
        discipline: String(r.discipline),
        standard: String(r.standard),
        role: String(r.role),
        status: String(r.status),
        qualifiedPersonName:
          (r.qualified_persons as { full_name?: string } | null)?.full_name ?? null,
      })),
    };
  });
