import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getTargetSatelliteSummaries, type TargetSatelliteSummary } from "@/lib/satelliteIntel.functions";

export type { TargetSatelliteSummary };

export function useTargetSatelliteSummaries(projectId: string | null | undefined) {
  const fn = useServerFn(getTargetSatelliteSummaries);
  return useQuery({
    queryKey: ["target-sat-summaries", projectId],
    queryFn: async () => {
      if (!projectId) return { summaries: [] as TargetSatelliteSummary[], generatedAt: new Date().toISOString() };
      return fn({ data: { projectId } });
    },
    enabled: !!projectId,
    staleTime: 60_000,
  });
}
