import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type SatIndexCode =
  "IRON_OXIDE" | "CLAY_MINERALS" | "HYDROTHERMAL_ALTERATION" | "STRUCTURAL_LINEAMENTS";

export type AnomalyRow = {
  id: string;
  run_id: string;
  index_code: SatIndexCode;
  geometry: GeoJSON.Geometry;
  severity: "low" | "medium" | "high";
  score: number;
  area_ha: number | null;
  notes: string | null;
  detected_at: string;
};

export type AnomaliesByIndex = Record<SatIndexCode, AnomalyRow[]>;

export const SAT_INDEX_CODES: SatIndexCode[] = [
  "IRON_OXIDE",
  "CLAY_MINERALS",
  "HYDROTHERMAL_ALTERATION",
  "STRUCTURAL_LINEAMENTS",
];

export function useProjectSatelliteAnomalies(projectId: string | null) {
  return useQuery({
    queryKey: ["satellite_anomalies", projectId],
    enabled: !!projectId,
    queryFn: async (): Promise<AnomaliesByIndex> => {
      const { data, error } = await supabase
        .from("satellite_anomalies")
        .select("id, run_id, index_code, geometry, severity, score, area_ha, notes, detected_at")
        .eq("project_id", projectId!)
        .order("detected_at", { ascending: false });
      if (error) throw new Error(error.message);

      const grouped: AnomaliesByIndex = {
        IRON_OXIDE: [],
        CLAY_MINERALS: [],
        HYDROTHERMAL_ALTERATION: [],
        STRUCTURAL_LINEAMENTS: [],
      };
      for (const row of (data ?? []) as unknown as AnomalyRow[]) {
        if (grouped[row.index_code]) grouped[row.index_code].push(row);
      }
      return grouped;
    },
  });
}
