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
  // Cast a SupabaseClient sin genéricos: con 135+ tablas el union type dispara
  // TS2589 (instantiation excessively deep) al pasar `table` dinámicamente.
  const client = supabase as unknown as SupabaseClient;
  const { count, error } = await client.from(table).select("id", { count: "exact", head: true });
  if (error) return 0;
  return count ?? 0;
}

export const getPlatformStats = createServerFn({ method: "GET" }).handler(async () => {
  const { memoize } = await import("@/lib/server/memoCache");
  // KPIs agregados: 10 min de desfase evita ~10 conteos completos por visita.
  return memoize("platform-stats", 10 * 60 * 1000, loadPlatformStats);
});

async function loadPlatformStats(): Promise<PlatformStats> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // `dealsOpen` = operaciones vivas reales: solicitudes de inversión en curso
  // + trades de commodities en curso. La tabla `deals` quedó deprecada (datos
  // sembrados sin proyecto asociado) y ya no alimenta métricas públicas.
  const [projectsRes, concessions, cadNat, deposits, targets, anomalies, openDeals, opps] =
    await Promise.all([
      supabaseAdmin.from("projects").select("id,name,country,region,status,commodity").limit(8),
      supabaseAdmin.from("mining_concessions").select("area_ha", { count: "exact" }),
      (async () => {
        const { count, error } = await supabaseAdmin
          .from("cadastre_national")
          .select("id", { count: "planned", head: true })
          .is("archived_at", null);
        return error ? 0 : (count ?? 0);
      })(),
      countTable(supabaseAdmin, "mineral_deposits"),
      countTable(supabaseAdmin, "exploration_targets"),
      countTable(supabaseAdmin, "satellite_anomalies"),
      (async () => {
        const [inq, trades] = await Promise.all([
          supabaseAdmin
            .from("property_deal_inquiries")
            .select("id", { count: "exact", head: true })
            .is("closed_at", null),
          supabaseAdmin
            .from("commodity_trades")
            .select("id", { count: "exact", head: true })
            .not("status", "in", "(completed,cancelled,closed)"),
        ]);
        return (inq.count ?? 0) + (trades.count ?? 0);
      })(),
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
    dealsOpen: openDeals,
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
}
