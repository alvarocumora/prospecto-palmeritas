import { useQuery } from "@tanstack/react-query";
import type { Geometry } from "geojson";
import { supabase } from "@/integrations/supabase/client";

export type LithologyMapUnit = {
  id: string;
  unit_code: string;
  name: string;
  rock_type: string | null;
  formation: string | null;
  age: string | null;
  color_hex: string | null;
};

export type AlterationMapUnit = {
  id: string;
  zone_code: string;
  name: string;
  assemblage: string | null;
  intensity: string | null;
  color_hex: string | null;
};

export type GeologicalFeatureRow = {
  id: string;
  feature_code: string;
  name: string;
  feature_type: string;
  geometry_geojson: Geometry | null;
  lithology_id: string | null;
  alteration_id: string | null;
  strike: string | null;
  dip: string | null;
  length_m: number | null;
  width_m: number | null;
  description: string | null;
};

export type ProjectGeologyMapData = {
  lithology: LithologyMapUnit[];
  alteration: AlterationMapUnit[];
  features: GeologicalFeatureRow[];
};

async function fetchProjectGeologyMap(projectId: string): Promise<ProjectGeologyMapData> {
  const [litho, alt, feats] = await Promise.all([
    supabase
      .from("lithology_units")
      .select("id,unit_code,name,rock_type,formation,age,color_hex")
      .or(`project_id.eq.${projectId},project_id.is.null`)
      .order("display_order"),
    supabase
      .from("alteration_zones")
      .select("id,zone_code,name,assemblage,intensity,color_hex")
      .or(`project_id.eq.${projectId},project_id.is.null`)
      .order("display_order"),
    supabase
      .from("geological_features")
      .select(
        "id,feature_code,name,feature_type,geometry_geojson,lithology_id,alteration_id,strike,dip,length_m,width_m,description",
      )
      .eq("project_id", projectId),
  ]);

  const err = litho.error || alt.error || feats.error;
  if (err) throw err;

  return {
    lithology: (litho.data ?? []) as LithologyMapUnit[],
    alteration: (alt.data ?? []) as AlterationMapUnit[],
    features: (feats.data ?? []) as unknown as GeologicalFeatureRow[],
  };
}

export function useProjectGeologyMap(projectId: string | null) {
  return useQuery({
    queryKey: ["project-geology-map", projectId],
    queryFn: () => fetchProjectGeologyMap(projectId!),
    enabled: !!projectId,
    staleTime: 1000 * 60 * 5,
  });
}
