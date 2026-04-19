import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type ProspectivityCell = {
  id: string;
  cell_lat: number;
  cell_lng: number;
  cell_size_m: number;
  score: number;
  features: Record<string, unknown>;
};

export type ProspectivityRun = {
  id: string;
  generated_at: string;
  cell_count: number;
  cell_size_m: number;
  notes: string | null;
};

export function useProspectivity(projectId: string | null) {
  const [latestRun, setLatestRun] = useState<ProspectivityRun | null>(null);
  const [cells, setCells] = useState<ProspectivityCell[]>([]);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const { data: runs } = await supabase
        .from("prospectivity_runs")
        .select("id,generated_at,cell_count,cell_size_m,notes")
        .eq("project_id", projectId)
        .order("generated_at", { ascending: false })
        .limit(1);
      const run = runs?.[0] ?? null;
      setLatestRun(run as ProspectivityRun | null);
      if (run) {
        const { data } = await supabase
          .from("prospectivity_cells")
          .select("id,cell_lat,cell_lng,cell_size_m,score,features")
          .eq("project_id", projectId)
          .eq("run_id", run.id)
          .order("score", { ascending: false })
          .limit(2000);
        setCells((data ?? []) as ProspectivityCell[]);
      } else {
        setCells([]);
      }
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { void reload(); }, [reload]);

  return { latestRun, cells, loading, reload };
}
