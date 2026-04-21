import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type OverlapType = "third_party" | "snaspe" | "indigenous" | "wetland" | "other";
export type OverlapSeverity = "info" | "warning" | "blocking";

export type ConcessionOverlap = {
  id: string;
  concession_id: string;
  project_id: string;
  overlap_type: OverlapType;
  overlap_with_id: string | null;
  overlap_with_name: string | null;
  area_overlap_ha: number | null;
  pct_overlap: number | null;
  severity: OverlapSeverity;
  detected_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
  notes: string | null;
  geometry_geojson: unknown | null;
  created_at: string;
  updated_at: string;
};

export const OVERLAP_TYPE_LABELS: Record<OverlapType, string> = {
  third_party: "Concesión de tercero",
  snaspe: "Área protegida (SNASPE)",
  indigenous: "Comunidad indígena",
  wetland: "Humedal / Sitio prioritario",
  other: "Otro",
};

export const OVERLAP_SEVERITY_COLORS: Record<OverlapSeverity, string> = {
  info: "#3b82f6",
  warning: "#f59e0b",
  blocking: "#dc2626",
};

export const OVERLAP_SEVERITY_LABELS: Record<OverlapSeverity, string> = {
  info: "Informativo",
  warning: "Advertencia",
  blocking: "Bloqueante",
};

export function useConcessionOverlaps(projectId: string | null) {
  const [data, setData] = useState<ConcessionOverlap[]>([]);
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
      .from("concession_overlaps")
      .select("*")
      .eq("project_id", projectId)
      .order("detected_at", { ascending: false });
    if (err) {
      setError(err.message);
      setData([]);
    } else {
      setData((rows ?? []) as unknown as ConcessionOverlap[]);
      setError(null);
    }
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { data, loading, error, refresh };
}
