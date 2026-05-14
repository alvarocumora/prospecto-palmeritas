import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type StockpileVolume = Database["public"]["Tables"]["stockpile_volumes"]["Row"];

export function useStockpileVolumes(projectId: string | null) {
  const [items, setItems] = useState<StockpileVolume[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!projectId) { setItems([]); return; }
    setLoading(true);
    const { data } = await supabase
      .from("stockpile_volumes")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(200);
    setItems(data ?? []);
    setLoading(false);
  }, [projectId]);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    if (!projectId) return;
    const ch = supabase
      .channel(`stockpiles-${projectId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "stockpile_volumes", filter: `project_id=eq.${projectId}` },
        () => refresh(),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [projectId, refresh]);

  return { items, loading, refresh };
}
