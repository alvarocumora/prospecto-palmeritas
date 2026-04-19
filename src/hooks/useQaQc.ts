import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export type QaQcStandard = {
  id: string;
  project_id: string;
  code: string;
  name: string;
  element: string;
  expected_value: number;
  tolerance_pct: number;
  unit: string;
  certifying_lab: string | null;
  notes: string | null;
  created_at: string;
};

export type QaQcResult = {
  id: string;
  project_id: string;
  sample_code: string;
  qc_type: "blank" | "standard" | "duplicate";
  element: string;
  measured_value: number | null;
  standard_id: string | null;
  parent_sample_code: string | null;
  status: "pending" | "pass" | "warn" | "fail";
  certificate: string | null;
  lab: string | null;
  measured_at: string | null;
  notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
};

export function useQaQc(projectId: string | null) {
  const { user } = useAuth();
  const [standards, setStandards] = useState<QaQcStandard[]>([]);
  const [results, setResults] = useState<QaQcResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!projectId) {
      setStandards([]); setResults([]); setLoading(false); return;
    }
    setLoading(true);
    const [s, r] = await Promise.all([
      supabase.from("qaqc_standards").select("*").eq("project_id", projectId).order("code"),
      supabase.from("qaqc_results").select("*").eq("project_id", projectId).order("created_at", { ascending: false }),
    ]);
    if (s.error) setError(s.error.message);
    else if (r.error) setError(r.error.message);
    else {
      setStandards((s.data ?? []) as QaQcStandard[]);
      setResults((r.data ?? []) as QaQcResult[]);
      setError(null);
    }
    setLoading(false);
  }, [projectId]);

  useEffect(() => { refresh(); }, [refresh]);

  const addStandard = useCallback(async (s: Omit<QaQcStandard, "id" | "created_at" | "project_id"> & { project_id?: string }) => {
    if (!projectId || !user) return { error: "no-context" };
    const { error } = await supabase.from("qaqc_standards").insert({
      project_id: projectId,
      created_by: user.id,
      code: s.code,
      name: s.name,
      element: s.element,
      expected_value: s.expected_value,
      tolerance_pct: s.tolerance_pct,
      unit: s.unit,
      certifying_lab: s.certifying_lab,
      notes: s.notes,
    });
    if (!error) await refresh();
    return { error: error?.message ?? null };
  }, [projectId, user, refresh]);

  const addResult = useCallback(async (r: {
    sample_code: string;
    qc_type: "blank" | "standard" | "duplicate";
    element: string;
    measured_value: number | null;
    standard_id: string | null;
    parent_sample_code: string | null;
    certificate: string | null;
    lab: string | null;
    measured_at: string | null;
    notes: string | null;
  }) => {
    if (!projectId || !user) return { error: "no-context" };

    // compute status
    let status: QaQcResult["status"] = "pending";
    if (r.qc_type === "blank") {
      if (r.measured_value == null) status = "pending";
      else if (r.measured_value <= 0.01) status = "pass";
      else if (r.measured_value <= 0.05) status = "warn";
      else status = "fail";
    } else if (r.qc_type === "standard" && r.standard_id) {
      const std = standards.find((s) => s.id === r.standard_id);
      if (std && r.measured_value != null) {
        const diffPct = Math.abs(r.measured_value - std.expected_value) / std.expected_value * 100;
        if (diffPct <= std.tolerance_pct) status = "pass";
        else if (diffPct <= std.tolerance_pct * 2) status = "warn";
        else status = "fail";
      }
    }

    const { error } = await supabase.from("qaqc_results").insert({
      project_id: projectId,
      created_by: user.id,
      ...r,
      status,
    });
    if (!error) await refresh();
    return { error: error?.message ?? null };
  }, [projectId, user, standards, refresh]);

  const reviewResult = useCallback(async (id: string, status: "pass" | "warn" | "fail", notes?: string) => {
    if (!user) return { error: "no-user" };
    const { error } = await supabase.from("qaqc_results").update({
      status,
      notes: notes ?? undefined,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    }).eq("id", id);
    if (!error) await refresh();
    return { error: error?.message ?? null };
  }, [user, refresh]);

  return { standards, results, loading, error, refresh, addStandard, addResult, reviewResult };
}
