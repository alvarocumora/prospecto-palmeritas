import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type WatchType = "holder" | "code" | "region" | "court_keyword";

export type BulletinWatch = {
  id: string;
  project_id: string;
  created_by: string;
  watch_type: WatchType;
  value: string;
  label: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export const WATCH_TYPE_LABELS: Record<WatchType, string> = {
  holder: "Titular (RUT/nombre)",
  code: "Código de concesión",
  region: "Región / Comuna",
  court_keyword: "Causa judicial (keyword)",
};

export function useBulletinWatches(projectId: string | null) {
  const [data, setData] = useState<BulletinWatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!projectId) {
      setData([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data: rows, error: err } = await supabase
      .from("bulletin_watches")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });
    if (err) {
      setError(err.message);
      setData([]);
    } else {
      setData((rows ?? []) as unknown as BulletinWatch[]);
      setError(null);
    }
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { data, loading, error, refresh };
}
