import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export type CoreBoxStatus = "stored" | "in_transit" | "sampled" | "archived" | "lost";
export type CoreBoxCondition = "good" | "damaged" | "partial";

export type CoreBox = {
  id: string;
  project_id: string;
  hole_id: string | null;
  box_code: string;
  box_number: number | null;
  depth_from: number | null;
  depth_to: number | null;
  storage_location: string | null;
  rack: string | null;
  shelf: string | null;
  position: string | null;
  status: CoreBoxStatus;
  condition: CoreBoxCondition;
  photo_urls: string[];
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type CustodyEvent =
  | "collected" | "packaged" | "shipped" | "received_lab"
  | "analyzed" | "returned" | "archived" | "rejected";

export type SampleCustody = {
  id: string;
  project_id: string;
  sample_id: string | null;
  sample_code: string;
  event_type: CustodyEvent;
  event_at: string;
  location: string | null;
  from_user: string | null;
  to_user: string | null;
  carrier: string | null;
  waybill: string | null;
  seal_number: string | null;
  photo_urls: string[];
  notes: string | null;
  created_by: string;
  created_at: string;
};

export const BOX_STATUS_META: Record<CoreBoxStatus, { label: string; color: string }> = {
  stored:     { label: "Almacenado",  color: "text-info border-info/30 bg-info/10" },
  in_transit: { label: "En tránsito", color: "text-copper border-copper/40 bg-copper/10" },
  sampled:    { label: "Muestreado",  color: "text-gold border-gold/40 bg-gold/10" },
  archived:   { label: "Archivado",   color: "text-muted-foreground border-border bg-muted/20" },
  lost:       { label: "Perdido",     color: "text-destructive border-destructive/40 bg-destructive/10" },
};

export const CONDITION_META: Record<CoreBoxCondition, { label: string; color: string }> = {
  good:    { label: "Buena",   color: "text-teal border-teal/30" },
  damaged: { label: "Dañada",  color: "text-destructive border-destructive/40" },
  partial: { label: "Parcial", color: "text-copper border-copper/40" },
};

export const CUSTODY_EVENT_META: Record<CustodyEvent, { label: string; color: string }> = {
  collected:    { label: "Recolectada",      color: "text-info" },
  packaged:     { label: "Empaquetada",      color: "text-info" },
  shipped:      { label: "Enviada",          color: "text-copper" },
  received_lab: { label: "Recibida en lab",  color: "text-teal" },
  analyzed:     { label: "Analizada",        color: "text-gold" },
  returned:     { label: "Devuelta",         color: "text-muted-foreground" },
  archived:     { label: "Archivada",        color: "text-muted-foreground" },
  rejected:     { label: "Rechazada",        color: "text-destructive" },
};

export function useCoreInventory(projectId: string | null) {
  const { user } = useAuth();
  const [boxes, setBoxes] = useState<CoreBox[]>([]);
  const [custody, setCustody] = useState<SampleCustody[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!projectId) { setBoxes([]); setCustody([]); setLoading(false); return; }
    setLoading(true);
    const [boxesRes, custodyRes] = await Promise.all([
      supabase.from("core_boxes").select("*").eq("project_id", projectId).order("box_code", { ascending: true }),
      supabase.from("sample_custody").select("*").eq("project_id", projectId).order("event_at", { ascending: false }).limit(500),
    ]);
    if (boxesRes.error) setError(boxesRes.error.message);
    else setBoxes((boxesRes.data ?? []) as CoreBox[]);
    if (custodyRes.error) setError(custodyRes.error.message);
    else setCustody((custodyRes.data ?? []) as SampleCustody[]);
    setLoading(false);
  }, [projectId]);

  useEffect(() => { refresh(); }, [refresh]);

  const addBox = useCallback(async (b: Partial<CoreBox> & { box_code: string }) => {
    if (!projectId || !user) return { error: "no-context" };
    const { error } = await supabase.from("core_boxes").insert({
      project_id: projectId,
      created_by: user.id,
      box_code: b.box_code,
      hole_id: b.hole_id ?? null,
      box_number: b.box_number ?? null,
      depth_from: b.depth_from ?? null,
      depth_to: b.depth_to ?? null,
      storage_location: b.storage_location ?? null,
      rack: b.rack ?? null,
      shelf: b.shelf ?? null,
      position: b.position ?? null,
      status: b.status ?? "stored",
      condition: b.condition ?? "good",
      notes: b.notes ?? null,
    });
    if (!error) await refresh();
    return { error: error?.message ?? null };
  }, [projectId, user, refresh]);

  const updateBox = useCallback(async (id: string, patch: Partial<CoreBox>) => {
    const { error } = await supabase.from("core_boxes").update(patch).eq("id", id);
    if (!error) await refresh();
    return { error: error?.message ?? null };
  }, [refresh]);

  const deleteBox = useCallback(async (id: string) => {
    const { error } = await supabase.from("core_boxes").delete().eq("id", id);
    if (!error) await refresh();
    return { error: error?.message ?? null };
  }, [refresh]);

  const addCustodyEvent = useCallback(async (e: Partial<SampleCustody> & { sample_code: string; event_type: CustodyEvent }) => {
    if (!projectId || !user) return { error: "no-context" };
    const { error } = await supabase.from("sample_custody").insert({
      project_id: projectId,
      created_by: user.id,
      sample_code: e.sample_code,
      event_type: e.event_type,
      event_at: e.event_at ?? new Date().toISOString(),
      location: e.location ?? null,
      from_user: e.from_user ?? null,
      to_user: e.to_user ?? null,
      carrier: e.carrier ?? null,
      waybill: e.waybill ?? null,
      seal_number: e.seal_number ?? null,
      notes: e.notes ?? null,
    });
    if (!error) await refresh();
    return { error: error?.message ?? null };
  }, [projectId, user, refresh]);

  return { boxes, custody, loading, error, refresh, addBox, updateBox, deleteBox, addCustodyEvent };
}
