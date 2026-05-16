import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ConcessionRow = {
  id: string;
  code: string;
  name: string;
  holder: string | null;
  concession_type: string;
  status: string;
  area_ha: number | null;
  geometry_geojson: GeoJSON.Geometry | null;
};

export function useProjectMiningConcessions(projectId: string | null) {
  return useQuery({
    queryKey: ["mining_concessions", projectId],
    enabled: !!projectId,
    queryFn: async (): Promise<ConcessionRow[]> => {
      const { data, error } = await supabase
        .from("mining_concessions")
        .select("id, code, name, holder, concession_type, status, area_ha, geometry_geojson")
        .eq("project_id", projectId!)
        .order("code", { ascending: true });
      if (error) throw new Error(error.message);
      return (data ?? []) as ConcessionRow[];
    },
  });
}
