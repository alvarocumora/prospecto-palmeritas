import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useProjects } from "./useProjects";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

export type EconomicScenario = {
  id: string;
  project_id: string;
  model_id: string;
  name: string;
  description: string | null;
  commodity_price_usd: number;
  price_unit: string;
  recovery_pct: number;
  payable_pct: number;
  mining_cost_usd_t: number;
  processing_cost_usd_t: number;
  ga_cost_usd_t: number;
  waste_cost_usd_t: number;
  royalty_pct: number;
  refining_cost_usd_oz: number;
  transport_cost_usd_t: number;
  slope_angle_deg: number;
  annual_throughput_t: number;
  discount_rate_pct: number;
  ramp_up_years: number;
  capex_usd: number;
  sustaining_capex_usd_t: number;
  status: string;
  nsr_cutoff_usd_t: number | null;
  ore_tonnes: number | null;
  waste_tonnes: number | null;
  strip_ratio: number | null;
  mean_grade: number | null;
  metal_payable: number | null;
  gross_revenue_usd: number | null;
  total_opex_usd: number | null;
  total_capex_usd: number | null;
  ebitda_usd: number | null;
  npv_usd: number | null;
  irr_pct: number | null;
  payback_years: number | null;
  mine_life_years: number | null;
  notes: string | null;
  computed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ScheduleRow = {
  id: string;
  scenario_id: string;
  year: number;
  ore_tonnes: number;
  waste_tonnes: number;
  mean_grade: number | null;
  metal_payable: number;
  revenue_usd: number;
  opex_usd: number;
  capex_usd: number;
  cashflow_usd: number;
  discounted_cashflow_usd: number;
  cumulative_cashflow_usd: number;
};

export function useEconomicScenarios(modelId: string | null) {
  const { active } = useProjects();
  const { user } = useAuth();
  const [scenarios, setScenarios] = useState<EconomicScenario[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    if (!active?.id) {
      setScenarios([]);
      return;
    }
    setLoading(true);
    try {
      let q = supabase
        .from("economic_scenarios")
        .select("*")
        .eq("project_id", active.id)
        .order("created_at", { ascending: false });
      if (modelId) q = q.eq("model_id", modelId);
      const { data, error } = await q;
      if (error) throw error;
      setScenarios((data ?? []) as EconomicScenario[]);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }, [active?.id, modelId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const create = async (input: Partial<EconomicScenario> & { name: string; model_id: string }) => {
    if (!user || !active?.id) throw new Error("Sin proyecto");
    const { data, error } = await supabase
      .from("economic_scenarios")
      .insert({
        project_id: active.id,
        model_id: input.model_id,
        name: input.name,
        description: input.description ?? null,
        commodity_price_usd: input.commodity_price_usd ?? 2000,
        price_unit: input.price_unit ?? "usd_per_oz",
        recovery_pct: input.recovery_pct ?? 90,
        payable_pct: input.payable_pct ?? 99,
        mining_cost_usd_t: input.mining_cost_usd_t ?? 3.5,
        processing_cost_usd_t: input.processing_cost_usd_t ?? 18,
        ga_cost_usd_t: input.ga_cost_usd_t ?? 2.5,
        waste_cost_usd_t: input.waste_cost_usd_t ?? 2.8,
        royalty_pct: input.royalty_pct ?? 3,
        refining_cost_usd_oz: input.refining_cost_usd_oz ?? 5,
        transport_cost_usd_t: input.transport_cost_usd_t ?? 4,
        slope_angle_deg: input.slope_angle_deg ?? 45,
        annual_throughput_t: input.annual_throughput_t ?? 1_000_000,
        discount_rate_pct: input.discount_rate_pct ?? 8,
        ramp_up_years: input.ramp_up_years ?? 1,
        capex_usd: input.capex_usd ?? 50_000_000,
        sustaining_capex_usd_t: input.sustaining_capex_usd_t ?? 1.5,
        status: "draft",
        created_by: user.id,
      })
      .select()
      .single();
    if (error) {
      toast.error(error.message);
      throw error;
    }
    toast.success("Escenario creado");
    await fetchAll();
    return data;
  };

  const update = async (id: string, patch: Partial<EconomicScenario>) => {
    const { error } = await supabase
      .from("economic_scenarios")
      .update(patch as never)
      .eq("id", id);
    if (error) {
      toast.error(error.message);
      throw error;
    }
    await fetchAll();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("economic_scenarios").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      throw error;
    }
    toast.success("Escenario eliminado");
    await fetchAll();
  };

  const compute = async (id: string) => {
    toast.loading("Calculando NSR / NPV…", { id: `econ-${id}` });
    const { data, error } = await supabase.functions.invoke("compute-economics", {
      body: { scenario_id: id },
    });
    toast.dismiss(`econ-${id}`);
    if (error || !data?.ok) {
      toast.error(error?.message ?? data?.error ?? "Error en cálculo");
      throw error;
    }
    toast.success(
      `NPV: USD ${(data.npv_usd / 1_000_000).toFixed(1)}M · IRR: ${data.irr_pct?.toFixed(1) ?? "—"}%`,
    );
    await fetchAll();
    return data;
  };

  const getSchedule = async (id: string): Promise<ScheduleRow[]> => {
    const { data, error } = await supabase
      .from("economic_schedule")
      .select("*")
      .eq("scenario_id", id)
      .order("year");
    if (error) throw error;
    return (data ?? []) as ScheduleRow[];
  };

  return {
    scenarios,
    loading,
    error,
    refresh: fetchAll,
    create,
    update,
    remove,
    compute,
    getSchedule,
  };
}
