import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type TickerItem = {
  symbol: string;
  name: string;
  unit: string;
  price: number;
  change_pct: number;
};

export const getTerminalTicker = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("commodity_prices")
    .select("symbol,name,unit,price,change_pct,updated_at")
    .order("symbol", { ascending: true });
  if (error) return { items: [] as TickerItem[], error: error.message };
  return {
    items: (data ?? []).map((d) => ({
      symbol: d.symbol,
      name: d.name,
      unit: d.unit,
      price: Number(d.price),
      change_pct: Number(d.change_pct),
    })) as TickerItem[],
    error: null as string | null,
  };
});

export type PortfolioProject = {
  id: string;
  code: string;
  name: string;
  commodity: string | null;
  region: string | null;
  status: string;
  center_lat: number | null;
  center_lng: number | null;
  open_alerts: number;
  concession_count: number;
};

export const getTerminalPortfolio = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    // projects via membership (RLS will scope, but we filter explicitly too)
    const { data: memberships } = await supabase
      .from("project_members")
      .select("project_id")
      .eq("user_id", userId);

    const ids = (memberships ?? []).map((m) => m.project_id);
    if (ids.length === 0) {
      return { projects: [] as PortfolioProject[], totals: { count: 0, openAlerts: 0 } };
    }

    const { data: projects } = await supabase
      .from("projects")
      .select("id,code,name,commodity,region,status,center_lat,center_lng")
      .in("id", ids);

    const { data: alerts } = await supabase
      .from("concession_alerts")
      .select("project_id")
      .in("project_id", ids)
      .eq("acknowledged", false);

    const { data: concs } = await supabase
      .from("mining_concessions")
      .select("project_id")
      .in("project_id", ids);

    const alertCount = new Map<string, number>();
    (alerts ?? []).forEach((a) => {
      if (a && "project_id" in a && a.project_id) {
        alertCount.set(a.project_id, (alertCount.get(a.project_id) ?? 0) + 1);
      }
    });
    const concCount = new Map<string, number>();
    (concs ?? []).forEach((c) => {
      if (c && "project_id" in c && c.project_id) {
        concCount.set(c.project_id, (concCount.get(c.project_id) ?? 0) + 1);
      }
    });

    const out: PortfolioProject[] = (projects ?? []).map((p) => ({
      id: p.id,
      code: p.code,
      name: p.name,
      commodity: p.commodity,
      region: p.region,
      status: p.status,
      center_lat: p.center_lat != null ? Number(p.center_lat) : null,
      center_lng: p.center_lng != null ? Number(p.center_lng) : null,
      open_alerts: alertCount.get(p.id) ?? 0,
      concession_count: concCount.get(p.id) ?? 0,
    }));

    return {
      projects: out,
      totals: {
        count: out.length,
        openAlerts: (alerts ?? []).length,
      },
    };
  });
