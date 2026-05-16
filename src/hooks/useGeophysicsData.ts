import { useQuery } from "@tanstack/react-query";
import { fetchGeophysicsData } from "@/services/geophysics.service";
export type {
  GeophysicsData,
  GeophysicsLine,
  GeophysicsStation,
  GeophysicsSurvey,
} from "@/types/geophysics";

function toErrorMessage(error: unknown) {
  if (!error) return null;
  return error instanceof Error ? error.message : "Error loading geophysics";
}

export function useGeophysicsData(projectId?: string | null) {
  const query = useQuery({
    queryKey: ["geophysics-data", projectId ?? null],
    queryFn: () => fetchGeophysicsData(projectId),
    staleTime: 1000 * 60 * 10,
  });

  return {
    data: query.data ?? null,
    loading: query.isLoading,
    error: toErrorMessage(query.error),
  };
}
