// Persistent map annotations (notes pinned to lat/lng) per project.
// Backed by public.map_annotations with realtime broadcast.

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface MapAnnotation {
  id: string;
  project_id: string;
  created_by: string;
  lat: number;
  lng: number;
  text: string;
  color: string;
  resolved: boolean;
  priority: "low" | "medium" | "high";
  resolved_reason: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  target_id: string | null;
  campaign_id: string | null;
  phase: string | null;
  created_at: string;
  updated_at: string;
}

export const ANNOTATION_PRIORITIES: { value: "low" | "medium" | "high"; label: string; hex: string }[] = [
  { value: "low", label: "Baja", hex: "#64748B" },
  { value: "medium", label: "Media", hex: "#D4A24C" },
  { value: "high", label: "Alta", hex: "#E11D48" },
];

export const SAMPLING_PHASES = [
  "recon",
  "rock-chip",
  "channel",
  "trinchera",
  "RC",
  "DDH",
  "metalúrgico",
  "verificación",
] as const;

export const ANNOTATION_COLORS: { value: string; label: string; hex: string }[] = [
  { value: "gold", label: "Estructural", hex: "#D4A24C" },
  { value: "red", label: "Target / alerta", hex: "#E11D48" },
  { value: "blue", label: "Logístico", hex: "#3B82F6" },
  { value: "green", label: "Validado", hex: "#10B981" },
  { value: "purple", label: "Geofísica", hex: "#A855F7" },
];

export function colorHex(c: string): string {
  return ANNOTATION_COLORS.find((x) => x.value === c)?.hex ?? "#D4A24C";
}

export function useMapAnnotations(projectId: string | null) {
  const [annotations, setAnnotations] = useState<MapAnnotation[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchAnnotations = useCallback(async () => {
    if (!projectId) {
      setAnnotations([]);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("map_annotations")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });
    setLoading(false);
    if (error) {
      console.error("[useMapAnnotations]", error);
      return;
    }
    setAnnotations((data ?? []) as MapAnnotation[]);
  }, [projectId]);

  useEffect(() => {
    fetchAnnotations();
  }, [fetchAnnotations]);

  // Realtime sync so multiple clients on same project stay in sync.
  useEffect(() => {
    if (!projectId) return;
    const channel = supabase
      .channel(`map-annotations-${projectId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "map_annotations", filter: `project_id=eq.${projectId}` },
        () => fetchAnnotations(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId, fetchAnnotations]);

  const createAnnotation = useCallback(
    async (input: {
      lat: number; lng: number; text: string; color?: string;
      priority?: "low" | "medium" | "high";
      target_id?: string | null; campaign_id?: string | null; phase?: string | null;
    }) => {
      if (!projectId) return null;
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id;
      if (!uid) {
        toast.error("Sesión no válida");
        return null;
      }
      const { data, error } = await supabase
        .from("map_annotations")
        .insert({
          project_id: projectId,
          created_by: uid,
          lat: input.lat,
          lng: input.lng,
          text: input.text.slice(0, 500),
          color: input.color ?? "gold",
          priority: input.priority ?? "medium",
          target_id: input.target_id ?? null,
          campaign_id: input.campaign_id ?? null,
          phase: input.phase ?? null,
        })
        .select()
        .single();
      if (error) {
        toast.error(`No se pudo crear la nota: ${error.message}`);
        return null;
      }
      toast.success("Nota guardada");
      return data as MapAnnotation;
    },
    [projectId],
  );

  const updateAnnotation = useCallback(
    async (
      id: string,
      patch: Partial<Pick<MapAnnotation, "text" | "color" | "resolved" | "lat" | "lng" | "target_id" | "campaign_id" | "phase" | "priority" | "resolved_reason">>,
    ) => {
      const next: {
        text?: string; color?: string; resolved?: boolean; lat?: number; lng?: number;
        target_id?: string | null; campaign_id?: string | null; phase?: string | null;
        priority?: "low" | "medium" | "high"; resolved_reason?: string | null;
        resolved_by?: string | null; resolved_at?: string | null;
      } = { ...patch };
      if (Object.prototype.hasOwnProperty.call(patch, "resolved")) {
        if (patch.resolved) {
          const { data: u } = await supabase.auth.getUser();
          next.resolved_by = u.user?.id ?? null;
          next.resolved_at = new Date().toISOString();
        } else {
          next.resolved_by = null;
          next.resolved_at = null;
          next.resolved_reason = null;
        }
      }
      const { error } = await supabase.from("map_annotations").update(next).eq("id", id);
      if (error) {
        toast.error(`No se pudo actualizar: ${error.message}`);
      }
    },
    [],
  );

  const deleteAnnotation = useCallback(async (id: string) => {
    const { error } = await supabase.from("map_annotations").delete().eq("id", id);
    if (error) {
      toast.error(`No se pudo borrar: ${error.message}`);
      return;
    }
    toast.success("Nota eliminada");
  }, []);

  return { annotations, loading, createAnnotation, updateAnnotation, deleteAnnotation, refresh: fetchAnnotations };
}
