import { useQuery } from "@tanstack/react-query";
import { fetchMiningConcessions } from "@/services/miningConcessions.service";
export type { ExpiryStatus, MiningConcession } from "@/types/miningConcessions";
export {
  EXPIRY_COLORS,
  EXPIRY_LABELS,
  daysUntilExpiry,
  expiryStatus,
} from "@/lib/miningConcessions/expiry";
export { intersectsAoiBbox } from "@/lib/miningConcessions/geometry";

function toErrorMessage(error: unknown) {
  if (!error) return null;
  return error instanceof Error ? error.message : "Error loading mining concessions";
}

export function useMiningConcessions(projectId: string | null) {
  const query = useQuery({
    queryKey: ["mining-concessions", projectId],
    queryFn: () => fetchMiningConcessions(projectId),
    staleTime: 1000 * 60 * 10,
  });

  return {
    data: query.data ?? [],
    loading: query.isLoading,
    error: toErrorMessage(query.error),
    refresh: query.refetch,
  };
}
