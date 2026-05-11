import { useEffect, useState } from "react";
import { fetchGeophysicsData } from "@/services/geophysics.service";
export type { GeophysicsData, GeophysicsLine, GeophysicsStation, GeophysicsSurvey } from "@/types/geophysics";
import type { GeophysicsData } from "@/types/geophysics";

/**
 * Loads geophysics data, optionally scoped to a project.
 * When projectId is provided, only rows belonging to that project (or with null project_id) are returned.
 */
export function useGeophysicsData(projectId?: string | null) {
  const [data, setData] = useState<GeophysicsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    fetchGeophysicsData(projectId)
      .then((geophysicsData) => {
        if (!cancelled) setData(geophysicsData);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Error loading geophysics");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  return { data, loading, error };
}
