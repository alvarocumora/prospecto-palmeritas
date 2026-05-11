import { useQuery } from "@tanstack/react-query";
import { fetchGeologyData } from "@/services/geology.service";
export type {
  AlterationZone,
  GeologicalFeature,
  GeologyData,
  GeoReference,
  LithologyUnit,
  Mineral,
} from "@/types/geology";

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
