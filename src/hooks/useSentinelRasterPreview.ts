import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import type { FeatureCollection } from "geojson";
import { getSentinelRasterPreview } from "@/lib/sentinelProcessing.functions";
import { supabase } from "@/integrations/supabase/client";

/**
 * Latest member-scoped display mesh from an actual Sentinel-2 processing run.
 * Public visitors have no session: skip the private request and fall back to the
 * public bundle instead of producing 401s.
 */
export function useSentinelRasterPreview(projectId?: string) {
  const getPreview = useServerFn(getSentinelRasterPreview);
  return useQuery({
    queryKey: ["sentinel-real-preview", projectId],
    enabled: Boolean(projectId),
    queryFn: async (): Promise<FeatureCollection | null> => {
      if (!projectId) return null;
      const { data } = await supabase.auth.getSession();
      if (!data.session) return null;
      try {
        const result = await getPreview({ data: { projectId } });
        return (result?.preview as FeatureCollection | null) ?? null;
      } catch {
        return null;
      }
    },
    staleTime: 60_000,
    retry: false,
  });
}
