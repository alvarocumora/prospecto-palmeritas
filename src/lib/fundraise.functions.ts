import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  FUNDRAISE_INSTRUMENTS,
  FUNDRAISE_STATUSES,
  normalizeInstrument,
  normalizeStatus,
  validateUseOfFunds,
  type FundraiseData,
} from "@/lib/fundraise";

// Levantamiento de capital por proyecto (RLS: miembros del proyecto). La lectura
// devuelve la cabecera del proyecto + la ronda (o null) + si el usuario puede
// editar (owner/admin). Degrada elegante si project_fundraises aún no está
// migrada.

const asSb = (c: unknown): SupabaseClient => c as SupabaseClient;
const isMissingTable = (msg: string) => /does not exist|relation|schema cache/i.test(msg);

const EDIT_ROLES = new Set(["owner", "admin"]);

export type ProjectHeader = {
  id: string;
  code: string;
  name: string;
  commodity: string | null;
  region: string | null;
  country: string | null;
  status: string;
};

export type ProjectFundraiseView = {
  project: ProjectHeader;
  role: string | null;
  canEdit: boolean;
  /** true si la tabla aún no está migrada. */
  pending: boolean;
  fundraise: FundraiseData | null;
};

const asArray = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
const num = (v: unknown): number | null =>
  v == null || v === "" ? null : Number.isFinite(Number(v)) ? Number(v) : null;

function rowToData(r: Record<string, unknown>): FundraiseData {
  return {
    roundSizeUsd: num(r.round_size_usd),
    minTicketUsd: num(r.min_ticket_usd),
    instrument: normalizeInstrument(r.instrument as string | null),
    equityOfferedPct: num(r.equity_offered_pct),
    horizonYears: num(r.horizon_years),
    valuationLowUsd: num(r.valuation_low_usd),
    valuationHighUsd: num(r.valuation_high_usd),
    valuationMethod: (r.valuation_method as string | null) ?? null,
    financingStructure: (r.financing_structure as string | null) ?? null,
    useOfFunds: asArray<{ label: string; pct: number }>(r.use_of_funds),
    milestones: asArray<{ when: string; what: string }>(r.milestones),
    scenarios: asArray<{ key: string; label: string; multiple: number; note: string }>(r.scenarios),
    highlights: asArray<string>(r.highlights),
    notes: (r.notes as string | null) ?? null,
    status: normalizeStatus(r.status as string | null),
    isPublic: Boolean(r.is_public),
  };
}

async function myRole(sb: SupabaseClient, projectId: string, me: string): Promise<string | null> {
  const { data } = await sb
    .from("project_members")
    .select("role")
    .eq("project_id", projectId)
    .eq("user_id", me)
    .maybeSingle();
  return (data as { role: string } | null)?.role ?? null;
}

export const getProjectFundraise = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ projectId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<ProjectFundraiseView | null> => {
    const sb = asSb(context.supabase);
    const me = context.userId as string;

    const { data: proj } = await sb
      .from("projects")
      .select("id, code, name, commodity, region, country, status")
      .eq("id", data.projectId)
      .maybeSingle();
    if (!proj) return null; // RLS: no soy miembro o no existe
    const project = proj as ProjectHeader;

    const role = await myRole(sb, data.projectId, me);
    const canEdit = role != null && EDIT_ROLES.has(role);

    const { data: fr, error } = await sb
      .from("project_fundraises")
      .select("*")
      .eq("project_id", data.projectId)
      .maybeSingle();
    if (error) {
      if (isMissingTable(error.message)) {
        return { project, role, canEdit, pending: true, fundraise: null };
      }
      throw new Error(error.message);
    }
    return {
      project,
      role,
      canEdit,
      pending: false,
      fundraise: fr ? rowToData(fr as Record<string, unknown>) : null,
    };
  });

const UseOfFundSchema = z.object({
  label: z.string().trim().max(80),
  pct: z.number().min(0).max(100),
});
const MilestoneSchema = z.object({
  when: z.string().trim().max(60),
  what: z.string().trim().max(200),
});
const ScenarioSchema = z.object({
  key: z.string().trim().max(40),
  label: z.string().trim().max(60),
  multiple: z.number().min(0).max(1000),
  note: z.string().trim().max(300),
});

const UpsertInput = z.object({
  projectId: z.string().uuid(),
  roundSizeUsd: z.number().min(0).max(1e12).nullable().optional(),
  minTicketUsd: z.number().min(0).max(1e12).nullable().optional(),
  instrument: z.enum(FUNDRAISE_INSTRUMENTS).nullable().optional(),
  equityOfferedPct: z.number().min(0).max(100).nullable().optional(),
  horizonYears: z.number().min(0).max(100).nullable().optional(),
  valuationLowUsd: z.number().min(0).max(1e12).nullable().optional(),
  valuationHighUsd: z.number().min(0).max(1e12).nullable().optional(),
  valuationMethod: z.string().trim().max(120).nullable().optional(),
  financingStructure: z.string().trim().max(4000).nullable().optional(),
  useOfFunds: z.array(UseOfFundSchema).max(20).optional(),
  milestones: z.array(MilestoneSchema).max(20).optional(),
  scenarios: z.array(ScenarioSchema).max(10).optional(),
  highlights: z.array(z.string().trim().max(160)).max(12).optional(),
  notes: z.string().trim().max(4000).nullable().optional(),
  status: z.enum(FUNDRAISE_STATUSES).optional(),
  isPublic: z.boolean().optional(),
});

export const upsertProjectFundraise = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => UpsertInput.parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const sb = asSb(context.supabase);
    const me = context.userId as string;

    const role = await myRole(sb, data.projectId, me);
    if (!role || !EDIT_ROLES.has(role)) {
      throw new Error("Solo el owner o admin del proyecto puede editar el levantamiento.");
    }

    if (data.useOfFunds) {
      const v = validateUseOfFunds(data.useOfFunds);
      if (!v.ok) throw new Error(v.error ?? "Uso de fondos inválido.");
    }

    const row = {
      project_id: data.projectId,
      created_by: me,
      round_size_usd: data.roundSizeUsd ?? null,
      min_ticket_usd: data.minTicketUsd ?? null,
      instrument: data.instrument ?? null,
      equity_offered_pct: data.equityOfferedPct ?? null,
      horizon_years: data.horizonYears ?? null,
      valuation_low_usd: data.valuationLowUsd ?? null,
      valuation_high_usd: data.valuationHighUsd ?? null,
      valuation_method: data.valuationMethod ?? null,
      financing_structure: data.financingStructure ?? null,
      use_of_funds: data.useOfFunds ?? [],
      milestones: data.milestones ?? [],
      scenarios: data.scenarios ?? [],
      highlights: data.highlights ?? [],
      notes: data.notes ?? null,
      status: data.status ?? "draft",
      is_public: data.isPublic ?? false,
    };

    const { error } = await sb.from("project_fundraises").upsert(row, { onConflict: "project_id" });
    if (error) {
      if (isMissingTable(error.message)) {
        throw new Error("El módulo de financiamiento estará disponible tras aplicar la migración.");
      }
      throw new Error(error.message);
    }
    return { ok: true };
  });
