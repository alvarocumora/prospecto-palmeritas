import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { DrillCoreLog } from "@/hooks/useDrilling";

/** Fetches all drill_core_logs for a project, grouped by hole_id (uuid). */
export function useProjectCoreLogs(projectId: string | null) {
  const [byHole, setByHole] = useState<Record<string, DrillCoreLog[]>>({});
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!projectId) {
      setByHole({});
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("drill_core_logs")
      .select("*")
      .eq("project_id", projectId)
      .order("depth_from", { ascending: true });
    if (error || !data) {
      setByHole({});
    } else {
      const grouped: Record<string, DrillCoreLog[]> = {};
      for (const row of data as DrillCoreLog[]) {
        (grouped[row.hole_id] ??= []).push(row);
      }
      setByHole(grouped);
    }
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { byHole, loading, refresh };
}
