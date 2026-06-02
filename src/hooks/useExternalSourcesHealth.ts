import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type SourceHealth = {
  id: string;
  label: string;
  kind: "primary" | "fallback";
  ok: boolean;
  status?: number;
  total?: number | null;
  latencyMs: number;
  error?: string;
};

export type ExternalSourcesHealth = {
  checked_at: string;
  overall: "healthy" | "degraded" | "down";
  sources: SourceHealth[];
};

/** Phase D — calls the `external-sources-health` edge function. Cached 60s. */
export function useExternalSourcesHealth() {
  return useQuery({
    queryKey: ["external-sources-health"],
    refetchInterval: 60_000,
    staleTime: 30_000,
    queryFn: async (): Promise<ExternalSourcesHealth> => {
      const { data, error } = await supabase.functions.invoke("external-sources-health");
      if (error) throw error;
      return data as ExternalSourcesHealth;
    },
  });
}
