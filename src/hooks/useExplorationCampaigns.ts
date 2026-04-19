import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type ExplorationCampaign = {
  id: string;
  project_id: string;
  name: string;
  phase: string;
  status: string;
  started_at: string | null;
  ended_at: string | null;
  aoi_geojson: unknown;
  lead_user_id: string | null;
  notes: string | null;
  created_at: string;
};

export const PHASE_LABELS: Record<string, string> = {
  recon: "Reconocimiento",
  scoping: "Scoping",
  pea: "PEA",
  pfs: "PFS",
  fs: "FS",
};

export function useExplorationCampaigns(projectId: string | null) {
  const [data, setData] = useState<ExplorationCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!projectId) { setData([]); setLoading(false); return; }
    setLoading(true);
    const { data: rows, error: err } = await supabase
      .from("exploration_campaigns")
      .select("*")
      .eq("project_id", projectId)
      .order("started_at", { ascending: false, nullsFirst: false });
    if (err) { setError(err.message); setData([]); }
    else { setData((rows ?? []) as ExplorationCampaign[]); setError(null); }
    setLoading(false);
  }, [projectId]);

  useEffect(() => { refresh(); }, [refresh]);

  return { data, loading, error, refresh };
}
