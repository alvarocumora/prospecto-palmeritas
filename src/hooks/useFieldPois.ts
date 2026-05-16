import { useCallback, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type FieldPoiType =
  | "outcrop"
  | "alteration"
  | "vein"
  | "structure"
  | "sample"
  | "lithology"
  | "infrastructure"
  | "hse_risk"
  | "other";

export const FIELD_POI_TYPES: { value: FieldPoiType; label: string; color: string }[] = [
  { value: "outcrop", label: "Afloramiento", color: "#F0C96B" },
  { value: "alteration", label: "Alteración", color: "#E07A5F" },
  { value: "vein", label: "Veta", color: "#dc2626" },
  { value: "structure", label: "Estructura", color: "#9b72cf" },
  { value: "sample", label: "Muestra", color: "#3b82f6" },
  { value: "lithology", label: "Contacto litológico", color: "#10b981" },
  { value: "infrastructure", label: "Infraestructura", color: "#64748b" },
  { value: "hse_risk", label: "Riesgo HSE", color: "#f59e0b" },
  { value: "other", label: "Otro", color: "#a8a29e" },
];

export type FieldPoi = {
  id: string;
  project_id: string;
  organization_id: string;
  poi_type: FieldPoiType;
  title: string;
  note: string | null;
  lat: number;
  lng: number;
  accuracy_m: number | null;
  elevation_m: number | null;
  photo_path: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type NewFieldPoi = {
  project_id: string;
  organization_id: string;
  poi_type: FieldPoiType;
  title: string;
  note: string | null;
  lat: number;
  lng: number;
  accuracy_m: number | null;
  elevation_m: number | null;
  photo?: File | null;
};

export function useFieldPois(projectId: string | null) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["field-pois", projectId],
    queryFn: async (): Promise<FieldPoi[]> => {
      if (!projectId) return [];
      const { data, error } = await supabase
        .from("field_pois")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as FieldPoi[];
    },
    enabled: !!projectId,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!projectId) return;
    const channel = supabase
      .channel(`field-pois-${projectId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "field_pois", filter: `project_id=eq.${projectId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["field-pois", projectId] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId, queryClient]);

  const create = useCallback(async (input: NewFieldPoi): Promise<FieldPoi> => {
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData.user) throw userErr ?? new Error("No autenticado");
    const userId = userData.user.id;

    let photo_path: string | null = null;
    if (input.photo) {
      const ext = input.photo.name.split(".").pop()?.toLowerCase() ?? "jpg";
      const path = `${input.project_id}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("field-poi-photos")
        .upload(path, input.photo, { contentType: input.photo.type, upsert: false });
      if (upErr) throw upErr;
      photo_path = path;
    }

    const { data, error } = await supabase
      .from("field_pois")
      .insert({
        project_id: input.project_id,
        organization_id: input.organization_id,
        poi_type: input.poi_type,
        title: input.title,
        note: input.note,
        lat: input.lat,
        lng: input.lng,
        accuracy_m: input.accuracy_m,
        elevation_m: input.elevation_m,
        photo_path,
        created_by: userId,
      })
      .select("*")
      .single();
    if (error) throw error;
    queryClient.invalidateQueries({ queryKey: ["field-pois", input.project_id] });
    return data as FieldPoi;
  }, [queryClient]);

  const remove = useCallback(async (id: string) => {
    const { error } = await supabase.from("field_pois").delete().eq("id", id);
    if (error) throw error;
    if (projectId) queryClient.invalidateQueries({ queryKey: ["field-pois", projectId] });
  }, [projectId, queryClient]);

  return {
    pois: query.data ?? [],
    loading: query.isLoading,
    error: query.error instanceof Error ? query.error.message : null,
    create,
    remove,
    refresh: query.refetch,
  };
}

// Offline queue (localStorage). Photos are not queued offline (uploads need network).
type QueuedPoi = Omit<NewFieldPoi, "photo"> & { localId: string; queuedAt: number };
const QUEUE_KEY = "geocapitals:offline-pois";

function readQueue(): QueuedPoi[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? (JSON.parse(raw) as QueuedPoi[]) : [];
  } catch {
    return [];
  }
}

function writeQueue(items: QueuedPoi[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(QUEUE_KEY, JSON.stringify(items));
}

export function useFieldPoiQueue() {
  const [queue, setQueue] = useState<QueuedPoi[]>([]);
  const [online, setOnline] = useState<boolean>(
    typeof navigator === "undefined" ? true : navigator.onLine,
  );

  useEffect(() => {
    setQueue(readQueue());
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  const enqueue = useCallback((p: Omit<NewFieldPoi, "photo">) => {
    const item: QueuedPoi = { ...p, localId: crypto.randomUUID(), queuedAt: Date.now() };
    const next = [...readQueue(), item];
    writeQueue(next);
    setQueue(next);
    return item;
  }, []);

  const flush = useCallback(async (
    createFn: (p: NewFieldPoi) => Promise<FieldPoi>,
  ): Promise<{ ok: number; failed: number }> => {
    const items = readQueue();
    let ok = 0, failed = 0;
    const remaining: QueuedPoi[] = [];
    for (const it of items) {
      try {
        const { localId: _l, queuedAt: _q, ...rest } = it;
        void _l; void _q;
        await createFn(rest);
        ok++;
      } catch {
        failed++;
        remaining.push(it);
      }
    }
    writeQueue(remaining);
    setQueue(remaining);
    return { ok, failed };
  }, []);

  return { queue, online, enqueue, flush };
}
