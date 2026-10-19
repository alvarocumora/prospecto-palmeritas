/**
 * SPV / cap table, etapas de faena y certificaciones por proyecto.
 *
 * Reglas:
 *  - El inversionista sólo ve su propia posición (RLS + filtro explícito).
 *  - El alta/edición/anulación de posiciones es sólo para staff GeoCapitals,
 *    verificado en el servidor con `is_geocapitals_staff`.
 *
 * saveSpvPosition es la vía MANUAL del cap table (posiciones heredadas o
 * fundadores, sin ticket asociado): no pasa por la máquina de estados de
 * investment_tickets ni por ticket_settle. Queda su propio audit trail en
 * spv_position_events (ver getPositionEvents). No usarla para cargar una
 * inversión que debería originarse como ticket — esa siempre se liquida
 * con ticket_settle, que es quien emite la spv_position real.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const CodeInput = z.object({ projectCode: z.string().min(2).max(40) });

export type SpvEntity = {
  id: string;
  project_code: string;
  legal_name: string;
  rut: string | null;
  total_shares: number;
  share_price: number | null;
  currency: string;
  incorporated_on: string | null;
  notes: string | null;
};

export type SpvPosition = {
  id: string;
  spv_id: string;
  investor_user_id: string | null;
  investor_name: string;
  investor_email: string | null;
  shares: number;
  amount_paid: number;
  currency: string;
  instrument: string;
  subscribed_on: string;
  document_url: string | null;
  status: string;
  notes: string | null;
};

export type StageRow = {
  id: string;
  stage_key: string;
  label: string;
  status: string;
  started_on: string | null;
  completed_on: string | null;
  evidence: string | null;
  provenance: string;
  sort_order: number;
};

export type MetricRow = {
  id: string;
  period: string;
  metric_key: string;
  label: string;
  value: number | null;
  unit: string | null;
  provenance: string;
  source: string | null;
};

export type CertRow = {
  id: string;
  kind: string;
  issuer: string | null;
  number: string | null;
  issued_on: string | null;
  expires_on: string | null;
  status: string;
  file_url: string | null;
  provenance: string;
  notes: string | null;
};

export type SpvOverview = {
  isStaff: boolean;
  userId: string;
  spv: SpvEntity | null;
  /** Cap table completo (sólo staff) o sólo las posiciones del usuario. */
  positions: SpvPosition[];
  myPositions: SpvPosition[];
  stages: StageRow[];
  metrics: MetricRow[];
  certifications: CertRow[];
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function isStaff(supabase: any, userId: string): Promise<boolean> {
  const { data } = await supabase.rpc("is_geocapitals_staff", { _user_id: userId });
  return !!data;
}

export const getSpvOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => CodeInput.parse(d))
  .handler(async ({ data, context }): Promise<SpvOverview> => {
    const { supabase, userId } = context;
    const staff = await isStaff(supabase, userId);

    const { data: spv } = await supabase
      .from("spv_entities")
      .select(
        "id, project_code, legal_name, rut, total_shares, share_price, currency, incorporated_on, notes",
      )
      .eq("project_code", data.projectCode)
      .maybeSingle();

    let positions: SpvPosition[] = [];
    if (spv) {
      let q = supabase
        .from("spv_positions")
        .select(
          "id, spv_id, investor_user_id, investor_name, investor_email, shares, amount_paid, currency, instrument, subscribed_on, document_url, status, notes",
        )
        .eq("spv_id", spv.id)
        .order("subscribed_on", { ascending: true });
      if (!staff) q = q.eq("investor_user_id", userId);
      const { data: rows } = await q;
      positions = (rows ?? []) as SpvPosition[];
    }

    const [{ data: stages }, { data: metrics }, { data: certs }] = await Promise.all([
      supabase
        .from("project_stage_timeline")
        .select(
          "id, stage_key, label, status, started_on, completed_on, evidence, provenance, sort_order",
        )
        .eq("project_code", data.projectCode)
        .order("sort_order", { ascending: true }),
      supabase
        .from("project_operations_metrics")
        .select("id, period, metric_key, label, value, unit, provenance, source")
        .eq("project_code", data.projectCode)
        .order("period", { ascending: false })
        .limit(60),
      supabase
        .from("project_certifications")
        .select(
          "id, kind, issuer, number, issued_on, expires_on, status, file_url, provenance, notes",
        )
        .eq("project_code", data.projectCode)
        .order("expires_on", { ascending: true, nullsFirst: false }),
    ]);

    return {
      isStaff: staff,
      userId,
      spv: (spv ?? null) as SpvEntity | null,
      positions,
      myPositions: positions.filter((p) => p.investor_user_id === userId),
      stages: (stages ?? []) as StageRow[],
      metrics: (metrics ?? []) as MetricRow[],
      certifications: (certs ?? []) as CertRow[],
    };
  });

export type CapTableSpv = {
  id: string;
  project_code: string;
  legal_name: string;
  total_shares: number;
  currency: string;
};

export type CapTablePosition = {
  id: string;
  spv_id: string;
  investor_name: string;
  investor_email: string | null;
  shares: number;
  amount_paid: number;
  currency: string;
  status: string;
  subscribed_on: string;
};

/** Cap table consolidado de varios proyectos, para el panel admin (solo staff). */
export const getCapTableAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ codes: z.array(z.string()).max(10) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!(await isStaff(supabase, userId))) throw new Error("No autorizado");
    const { data: spvs } = await supabase
      .from("spv_entities")
      .select("id, project_code, legal_name, total_shares, currency")
      .in("project_code", data.codes);
    const ids = (spvs ?? []).map((s: { id: string }) => s.id);
    const { data: positions } = ids.length
      ? await supabase
          .from("spv_positions")
          .select(
            "id, spv_id, investor_name, investor_email, shares, amount_paid, currency, status, subscribed_on",
          )
          .in("spv_id", ids)
          .order("subscribed_on", { ascending: true })
      : { data: [] };
    return {
      spvs: (spvs ?? []) as CapTableSpv[],
      positions: (positions ?? []) as CapTablePosition[],
    };
  });

const UpsertSpv = z.object({
  projectCode: z.string().min(2).max(40),
  legalName: z.string().min(2).max(200),
  rut: z.string().max(40).nullable().optional(),
  totalShares: z.number().min(0),
  sharePrice: z.number().min(0).nullable().optional(),
  currency: z.string().min(2).max(6).default("CLP"),
  incorporatedOn: z.string().nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
});

export const upsertSpvEntity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => UpsertSpv.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!(await isStaff(supabase, userId))) throw new Error("No autorizado");
    const { error } = await supabase.from("spv_entities").upsert(
      {
        project_code: data.projectCode,
        legal_name: data.legalName,
        rut: data.rut ?? null,
        total_shares: data.totalShares,
        share_price: data.sharePrice ?? null,
        currency: data.currency,
        incorporated_on: data.incorporatedOn || null,
        notes: data.notes ?? null,
      },
      { onConflict: "project_code" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const PositionInput = z.object({
  id: z.string().uuid().optional(),
  projectCode: z.string().min(2).max(40),
  investorUserId: z.string().uuid().nullable().optional(),
  investorName: z.string().min(2).max(200),
  investorEmail: z.string().email().nullable().optional(),
  shares: z.number().min(0),
  amountPaid: z.number().min(0),
  currency: z.string().min(2).max(6).default("CLP"),
  instrument: z.string().min(2).max(60).default("equity"),
  subscribedOn: z.string(),
  documentUrl: z.string().max(500).nullable().optional(),
  status: z.enum(["active", "cancelled"]).default("active"),
  notes: z.string().max(1000).nullable().optional(),
});

export const saveSpvPosition = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => PositionInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!(await isStaff(supabase, userId))) throw new Error("No autorizado");

    const { data: spv } = await supabase
      .from("spv_entities")
      .select("id")
      .eq("project_code", data.projectCode)
      .maybeSingle();
    if (!spv) throw new Error("No existe una SPV registrada para este proyecto");

    const payload = {
      spv_id: spv.id,
      investor_user_id: data.investorUserId ?? null,
      investor_name: data.investorName,
      investor_email: data.investorEmail ?? null,
      shares: data.shares,
      amount_paid: data.amountPaid,
      currency: data.currency,
      instrument: data.instrument,
      subscribed_on: data.subscribedOn,
      document_url: data.documentUrl ?? null,
      status: data.status,
      notes: data.notes ?? null,
      created_by: userId,
    };

    let positionId = data.id ?? null;
    if (positionId) {
      const { error } = await supabase.from("spv_positions").update(payload).eq("id", positionId);
      if (error) throw new Error(error.message);
    } else {
      const { data: row, error } = await supabase
        .from("spv_positions")
        .insert(payload)
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      positionId = row.id;
    }

    await supabase.from("spv_position_events").insert({
      position_id: positionId,
      event_type: data.id ? "updated" : "created",
      detail: {
        shares: data.shares,
        amount_paid: data.amountPaid,
        currency: data.currency,
        status: data.status,
      },
      actor_id: userId,
    });

    return { ok: true, id: positionId };
  });

export const getPositionEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ positionId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("spv_position_events")
      .select("id, event_type, detail, created_at")
      .eq("position_id", data.positionId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });
