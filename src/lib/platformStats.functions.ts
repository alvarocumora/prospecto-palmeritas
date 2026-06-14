// KPIs vivos de la plataforma — públicos (landing) y autenticados (dashboard).
// Sin requireSupabaseAuth: se ejecuta durante SSR/prerender de la landing.
import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type DbClient = SupabaseClient<Database>;
type TableName = keyof Database["public"]["Tables"];

export type PlatformStats = {
  projects: number;
  countries: number;
  concessionsManaged: number;
  hectaresManaged: number;
  cadastreNationalCount: number;
  mineralDeposits: number;
  explorationTargets: number;
  satelliteAnomalies: number;
  dealsOpen: number;
  opportunitiesScored: number;
  topOpportunityScore: number | null;
  featuredProjects: Array<{
    id: string;
    name: string;
    country: string | null;
    region: string | null;
    status: string | null;
    commodity: string | null;
  }>;
  updatedAt: string;
};

async function countTable(supabase: DbClient, table: TableName): Promise<number> {
  const { count, error } = await supabase.from(table).select("id", { count: "exact", head: true });
  if (error) return 0;
  return count ?? 0;
}

export const getPlatformStats = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const [projectsRes, concessions, cadNat, deposits, targets, anomalies, deals, opps] =
    await Promise.all([
      supabaseAdmin.from("projects").select("id,name,country,region,status,commodity").limit(8),
      supabaseAdmin.from("mining_concessions").select("area_ha", { count: "exact" }),
      (async () => {
        const { count, error } = await supabaseAdmin
          .from("cadastre_national")
          .select("id", { count: "exact", head: true })
          .is("archived_at", null);
        return error ? 0 : (count ?? 0);
      })(),
      countTable(supabaseAdmin, "mineral_deposits"),
      countTable(supabaseAdmin, "exploration_targets"),
      countTable(supabaseAdmin, "satellite_anomalies"),
      countTable(supabaseAdmin, "deals"),
      supabaseAdmin
        .from("cadastre_opportunities")
        .select("score", { count: "exact" })
        .order("score", { ascending: false })
        .limit(1),
    ]);

  const projectRows = projectsRes.data ?? [];
  const concessionRows = (concessions.data as Array<{ area_ha: number | null }> | null) ?? [];
  const hectares = concessionRows.reduce((acc, r) => acc + (Number(r.area_ha) || 0), 0);
  const countries = new Set(projectRows.map((p) => p.country).filter(Boolean)).size;
  const topOpp = (opps.data as Array<{ score: number }> | null)?.[0]?.score ?? null;

  const stats: PlatformStats = {
    projects: projectRows.length,
    countries,
    concessionsManaged: concessions.count ?? concessionRows.length,
    hectaresManaged: Math.round(hectares),
    cadastreNationalCount: cadNat,
    mineralDeposits: deposits,
    explorationTargets: targets,
    satelliteAnomalies: anomalies,
    dealsOpen: deals,
    opportunitiesScored: opps.count ?? 0,
    topOpportunityScore: topOpp,
    featuredProjects: projectRows.map((p) => ({
      id: p.id,
      name: p.name,
      country: p.country,
      region: p.region ?? null,
      status: p.status ?? null,
      commodity: p.commodity ?? null,
    })),
    updatedAt: new Date().toISOString(),
  };

  return stats;
});
