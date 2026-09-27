import { useQuery } from "@tanstack/react-query";
import { fetchGeophysicsData } from "@/services/geophysics.service";

/**
 * Project-scoped geophysics query.
 *
 * Unlike useGeophysicsData(), this hook never falls back to the global dataset
 * while the project id is unresolved. This prevents one project's stations
 * from appearing in another project's evidence viewer.
 */
export function useProjectGeophysicsData(projectId: string | null | undefined) {
  const query = useQuery({
    queryKey: ["project-geophysics-data", projectId ?? null],
    queryFn: () => fetchGeophysicsData(projectId as string),
    enabled: Boolean(projectId),
    staleTime: 1000 * 60 * 10,
  });

  return {
    data: query.data ?? null,
    loading: Boolean(projectId) && query.isLoading,
    error: query.error instanceof Error ? query.error.message : null,
  };
}
