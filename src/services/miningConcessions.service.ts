import { supabase } from "@/integrations/supabase/client";
import type { MiningConcession } from "@/types/miningConcessions";

export async function fetchMiningConcessions(projectId: string | null): Promise<MiningConcession[]> {
  if (!projectId) return [];

  const { data, error } = await supabase
    .from("mining_concessions")
    .select("*")
    .eq("project_id", projectId)
    .order("expires_at", { ascending: true, nullsFirst: false });

  if (error) throw error;

  return (data ?? []) as unknown as MiningConcession[];
}
