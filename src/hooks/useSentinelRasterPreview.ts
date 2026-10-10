import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import type { FeatureCollection } from "geojson";
import { getSentinelRasterPreview } from "@/lib/sentinelProcessing.functions";

/** Latest member-scoped display mesh from an actual Sentinel-2 processing run. */
export function useSentinelRasterPreview(projectId?: string) {
  const getPreview = useServerFn(getSentinelRasterPreview);
  return useQuery({
    queryKey: ["sentinel-real-preview", projectId],
    enabled: Boolean(projectId),
    queryFn: async () => {
      if (!projectId) return null;
      const result = await getPreview({ data: { projectId } });
      return result.preview as FeatureCollection | null;
    },
    staleTime: 60_000,
  });
}
