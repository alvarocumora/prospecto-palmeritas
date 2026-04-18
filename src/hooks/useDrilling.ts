import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type DrillHole = {
  id: string;
  project_id: string | null;
  hole_id: string;
  status: string;
  target_zone: string | null;
  easting: number | null;
  northing: number | null;
  elevation: number | null;
  azimuth: number | null;
  dip: number | null;
  planned_depth: number | null;
  actual_depth: number | null;
  started_at: string | null;
  completed_at: string | null;
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type DrillCoreLog = {
  id: string;
  project_id: string | null;
  hole_id: string;
  depth_from: number;
  depth_to: number;
  lithology: string | null;
  alteration: string | null;
  mineralization: string | null;
  structure: string | null;
  rqd_pct: number | null;
  recovery_pct: number | null;
  vein_pct: number | null;
  sulfide_pct: number | null;
  au_gpt: number | null;
  cu_pct: number | null;
  ag_gpt: number | null;
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export const HOLE_STATUSES = ["proposed", "in_progress", "completed", "abandoned"] as const;
export type HoleStatus = (typeof HOLE_STATUSES)[number];

export const STATUS_LABELS: Record<string, string> = {
  proposed: "Propuesto",
  in_progress: "En curso",
  completed: "Completado",
  abandoned: "Abandonado",
};

export const STATUS_COLORS: Record<string, string> = {
  proposed: "#64748b",
  in_progress: "#f59e0b",
  completed: "#0d9488",
  abandoned: "#dc2626",
};

export function progressPct(h: DrillHole): number {
  if (!h.planned_depth || h.planned_depth <= 0) return 0;
  const actual = h.actual_depth ?? 0;
  return Math.min(100, Math.round((actual / h.planned_depth) * 100));
}

export function useDrillHoles(projectId: string | null) {
  const [data, setData] = useState<DrillHole[]>([]);
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
      .from("drill_holes")
      .select("*")
      .eq("project_id", projectId)
      .order("hole_id", { ascending: true });
    if (err) {
      setError(err.message);
      setData([]);
    } else {
      setData((rows ?? []) as DrillHole[]);
      setError(null);
    }
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { data, loading, error, refresh };
}

export function useDrillCoreLogs(holeId: string | null) {
  const [data, setData] = useState<DrillCoreLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!holeId) {
      setData([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data: rows, error: err } = await supabase
      .from("drill_core_logs")
      .select("*")
      .eq("hole_id", holeId)
      .order("depth_from", { ascending: true });
    if (err) {
      setError(err.message);
      setData([]);
    } else {
      setData((rows ?? []) as DrillCoreLog[]);
      setError(null);
    }
    setLoading(false);
  }, [holeId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { data, loading, error, refresh };
}
