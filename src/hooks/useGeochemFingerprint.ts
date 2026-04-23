import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type GeochemCluster = {
  cluster: number;
  centroid_pc1: number;
  centroid_pc2: number;
  sample_ids: string[];
  sample_count: number;
  au_mean_gpt: number;
};

export type GeochemSampleScore = {
  sample_id: string;
  sample_code: string;
  pc1: number;
  pc2: number;
  cluster: number;
};

export type GeochemAnalysis = {
  id: string;
  project_id: string;
  created_at: string;
  created_by: string;
  sample_count: number;
  elements_used: string[];
  pca_loadings: Record<string, { pc1: number; pc2: number }>;
  pca_variance: { pc1: number; pc2: number; all: number[] };
  pca_scores: GeochemSampleScore[];
  clusters: GeochemCluster[];
  cluster_count: number;
  pathfinder_scores: Record<string, number>;
  signature: string | null;
  signature_confidence: number | null;
  notes: string | null;
};

export function useGeochemFingerprint(projectId: string | null) {
  const [latest, setLatest] = useState<GeochemAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!projectId) { setLatest(null); return; }
    setLoading(true);
    const { data, error: err } = await supabase
      .from("geochem_analyses")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(1);
    if (err) setError(err.message);
    else setLatest(((data ?? [])[0] as unknown as GeochemAnalysis) ?? null);
    setLoading(false);
  }, [projectId]);

  useEffect(() => { void refresh(); }, [refresh]);

  const run = useCallback(async (opts?: { k?: number; notes?: string }) => {
    if (!projectId) return { ok: false, error: "Sin proyecto activo" };
    setRunning(true); setError(null);
    try {
      const { data, error: err } = await supabase.functions.invoke("geochem-fingerprint", {
        body: { project_id: projectId, k: opts?.k ?? 4, notes: opts?.notes },
      });
      if (err) { setError(err.message); return { ok: false, error: err.message }; }
      const errMsg = (data as { error?: string } | null)?.error;
      if (errMsg) { setError(errMsg); return { ok: false, error: errMsg }; }
      await refresh();
      return { ok: true };
    } finally {
      setRunning(false);
    }
  }, [projectId, refresh]);

  const generateTargets = useCallback(async (analysis: GeochemAnalysis): Promise<{ ok: boolean; created?: number; error?: string }> => {
    if (!projectId) return { ok: false, error: "Sin proyecto activo" };
    const { data: userResp } = await supabase.auth.getUser();
    const userId = userResp.user?.id;
    if (!userId) return { ok: false, error: "No autenticado" };

    // Fetch coordinates for the samples in each cluster (assumes sampling_results may have coords stored elsewhere; fall back to project center)
    const { data: project } = await supabase
      .from("projects")
      .select("center_lat,center_lng")
      .eq("id", projectId)
      .single();
    const baseLat = (project as { center_lat?: number; center_lng?: number } | null)?.center_lat ?? -33.898;
    const baseLng = (project as { center_lat?: number; center_lng?: number } | null)?.center_lng ?? -71.115;

    const ts = Date.now();
    const rows = analysis.clusters
      .filter((c) => c.sample_count >= 2)
      .map((c, idx) => {
        // Spread offsets so generated targets land in distinct nearby locations
        const lat = baseLat + (c.centroid_pc1 ?? 0) * 0.002 + idx * 0.001;
        const lng = baseLng + (c.centroid_pc2 ?? 0) * 0.002 + idx * 0.001;
        const score = Math.min(100, Math.max(20, 50 + (c.au_mean_gpt ?? 0) * 15));
        return {
          project_id: projectId,
          created_by: userId,
          code: `GCF-${ts.toString(36).slice(-4).toUpperCase()}-${c.cluster}`,
          name: `Cluster geoquímico #${c.cluster + 1} (${c.sample_count} muestras)`,
          target_type: "other",
          stage: "generated",
          priority: c.au_mean_gpt > 1 ? "high" : c.au_mean_gpt > 0.3 ? "medium" : "low",
          score,
          confidence_pct: Math.round((analysis.signature_confidence ?? 0.5) * 100),
          rationale: `Generado automáticamente desde Geochemical Fingerprint. Firma: ${analysis.signature ?? "n/d"}. Au promedio del cluster: ${c.au_mean_gpt.toFixed(3)} g/t.`,
          lat,
          lng,
          evidence: { source: "geochem_fingerprint", analysis_id: analysis.id, cluster: c.cluster, sample_ids: c.sample_ids },
        };
      });

    if (rows.length === 0) return { ok: false, error: "Ningún cluster con suficientes muestras" };

    const { error: insErr } = await supabase.from("exploration_targets").insert(rows);
    if (insErr) return { ok: false, error: insErr.message };
    return { ok: true, created: rows.length };
  }, [projectId]);

  return { latest, loading, running, error, refresh, run, generateTargets };
}
