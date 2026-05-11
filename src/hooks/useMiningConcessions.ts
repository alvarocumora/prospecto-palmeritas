import { useCallback, useEffect, useState } from "react";
import { fetchMiningConcessions } from "@/services/miningConcessions.service";
export type { ExpiryStatus, MiningConcession } from "@/types/miningConcessions";
export { EXPIRY_COLORS, EXPIRY_LABELS, daysUntilExpiry, expiryStatus } from "@/lib/miningConcessions/expiry";
export { intersectsAoiBbox } from "@/lib/miningConcessions/geometry";
import type { MiningConcession } from "@/types/miningConcessions";

export function useMiningConcessions(projectId: string | null) {
  const [data, setData] = useState<MiningConcession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await fetchMiningConcessions(projectId);
      setData(rows);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error loading mining concessions");
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { data, loading, error, refresh };
}
