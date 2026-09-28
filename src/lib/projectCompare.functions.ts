// Comparación lado a lado de fichas de proyecto (antecedentes cargados en las
// tablas canónicas). No calcula ni infiere cifras: sólo agrega lo declarado.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ProjectComparison = {
  projectId: string;
  code: string;
  name: string;
  region: string | null;
  country: string | null;
  commodity: string | null;
  status: string;
  centroid: [number, number] | null;
  concessions: { count: number; areaHa: number | null };
  samples: {
    count: number;
    cuAvgPct: number | null;
    cuMaxPct: number | null;
    auMaxGpt: number | null;
    agMaxGpt: number | null;
  };
  brief: {
    executiveSummary: string | null;
    miningModel: string | null;
    conclusion: string | null;
    risks: string[];
    sourceDocuments: string[];
  } | null;
  round: {
    roundSizeUsd: number | null;
    minTicketUsd: number | null;
    instrument: string | null;
    equityOfferedPct: number | null;
    valuationLowUsd: number | null;
    valuationHighUsd: number | null;
    valuationMethod: string | null;
    status: string | null;
  } | null;
  completeness: { score: number; missing: string[] };
};

function strList(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => String(x));
  return [];
}

export const compareProjects = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { codes?: string[] }) => ({
    codes: (input?.codes ?? ["CHOLQUI", "LV-TIL-001"]).slice(0, 4),
  }))
  .handler(async ({ context, data }): Promise<ProjectComparison[]> => {
    const sb = context.supabase;
    const { data: projects } = await sb
      .from("projects")
      .select("id,code,name,region,country,commodity,status,center_lat,center_lng")
      .in("code", data.codes);
    if (!projects?.length) return [];
    const ids = projects.map((p) => p.id);

    const [{ data: concs }, { data: samples }, { data: briefs }, { data: rounds }] =
      await Promise.all([
        sb.from("mining_concessions").select("project_id,area_ha").in("project_id", ids),
        sb.from("sampling_results").select("project_id,cu_pct,au_gpt,ag_gpt").in("project_id", ids),
        sb
          .from("project_technical_brief")
          .select("project_id,executive_summary,mining_model,conclusion,risks,source_documents")
          .in("project_id", ids),
        sb
          .from("project_fundraises")
          .select(
            "project_id,round_size_usd,min_ticket_usd,instrument,equity_offered_pct,valuation_low_usd,valuation_high_usd,valuation_method,status",
          )
          .in("project_id", ids),
      ]);

    const ordered = data.codes
      .map((c) => projects.find((p) => p.code === c))
      .filter((p): p is NonNullable<typeof p> => !!p);

    return ordered.map((p) => {
      const pc = (concs ?? []).filter((c) => c.project_id === p.id);
      const ps = (samples ?? []).filter((s) => s.project_id === p.id);
      const b = (briefs ?? []).find((x) => x.project_id === p.id) ?? null;
      const r = (rounds ?? []).find((x) => x.project_id === p.id) ?? null;

      const cu = ps.map((s) => s.cu_pct).filter((v): v is number => v != null);
      const au = ps.map((s) => s.au_gpt).filter((v): v is number => v != null);
      const ag = ps.map((s) => s.ag_gpt).filter((v): v is number => v != null);
      const areaHa = pc.reduce((acc, c) => acc + (c.area_ha != null ? Number(c.area_ha) : 0), 0);

      const missing: string[] = [];
      if (p.center_lat == null || p.center_lng == null) missing.push("Ubicación oficial");
      if (!pc.length) missing.push("Pertenencias");
      if (!ps.length) missing.push("Muestreo de laboratorio");
      if (!b) missing.push("Informe geológico");
      if (!r) missing.push("Ronda de financiamiento");
      const score = Math.round(((5 - missing.length) / 5) * 100);

      return {
        projectId: p.id,
        code: p.code,
        name: p.name,
        region: p.region,
        country: p.country,
        commodity: p.commodity,
        status: p.status,
        centroid:
          p.center_lat != null && p.center_lng != null
            ? [Number(p.center_lng), Number(p.center_lat)]
            : null,
        concessions: { count: pc.length, areaHa: pc.length ? Number(areaHa.toFixed(1)) : null },
        samples: {
          count: ps.length,
          cuAvgPct: cu.length
            ? Number((cu.reduce((a, v) => a + v, 0) / cu.length).toFixed(2))
            : null,
          cuMaxPct: cu.length ? Number(Math.max(...cu).toFixed(2)) : null,
          auMaxGpt: au.length ? Number(Math.max(...au).toFixed(2)) : null,
          agMaxGpt: ag.length ? Number(Math.max(...ag).toFixed(1)) : null,
        },
        brief: b
          ? {
              executiveSummary: b.executive_summary,
              miningModel: b.mining_model,
              conclusion: b.conclusion,
              risks: strList(b.risks),
              sourceDocuments: strList(b.source_documents),
            }
          : null,
        round: r
          ? {
              roundSizeUsd: r.round_size_usd != null ? Number(r.round_size_usd) : null,
              minTicketUsd: r.min_ticket_usd != null ? Number(r.min_ticket_usd) : null,
              instrument: r.instrument,
              equityOfferedPct: r.equity_offered_pct != null ? Number(r.equity_offered_pct) : null,
              valuationLowUsd: r.valuation_low_usd != null ? Number(r.valuation_low_usd) : null,
              valuationHighUsd: r.valuation_high_usd != null ? Number(r.valuation_high_usd) : null,
              valuationMethod: r.valuation_method,
              status: r.status,
            }
          : null,
        completeness: { score, missing },
      };
    });
  });
