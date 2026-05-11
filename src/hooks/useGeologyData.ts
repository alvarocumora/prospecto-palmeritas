import { useQuery } from "@tanstack/react-query";
import { fetchGeologyData } from "@/services/geology.service";

export type LithologyUnit = {
  id: string;
  unit_code: string;
  name: string;
  age: string | null;
  formation: string | null;
  rock_type: string | null;
  description: string | null;
  color_hex: string | null;
  display_order: number;
  source: string | null;
};

export type AlterationZone = {
  id: string;
  zone_code: string;
  name: string;
  assemblage: string | null;
  intensity: string | null;
  description: string | null;
  color_hex: string | null;
  display_order: number;
  source: string | null;
};

export type Mineral = {
  id: string;
  mineral: string;
  formula: string | null;
  category: string | null;
  paragenetic_stage: string | null;
  abundance: string | null;
  display_order: number;
  source: string | null;
};

export type GeologicalFeature = {
  id: string;
  feature_code: string;
  name: string;
  feature_type: string;
  strike: string | null;
  dip: string | null;
  length_m: number | null;
  width_m: number | null;
  description: string | null;
  source: string | null;
};

export type GeoReference = {
  id: string;
  citation_key: string;
  title: string;
  authors: string | null;
  year: number | null;
  publisher: string | null;
  doi: string | null;
  url: string | null;
};

export type GeologyData = {
  litho: LithologyUnit[];
  alteration: AlterationZone[];
  minerals: Mineral[];
  features: GeologicalFeature[];
  references: GeoReference[];
};

function getErrorMessage(error: unknown) {
  if (!error) return null;
  return error instanceof Error ? error.message : "Error loading geology data";
}

export function useGeologyData() {
  const query = useQuery({
    queryKey: ["geology-data"],
    queryFn: fetchGeologyData,
    staleTime: 1000 * 60 * 10,
  });

  return {
    data: query.data ?? null,
    loading: query.isLoading,
    error: getErrorMessage(query.error),
  };
}
