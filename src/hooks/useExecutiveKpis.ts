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
  pendingReview: number;
  approvedRecords: number;
  draftRecords: number;
  qaqcFailRate: number | null;
  qaqcTotal: number;
  // Catastro & cumplimiento
  concessionsTotal: number;
  concessionsVigentes: number;
  concessionsCaducadas: number;
  concessionsConstitucion: number;
  concessionsExpiring90d: number;
  patentsDue: number;
  overlapsOpen: number;
  alertsUnread: number;
  bulletinsUnread: number;
  // Operación
  activeTargets: number;
  activeCampaigns: number;
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
          setKpis({
            totalProjects: 0, totalHoles: 0, totalMetersDrilled: 0, totalSamples: 0,
            auWeightedAvg: null, totalGeophysicsCapex: 0, monthInterceptCount: 0,
            pendingReview: 0, approvedRecords: 0, draftRecords: 0,
            qaqcFailRate: null, qaqcTotal: 0,
          });
          setLoading(false);
        }
        return;
      }

      const [holes, samples, surveys, coreLogs, qaqc] = await Promise.all([
        supabase.from("drill_holes").select("id,actual_depth").in("project_id", ids),
        supabase.from("sampling_results").select("au_gpt,record_status").in("project_id", ids),
        supabase.from("geophysics_surveys").select("cost_usd").in("project_id", ids),
        supabase.from("drill_core_logs").select("au_gpt,depth_from,depth_to,created_at,record_status").in("project_id", ids),
        supabase.from("qaqc_results").select("status").in("project_id", ids),
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

      // Workflow counts (logs + samples)
      const allRecs = [...(coreLogs.data ?? []), ...(samples.data ?? [])] as Array<{ record_status?: string }>;
      const pendingReview = allRecs.filter((r) => r.record_status === "review").length;
      const approvedRecords = allRecs.filter((r) => r.record_status === "approved").length;
      const draftRecords = allRecs.filter((r) => r.record_status === "draft").length;

      // QA/QC
      const qaRows = (qaqc.data ?? []) as Array<{ status: string }>;
      const qaqcTotal = qaRows.length;
      const qaqcFailRate = qaqcTotal > 0
        ? (qaRows.filter((r) => r.status === "fail").length / qaqcTotal) * 100
        : null;

      if (!cancelled) {
        setKpis({
          totalProjects: ids.length,
          totalHoles: (holes.data ?? []).length,
          totalMetersDrilled,
          totalSamples: (samples.data ?? []).length,
          auWeightedAvg,
          totalGeophysicsCapex,
          monthInterceptCount,
          pendingReview, approvedRecords, draftRecords,
          qaqcFailRate, qaqcTotal,
        });
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  return { kpis, loading };
}
