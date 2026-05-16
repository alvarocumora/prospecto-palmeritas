import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type ConcessionAlert = {
  id: string;
  project_id: string;
  concession_id: string | null;
  holder_id: string | null;
  alert_type: string;
  severity: "info" | "warning" | "critical";
  title: string;
  message: string | null;
  payload: unknown;
  is_read: boolean;
  read_at: string | null;
  acknowledged: boolean;
  created_at: string;
};

export const SEVERITY_LABEL: Record<string, string> = {
  info: "Info",
  warning: "Atención",
  critical: "Crítico",
};

export const ALERT_TYPE_LABEL: Record<string, string> = {
  concession_changed: "Cambio detectado",
  concession_missing: "Desaparecida del catastro",
  expiring_soon: "Próxima a vencer",
  new_neighbor: "Nueva concesión vecina",
  sync_error: "Error de sincronización",
};

export function useConcessionAlerts(projectId: string | null) {
  const [alerts, setAlerts] = useState<ConcessionAlert[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!projectId) {
      setAlerts([]);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("concession_alerts")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (!error) setAlerts((data ?? []) as ConcessionAlert[]);
    setLoading(false);
  }, [projectId]);

  const markRead = useCallback(async (id: string) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    await supabase
      .from("concession_alerts")
      .update({ is_read: true, read_at: new Date().toISOString(), read_by: user?.id })
      .eq("id", id);
    setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, is_read: true } : a)));
  }, []);

  const markAllRead = useCallback(async () => {
    if (!projectId) return;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    await supabase
      .from("concession_alerts")
      .update({ is_read: true, read_at: new Date().toISOString(), read_by: user?.id })
      .eq("project_id", projectId)
      .eq("is_read", false);
    setAlerts((prev) => prev.map((a) => ({ ...a, is_read: true })));
  }, [projectId]);

  const triggerSync = useCallback(async () => {
    if (!projectId) return null;
    const { data, error } = await supabase.functions.invoke("sync-catastro", {
      body: { projectId },
    });
    if (error) throw error;
    await refresh();
    return data;
  }, [projectId, refresh]);

  useEffect(() => {
    refresh();
    if (!projectId) return;
    const channel = supabase
      .channel(`concession-alerts-${projectId}-${Math.random().toString(36).slice(2, 8)}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "concession_alerts",
          filter: `project_id=eq.${projectId}`,
        },
        () => refresh(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId, refresh]);

  const unreadCount = alerts.filter((a) => !a.is_read).length;
  const criticalCount = alerts.filter((a) => !a.is_read && a.severity === "critical").length;

  return {
    alerts,
    loading,
    unreadCount,
    criticalCount,
    refresh,
    markRead,
    markAllRead,
    triggerSync,
  };
}
