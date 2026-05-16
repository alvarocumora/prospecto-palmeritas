import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useProjects } from "./useProjects";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

export type ResourceMethod = "idw" | "ok" | "nn";
export type Commodity = "au" | "ag" | "cu" | "zn" | "pb" | "mo" | "fe" | "li" | "other";

export interface ResourceModel {
  id: string;
  project_id: string;
  campaign_id: string | null;
  name: string;
  commodity: Commodity;
  method: ResourceMethod;
  cutoff_grade: number | null;
  density_t_m3: number;
  block_size_x: number;
  block_size_y: number;
  block_size_z: number;
  search_radius: number;
  min_samples: number;
  max_samples: number;
  power: number;
  composite_length: number;
  bbox_min_x: number | null;
  bbox_max_x: number | null;
  bbox_min_y: number | null;
  bbox_max_y: number | null;
  bbox_min_z: number | null;
  bbox_max_z: number | null;
  blocks_total: number;
  blocks_estimated: number;
  composites_count: number;
  tonnage_total: number | null;
  tonnage_above_cutoff: number | null;
  mean_grade: number | null;
  metal_content: number | null;
  status: "draft" | "running" | "complete" | "failed" | "archived";
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  estimated_at: string | null;
}

export interface ResourceBlock {
  id: string;
  model_id: string;
  ix: number;
  iy: number;
  iz: number;
  x: number;
  y: number;
  z: number;
  grade: number | null;
  variance: number | null;
  n_samples: number;
  nearest_dist: number | null;
  classification: "measured" | "indicated" | "inferred" | null;
}

export function useResourceModels() {
  const { active } = useProjects();
  const { user } = useAuth();
  const [models, setModels] = useState<ResourceModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    if (!active?.id) {
      setModels([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("resource_models")
      .select("*")
      .eq("project_id", active.id)
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setModels((data ?? []) as ResourceModel[]);
    setLoading(false);
  }, [active?.id]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const create = useCallback(
    async (input: Partial<ResourceModel> & { name: string }) => {
      if (!active?.id || !user) throw new Error("Sin proyecto activo");
      const { data, error } = await supabase
        .from("resource_models")
        .insert({
          project_id: active.id,
          created_by: user.id,
          name: input.name,
          campaign_id: input.campaign_id ?? null,
          commodity: input.commodity ?? "au",
          method: input.method ?? "idw",
          cutoff_grade: input.cutoff_grade ?? null,
          density_t_m3: input.density_t_m3 ?? 2.7,
          block_size_x: input.block_size_x ?? 10,
          block_size_y: input.block_size_y ?? 10,
          block_size_z: input.block_size_z ?? 5,
          search_radius: input.search_radius ?? 50,
          min_samples: input.min_samples ?? 2,
          max_samples: input.max_samples ?? 12,
          power: input.power ?? 2,
          composite_length: input.composite_length ?? 2,
          notes: input.notes ?? null,
        })
        .select()
        .single();
      if (error) {
        toast.error(error.message);
        throw error;
      }
      toast.success("Modelo creado");
      await fetchAll();
      return data as ResourceModel;
    },
    [active?.id, user, fetchAll],
  );

  const remove = useCallback(
    async (id: string) => {
      const { error } = await supabase.from("resource_models").delete().eq("id", id);
      if (error) {
        toast.error(error.message);
        throw error;
      }
      toast.success("Modelo eliminado");
      await fetchAll();
    },
    [fetchAll],
  );

  const estimate = useCallback(
    async (modelId: string) => {
      setRunning(modelId);
      try {
        const { data, error } = await supabase.functions.invoke("estimate-resources", {
          body: { model_id: modelId },
        });
        if (error) throw error;
        if (!data?.ok) throw new Error(data?.error ?? "Error en estimación");
        toast.success(`Estimación completa: ${data.blocks_estimated}/${data.blocks_total} bloques`);
        await fetchAll();
        return data;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Error";
        toast.error(msg);
        throw e;
      } finally {
        setRunning(null);
      }
    },
    [fetchAll],
  );

  const fetchBlocks = useCallback(async (modelId: string): Promise<ResourceBlock[]> => {
    const { data, error } = await supabase
      .from("resource_blocks")
      .select("*")
      .eq("model_id", modelId)
      .limit(10000);
    if (error) {
      toast.error(error.message);
      return [];
    }
    return (data ?? []) as ResourceBlock[];
  }, []);

  return { models, loading, running, refresh: fetchAll, create, remove, estimate, fetchBlocks };
}
