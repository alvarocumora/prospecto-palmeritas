import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type ConcessionFieldChange = {
  id: string;
  concession_id: string;
  project_id: string;
  field: "holder" | "area_ha" | "status";
  old_value: string | null;
  new_value: string | null;
  source: string;
  changed_by: string | null;
  changed_at: string;
};

export type ConcessionChangeSummary = {
  concession_id: string;
  project_id: string;
  code: string | null;
  name: string | null;
  total_changes: number;
  holder_changes: number;
  area_changes: number;
  status_changes: number;
  last_changed_at: string | null;
  last_synced_at: string | null;
};

/** Resumen por concesión (totales + último cambio) para todo el proyecto. */
export function useConcessionChangeSummary(projectId: string | null) {
  const [data, setData] = useState<ConcessionChangeSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!projectId) {
      setData([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data: rows } = await supabase
      .from("concession_change_summary" as never)
      .select("*")
      .eq("project_id", projectId)
      .order("last_changed_at", { ascending: false, nullsFirst: false });
    setData((rows ?? []) as unknown as ConcessionChangeSummary[]);
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Realtime: refrescar cuando llegue un cambio en este proyecto
  useEffect(() => {
    if (!projectId) return;
    const ch = supabase
      .channel(`ccf-summary-${projectId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "concession_field_changes",
          filter: `project_id=eq.${projectId}`,
        },
        () => refresh(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [projectId, refresh]);

  return { data, loading, refresh };
}

/** Historial detallado de una concesión específica (todas sus filas en orden cronológico inverso). */
export function useConcessionChangeHistory(concessionId: string | null) {
  const [data, setData] = useState<ConcessionFieldChange[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!concessionId) {
      setData([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data: rows, error } = await supabase.rpc("get_concession_change_history", {
      _concession_id: concessionId,
      _limit: 200,
    });
    if (error) console.error("[useConcessionChangeHistory]", error);
    setData(
      ((rows ?? []) as ConcessionFieldChange[]).map((r) => ({
        ...r,
        concession_id: concessionId,
        project_id: "",
      })),
    );
    setLoading(false);
  }, [concessionId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!concessionId) return;
    const ch = supabase
      .channel(`ccf-${concessionId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "concession_field_changes",
          filter: `concession_id=eq.${concessionId}`,
        },
        () => refresh(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [concessionId, refresh]);

  return { data, loading, refresh };
}
