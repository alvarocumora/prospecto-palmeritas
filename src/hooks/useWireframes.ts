// Hook para listar/borrar wireframes RBF persistidos.
// La creación pasa por el server fn `saveWireframe` (incluye llamada a Railway).
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type Wireframe = {
  id: string;
  project_id: string;
  name: string;
  commodity: string | null;
  iso: number;
  smooth: number;
  grid_n: number;
  pad: number;
  samples_used: number | null;
  volume_m3: number | null;
  vertices: number[][];
  faces: number[][];
  bbox: { min: number[]; max: number[] } | null;
  origin_lng: number | null;
  origin_lat: number | null;
  created_by: string;
  created_at: string;
};

export function useWireframes(projectId: string | null) {
  const [data, setData] = useState<Wireframe[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!projectId) {
      setData([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data: rows, error } = await supabase
      .from("geology_wireframes")
      .select(
        "id,project_id,name,commodity,iso,smooth,grid_n,pad,samples_used,volume_m3,vertices,faces,bbox,origin_lng,origin_lat,created_by,created_at",
      )
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setData((rows ?? []) as unknown as Wireframe[]);
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const remove = useCallback(
    async (id: string) => {
      const { error } = await supabase.from("geology_wireframes").delete().eq("id", id);
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Wireframe eliminado");
      await refresh();
    },
    [refresh],
  );

  return { data, loading, refresh, remove };
}
