import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type HyperspectralProduct = Database["public"]["Tables"]["hyperspectral_products"]["Row"];

export function useHyperspectralProducts(projectId: string | null) {
  const [products, setProducts] = useState<HyperspectralProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!projectId) {
      setProducts([]);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("hyperspectral_products")
      .select("*")
      .eq("project_id", projectId)
      .order("acquisition_date", { ascending: false })
      .limit(200);
    if (error) setError(error.message);
    else {
      setProducts(data ?? []);
      setError(null);
    }
    setLoading(false);
  }, [projectId]);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    if (!projectId) return;
    const ch = supabase
      .channel(`hyperspectral-${projectId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "hyperspectral_products", filter: `project_id=eq.${projectId}` },
        () => refresh(),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [projectId, refresh]);

  return { products, loading, error, refresh };
}
