// Sprint 6.3 — Saved Views: persistencia de vistas del mapa por usuario+proyecto.
// Guarda center/zoom + estado arbitrario de capas y filtros en map_views.

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface MapViewLayerState {
  campaignId?: string | null;
  highGradeOnly?: boolean;
  rasterSettings?: Record<string, { visible: boolean; opacity: number; colormap: string }>;
  viewMode?: "2d" | "3d";
  [k: string]: unknown;
}

export interface MapView {
  id: string;
  name: string;
  project_id: string;
  user_id: string;
  center_lat: number | null;
  center_lng: number | null;
  zoom: number | null;
  layer_state: MapViewLayerState;
  created_at: string;
  updated_at: string;
}

export function useMapViews(projectId: string | null) {
  const [views, setViews] = useState<MapView[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchViews = useCallback(async () => {
    if (!projectId) {
      setViews([]);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("map_views")
      .select("*")
      .eq("project_id", projectId)
      .order("updated_at", { ascending: false });
    setLoading(false);
    if (error) {
      console.error("[useMapViews]", error);
      return;
    }
    setViews((data ?? []) as unknown as MapView[]);
  }, [projectId]);

  useEffect(() => {
    fetchViews();
  }, [fetchViews]);

  const saveView = useCallback(
    async (input: {
      name: string;
      center_lat: number;
      center_lng: number;
      zoom: number;
      layer_state: MapViewLayerState;
    }) => {
      if (!projectId) return null;
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id;
      if (!uid) {
        toast.error("Sesión no válida");
        return null;
      }
      const { data, error } = await supabase
        .from("map_views")
        .insert({
          project_id: projectId,
          user_id: uid,
          name: input.name,
          center_lat: input.center_lat,
          center_lng: input.center_lng,
          zoom: input.zoom,
          layer_state: input.layer_state as never,
        })
        .select()
        .single();
      if (error) {
        toast.error(`No se pudo guardar la vista: ${error.message}`);
        return null;
      }
      toast.success(`Vista «${input.name}» guardada`);
      await fetchViews();
      return data as unknown as MapView;
    },
    [projectId, fetchViews],
  );

  const deleteView = useCallback(
    async (id: string) => {
      const { error } = await supabase.from("map_views").delete().eq("id", id);
      if (error) {
        toast.error(`No se pudo borrar: ${error.message}`);
        return;
      }
      toast.success("Vista eliminada");
      await fetchViews();
    },
    [fetchViews],
  );

  return { views, loading, saveView, deleteView, refresh: fetchViews };
}
