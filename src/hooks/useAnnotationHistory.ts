// History of changes for a single map annotation, sourced from public.audit_log.
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface AnnotationHistoryEntry {
  id: string;
  action: "INSERT" | "UPDATE" | "DELETE";
  user_id: string | null;
  user_name: string | null;
  created_at: string;
  payload: Record<string, unknown> | null;
}

export function useAnnotationHistory(annotationId: string | null) {
  const [entries, setEntries] = useState<AnnotationHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async () => {
    if (!annotationId) {
      setEntries([]);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("audit_log")
      .select("id, action, user_id, created_at, payload")
      .eq("entity_type", "map_annotations")
      .eq("entity_id", annotationId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) {
      console.error("[useAnnotationHistory]", error);
      setEntries([]);
      setLoading(false);
      return;
    }
    const userIds = Array.from(new Set((data ?? []).map((r) => r.user_id).filter(Boolean) as string[]));
    let nameMap = new Map<string, string>();
    if (userIds.length > 0) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, display_name, email")
        .in("user_id", userIds);
      nameMap = new Map((profs ?? []).map((p) => [p.user_id, p.display_name || p.email || "—"]));
    }
    setEntries(
      (data ?? []).map((r) => ({
        id: r.id,
        action: r.action as AnnotationHistoryEntry["action"],
        user_id: r.user_id,
        user_name: r.user_id ? nameMap.get(r.user_id) ?? null : null,
        created_at: r.created_at,
        payload: (r.payload ?? null) as Record<string, unknown> | null,
      })),
    );
    setLoading(false);
  }, [annotationId]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { entries, loading, refresh: fetch };
}

/** Compares two adjacent payloads to summarize what changed. Newer entry's payload vs previous. */
export function summarizeDiff(curr: Record<string, unknown> | null, prev: Record<string, unknown> | null): string[] {
  if (!curr) return [];
  const tracked: { key: string; label: string }[] = [
    { key: "text", label: "texto" },
    { key: "color", label: "color" },
    { key: "resolved", label: "resuelta" },
    { key: "lat", label: "lat" },
    { key: "lng", label: "lng" },
    { key: "target_id", label: "target" },
    { key: "campaign_id", label: "campaña" },
    { key: "phase", label: "fase" },
  ];
  const changes: string[] = [];
  for (const { key, label } of tracked) {
    const a = curr[key];
    const b = prev?.[key];
    if (JSON.stringify(a) !== JSON.stringify(b)) {
      const av = a == null || a === "" ? "—" : String(a);
      changes.push(`${label}: ${av.length > 24 ? av.slice(0, 24) + "…" : av}`);
    }
  }
  return changes;
}
