import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Counts unread bulletin + court-case alerts for the active project.
 * Used to show a badge next to the "Boletín Minero" sidebar entry.
 */
export function useUnreadCatastroAlerts(projectId: string | null) {
  const [bulletinUnread, setBulletinUnread] = useState(0);
  const [courtUnread, setCourtUnread] = useState(0);

  const refresh = useCallback(async () => {
    if (!projectId) {
      setBulletinUnread(0);
      setCourtUnread(0);
      return;
    }
    const [{ count: bCount }, { count: cCount }] = await Promise.all([
      supabase
        .from("bulletin_alerts")
        .select("id", { count: "exact", head: true })
        .eq("project_id", projectId)
        .eq("is_read", false),
      supabase
        .from("court_case_alerts")
        .select("id", { count: "exact", head: true })
        .eq("project_id", projectId)
        .eq("is_read", false),
    ]);
    setBulletinUnread(bCount ?? 0);
    setCourtUnread(cCount ?? 0);
  }, [projectId]);

  useEffect(() => {
    refresh();
    if (!projectId) return;

    // Realtime: refresh when alerts change for this project.
    // Unique suffix avoids reusing a cached subscribed channel in StrictMode/re-mounts.
    const channel = supabase
      .channel(`catastro-alerts-${projectId}-${Math.random().toString(36).slice(2, 10)}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "bulletin_alerts",
          filter: `project_id=eq.${projectId}`,
        },
        () => refresh(),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "court_case_alerts",
          filter: `project_id=eq.${projectId}`,
        },
        () => refresh(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId, refresh]);

  return {
    bulletinUnread,
    courtUnread,
    total: bulletinUnread + courtUnread,
    refresh,
  };
}
