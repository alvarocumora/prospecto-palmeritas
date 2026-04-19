import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export type ExecutiveKpis = {
  totalProjects: number;
  totalHoles: number;
  totalMetersDrilled: number;
  totalSamples: number;
  auWeightedAvg: number | null;
  totalGeophysicsCapex: number;
  monthInterceptCount: number;
  // Fase 1 — gobernanza
  pendingReview: number;       // drill_core_logs + sampling_results en review
  approvedRecords: number;     // approved en ambos
  draftRecords: number;        // draft en ambos
  qaqcFailRate: number | null; // % fail sobre total resultado QA/QC
  qaqcTotal: number;
};

export function useExecutiveKpis() {
  const { user } = useAuth();
  const [kpis, setKpis] = useState<ExecutiveKpis | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      setLoading(true);
      // Project IDs visible to user via membership
      const { data: memberships } = await supabase
        .from("project_members")
        .select("project_id")
        .eq("user_id", user.id);
      const ids = (memberships ?? []).map((m) => m.project_id);
      if (ids.length === 0) {
        if (!cancelled) {
          setKpis({ totalProjects: 0, totalHoles: 0, totalMetersDrilled: 0, totalSamples: 0, auWeightedAvg: null, totalGeophysicsCapex: 0, monthInterceptCount: 0 });
          setLoading(false);
        }
        return;
      }

      const [holes, samples, surveys, coreLogs] = await Promise.all([
        supabase.from("drill_holes").select("id,actual_depth").in("project_id", ids),
        supabase.from("sampling_results").select("au_gpt").in("project_id", ids),
        supabase.from("geophysics_surveys").select("cost_usd").in("project_id", ids),
        supabase.from("drill_core_logs").select("au_gpt,depth_from,depth_to,created_at").in("project_id", ids),
      ]);

      const totalMetersDrilled = (holes.data ?? []).reduce((s, h: any) => s + (Number(h.actual_depth) || 0), 0);
      const auVals = (samples.data ?? []).map((s: any) => Number(s.au_gpt)).filter((v) => !isNaN(v) && v > 0);
      const auWeightedAvg = auVals.length ? auVals.reduce((a, b) => a + b, 0) / auVals.length : null;
      const totalGeophysicsCapex = (surveys.data ?? []).reduce((s, x: any) => s + (Number(x.cost_usd) || 0), 0);

      const monthAgo = Date.now() - 30 * 24 * 3600 * 1000;
      const monthInterceptCount = (coreLogs.data ?? []).filter((c: any) => {
        const au = Number(c.au_gpt);
        return au >= 0.5 && new Date(c.created_at).getTime() >= monthAgo;
      }).length;

      if (!cancelled) {
        setKpis({
          totalProjects: ids.length,
          totalHoles: (holes.data ?? []).length,
          totalMetersDrilled,
          totalSamples: (samples.data ?? []).length,
          auWeightedAvg,
          totalGeophysicsCapex,
          monthInterceptCount,
        });
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  return { kpis, loading };
}
