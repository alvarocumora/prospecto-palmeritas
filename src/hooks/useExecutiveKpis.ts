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
            concessionsTotal: 0, concessionsVigentes: 0, concessionsCaducadas: 0,
            concessionsConstitucion: 0, concessionsExpiring90d: 0,
            patentsDue: 0, overlapsOpen: 0, alertsUnread: 0, bulletinsUnread: 0,
            activeTargets: 0, activeCampaigns: 0,
          });
          setLoading(false);
        }
        return;
      }

      const in90 = new Date(Date.now() + 90 * 24 * 3600 * 1000).toISOString();
      const nowIso = new Date().toISOString();

      const [
        holes, samples, surveys, coreLogs, qaqc,
        concessions, patents, overlaps, alerts, bulletins,
        targets, campaigns,
      ] = await Promise.all([
        supabase.from("drill_holes").select("id,actual_depth").in("project_id", ids),
        supabase.from("sampling_results").select("au_gpt,record_status").in("project_id", ids),
        supabase.from("geophysics_surveys").select("cost_usd").in("project_id", ids),
        supabase.from("drill_core_logs").select("au_gpt,depth_from,depth_to,created_at,record_status").in("project_id", ids),
        supabase.from("qaqc_results").select("status").in("project_id", ids),
        supabase.from("mining_concessions").select("status,expires_at").in("project_id", ids),
        supabase.from("concession_patents").select("status").in("project_id", ids),
        supabase.from("concession_overlaps").select("id").in("project_id", ids).is("resolved_at", null),
        supabase.from("concession_alerts").select("id").in("project_id", ids).eq("is_read", false),
        supabase.from("bulletin_alerts").select("id").in("project_id", ids).eq("is_read", false),
        supabase.from("exploration_targets").select("stage").in("project_id", ids),
        supabase.from("exploration_campaigns").select("status").in("project_id", ids),
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

      const allRecs = [...(coreLogs.data ?? []), ...(samples.data ?? [])] as Array<{ record_status?: string }>;
      const pendingReview = allRecs.filter((r) => r.record_status === "review").length;
      const approvedRecords = allRecs.filter((r) => r.record_status === "approved").length;
      const draftRecords = allRecs.filter((r) => r.record_status === "draft").length;

      const qaRows = (qaqc.data ?? []) as Array<{ status: string }>;
      const qaqcTotal = qaRows.length;
      const qaqcFailRate = qaqcTotal > 0
        ? (qaRows.filter((r) => r.status === "fail").length / qaqcTotal) * 100
        : null;

      const concRows = (concessions.data ?? []) as Array<{ status: string; expires_at: string | null }>;
      const concessionsTotal = concRows.length;
      const concessionsVigentes = concRows.filter((c) => c.status === "vigente").length;
      const concessionsCaducadas = concRows.filter((c) => c.status === "caducada").length;
      const concessionsConstitucion = concRows.filter((c) => c.status === "constitucion").length;
      const concessionsExpiring90d = concRows.filter((c) =>
        c.expires_at && c.expires_at > nowIso && c.expires_at <= in90,
      ).length;

      const patentRows = (patents.data ?? []) as Array<{ status: string }>;
      const patentsDue = patentRows.filter((p) => p.status === "pending" || p.status === "overdue").length;

      const targetRows = (targets.data ?? []) as Array<{ stage: string }>;
      const activeTargets = targetRows.filter((t) => t.stage !== "closed").length;
      const campRows = (campaigns.data ?? []) as Array<{ status: string }>;
      const activeCampaigns = campRows.filter((c) => c.status === "active" || c.status === "in_progress").length;

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
          concessionsTotal, concessionsVigentes, concessionsCaducadas,
          concessionsConstitucion, concessionsExpiring90d,
          patentsDue,
          overlapsOpen: (overlaps.data ?? []).length,
          alertsUnread: (alerts.data ?? []).length,
          bulletinsUnread: (bulletins.data ?? []).length,
          activeTargets, activeCampaigns,
        });
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  return { kpis, loading };
}
