import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type MiningBulletin = {
  id: string;
  source: string;
  publication_number: string | null;
  publication_date: string | null;
  publication_type: string;
  holder_name: string | null;
  holder_rut: string | null;
  concession_name: string | null;
  concession_code: string | null;
  region: string | null;
  provincia: string | null;
  comuna: string | null;
  area_ha: number | null;
  centroid_lat: number | null;
  centroid_lng: number | null;
  source_url: string | null;
  scraped_at: string;
};

export type BulletinAlert = {
  id: string;
  project_id: string;
  bulletin_id: string;
  match_type: "aoi" | "holder_rut" | "holder_name";
  match_detail: string | null;
  is_read: boolean;
  created_at: string;
  bulletin?: MiningBulletin;
};

export type WatchHolder = {
  id: string;
  project_id: string;
  holder_rut: string | null;
  holder_name: string | null;
  notes: string | null;
  created_at: string;
};

export function useMiningBulletins(limit = 100) {
  const [data, setData] = useState<MiningBulletin[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data: rows } = await supabase
      .from("mining_bulletins")
      .select("*")
      .order("publication_date", { ascending: false, nullsFirst: false })
      .order("scraped_at", { ascending: false })
      .limit(limit);
    setData((rows ?? []) as MiningBulletin[]);
    setLoading(false);
  }, [limit]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { data, loading, refresh };
}

export function useBulletinAlerts(projectId: string | null) {
  const [data, setData] = useState<BulletinAlert[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!projectId) {
      setData([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data: rows } = await supabase
      .from("bulletin_alerts")
      .select("*, bulletin:mining_bulletins(*)")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(200);
    setData((rows ?? []) as unknown as BulletinAlert[]);
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const markRead = useCallback(
    async (alertId: string) => {
      await supabase
        .from("bulletin_alerts")
        .update({
          is_read: true,
          read_at: new Date().toISOString(),
        })
        .eq("id", alertId);
      refresh();
    },
    [refresh],
  );

  return { data, loading, refresh, markRead };
}

export function useWatchHolders(projectId: string | null) {
  const [data, setData] = useState<WatchHolder[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!projectId) {
      setData([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data: rows } = await supabase
      .from("bulletin_watch_holders")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });
    setData((rows ?? []) as WatchHolder[]);
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { data, loading, refresh };
}

export type CourtCase = {
  id: string;
  source: string;
  case_number: string | null;
  court: string | null;
  jurisdiction: string | null;
  matter: string | null;
  plaintiff: string | null;
  defendant: string | null;
  defendant_rut: string | null;
  comuna: string | null;
  region: string | null;
  filed_at: string | null;
  last_movement_at: string | null;
  status: string | null;
  source_url: string | null;
  scraped_at: string;
};

export type CourtCaseAlert = {
  id: string;
  project_id: string;
  case_id: string;
  match_type: "defendant_rut" | "defendant_name";
  match_detail: string | null;
  is_read: boolean;
  created_at: string;
  case?: CourtCase;
};

export function useCourtCases(limit = 100) {
  const [data, setData] = useState<CourtCase[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data: rows } = await supabase
      .from("mining_court_cases")
      .select("*")
      .order("filed_at", { ascending: false, nullsFirst: false })
      .order("scraped_at", { ascending: false })
      .limit(limit);
    setData((rows ?? []) as CourtCase[]);
    setLoading(false);
  }, [limit]);

  useEffect(() => {
    refresh();
  }, [refresh]);
  return { data, loading, refresh };
}

export function useCourtCaseAlerts(projectId: string | null) {
  const [data, setData] = useState<CourtCaseAlert[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!projectId) {
      setData([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data: rows } = await supabase
      .from("court_case_alerts")
      .select("*, case:mining_court_cases(*)")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(200);
    setData((rows ?? []) as unknown as CourtCaseAlert[]);
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const markRead = useCallback(
    async (alertId: string) => {
      await supabase
        .from("court_case_alerts")
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq("id", alertId);
      refresh();
    },
    [refresh],
  );

  return { data, loading, refresh, markRead };
}

async function triggerHook(path: string) {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) return { success: false, error: "No session" };
  const res = await fetch(path, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: "{}",
  });
  return res.json();
}

/** Triggers a manual sync of the Boletín Minero via the server hook. */
export async function triggerBoletinSync(): Promise<{
  success: boolean;
  scraped?: number;
  inserted?: number;
  skipped?: number;
  alertsCreated?: number;
  error?: string;
}> {
  return triggerHook("/hooks/sync-boletin-minero");
}

/** Triggers a manual sync of PJUD mining court cases via the server hook. */
export async function triggerPjudSync(): Promise<{
  success: boolean;
  scraped?: number;
  inserted?: number;
  skipped?: number;
  alertsCreated?: number;
  error?: string;
}> {
  return triggerHook("/hooks/sync-pjud");
}
