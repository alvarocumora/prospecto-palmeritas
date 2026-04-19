// Sprint 6.4/6.5 — hook unificado para listar/disparar DEM diffs y stockpile volumes.
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type DemDiff = {
  id: string;
  project_id: string;
  name: string;
  raster_before_id: string;
  raster_after_id: string;
  bbox_geojson: unknown;
  pixel_size_m: number | null;
  fill_volume_m3: number | null;
  cut_volume_m3: number | null;
  net_volume_m3: number | null;
  cells_analyzed: number | null;
  diff_min_m: number | null;
  diff_max_m: number | null;
  diff_mean_m: number | null;
  notes: string | null;
  created_at: string;
};

export type StockpileVolume = {
  id: string;
  project_id: string;
  raster_id: string;
  name: string;
  material: string | null;
  polygon_geojson: GeoJSON.Polygon;
  base_method: string;
  base_elevation_m: number | null;
  volume_m3: number | null;
  area_m2: number | null;
  mean_height_m: number | null;
  max_height_m: number | null;
  cells_analyzed: number | null;
  pixel_size_m: number | null;
  notes: string | null;
  created_at: string;
};

export function useDroneAnalysis(projectId: string | null) {
  const [diffs, setDiffs] = useState<DemDiff[]>([]);
  const [stockpiles, setStockpiles] = useState<StockpileVolume[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!projectId) { setDiffs([]); setStockpiles([]); setLoading(false); return; }
    setLoading(true);
    const [d, s] = await Promise.all([
      supabase.from("dem_diffs").select("*").eq("project_id", projectId).order("created_at", { ascending: false }),
      supabase.from("stockpile_volumes").select("*").eq("project_id", projectId).order("created_at", { ascending: false }),
    ]);
    setDiffs((d.data ?? []) as unknown as DemDiff[]);
    setStockpiles((s.data ?? []) as unknown as StockpileVolume[]);
    setLoading(false);
  }, [projectId]);

  useEffect(() => { refresh(); }, [refresh]);

  return { diffs, stockpiles, loading, refresh };
}

export async function runDemDiff(opts: {
  projectId: string;
  userId: string;
  name: string;
  rasterBeforeId: string;
  rasterAfterId: string;
  notes?: string;
}): Promise<{ data: DemDiff | null; error: string | null }> {
  const { data, error } = await supabase.functions.invoke("dem-diff", {
    body: {
      projectId: opts.projectId,
      name: opts.name,
      rasterBeforeId: opts.rasterBeforeId,
      rasterAfterId: opts.rasterAfterId,
      notes: opts.notes,
    },
    headers: { "x-user-id": opts.userId },
  });
  if (error) return { data: null, error: error.message };
  if ((data as { error?: string })?.error) return { data: null, error: (data as { error: string }).error };
  return { data: (data as { diff: DemDiff }).diff, error: null };
}

export async function runStockpileVolume(opts: {
  projectId: string;
  userId: string;
  rasterId: string;
  name: string;
  material?: string | null;
  polygonGeojson: GeoJSON.Polygon;
  baseMethod: "edge_mean" | "min" | "fixed";
  baseElevationM?: number | null;
  notes?: string | null;
}): Promise<{ data: StockpileVolume | null; error: string | null }> {
  const { data, error } = await supabase.functions.invoke("stockpile-volume", {
    body: {
      projectId: opts.projectId,
      rasterId: opts.rasterId,
      name: opts.name,
      material: opts.material,
      polygonGeojson: opts.polygonGeojson,
      baseMethod: opts.baseMethod,
      baseElevationM: opts.baseElevationM,
      notes: opts.notes,
    },
    headers: { "x-user-id": opts.userId },
  });
  if (error) return { data: null, error: error.message };
  if ((data as { error?: string })?.error) return { data: null, error: (data as { error: string }).error };
  return { data: (data as { stockpile: StockpileVolume }).stockpile, error: null };
}

export async function deleteDemDiff(id: string) {
  return supabase.from("dem_diffs").delete().eq("id", id);
}
export async function deleteStockpile(id: string) {
  return supabase.from("stockpile_volumes").delete().eq("id", id);
}
