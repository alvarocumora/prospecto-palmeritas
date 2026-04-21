import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type ConcessionHistoryEntry = {
  id: string;
  concession_id: string;
  project_id: string;
  source: string;
  snapshot: Record<string, unknown>;
  diff: Record<string, unknown> | null;
  synced_at: string;
};

export function useConcessionHistory(projectId: string | null) {
  const [data, setData] = useState<ConcessionHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!projectId) {
      setData([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data: rows } = await supabase
      .from("concession_history")
      .select("*")
      .eq("project_id", projectId)
      .order("synced_at", { ascending: false })
      .limit(200);
    setData((rows ?? []) as unknown as ConcessionHistoryEntry[]);
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { data, loading, refresh };
}
