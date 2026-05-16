import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type InsarPoint = Database["public"]["Tables"]["insar_displacement"]["Row"];

export function useInsarDisplacement(projectId: string | null) {
  const [points, setPoints] = useState<InsarPoint[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!projectId) {
      setPoints([]);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("insar_displacement")
      .select("*")
      .eq("project_id", projectId)
      .order("velocity_mm_year", { ascending: true })
      .limit(500);
    setPoints(data ?? []);
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!projectId) return;
    const ch = supabase
      .channel(`insar-${projectId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "insar_displacement",
          filter: `project_id=eq.${projectId}`,
        },
        () => refresh(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [projectId, refresh]);

  return { points, loading, refresh };
}
