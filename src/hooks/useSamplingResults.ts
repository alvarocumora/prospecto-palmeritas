import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type SamplingResult = {
  id: string;
  project_id: string | null;
  sample_code: string;
  sample_type: string;
  zone: string | null;
  au_gpt: number | null;
  ag_gpt: number | null;
  cu_pct: number | null;
  as_ppm: number | null;
  sb_ppm: number | null;
  hg_ppm: number | null;
  pb_ppm: number | null;
  zn_ppm: number | null;
  mo_ppm: number | null;
  certificate: string | null;
  lab: string | null;
  notes: string | null;
  sampled_at: string | null;
  created_at: string;
  record_status: string;
  approved_by: string | null;
  approved_at: string | null;
};

export function useSamplingResults(projectId: string | null) {
  const [data, setData] = useState<SamplingResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!projectId) {
      setData([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data: rows, error: err } = await supabase
      .from("sampling_results")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(2000);
    if (err) {
      setError(err.message);
      setData([]);
    } else {
      setData((rows ?? []) as SamplingResult[]);
      setError(null);
    }
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { data, loading, error, refresh };
}
