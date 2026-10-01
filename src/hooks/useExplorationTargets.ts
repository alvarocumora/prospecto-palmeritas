import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export type TargetStage =
  "generated" | "validated" | "drill_ready" | "drilling" | "drilled" | "closed";
export type TargetPriority = "low" | "medium" | "high" | "critical";
export type TargetType =
  | "vein"
  | "disseminated"
  | "skarn"
  | "porphyry"
  | "placer"
  | "epithermal"
  | "iocg"
  | "vms"
  | "other";

export type ExplorationTarget = {
  id: string;
  project_id: string;
  campaign_id: string | null;
  created_by: string;
  code: string;
  name: string;
  target_type: TargetType;
  commodity: string | null;
  target_zone: string | null;
  lat: number | null;
  lng: number | null;
  elevation_m: number | null;
  geometry_geojson: unknown | null;
  stage: TargetStage;
  priority: TargetPriority;
  score: number | null;
  confidence_pct: number | null;
  rationale: string | null;
  evidence: Record<string, unknown> | null;
  assigned_to: string | null;
  planned_meters: number | null;
  estimated_cost_usd: number | null;
  validated_by: string | null;
  validated_at: string | null;
  closed_reason: string | null;
  closed_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export const TARGET_STAGES: TargetStage[] = [
  "generated",
  "validated",
  "drill_ready",
  "drilling",
  "drilled",
  "closed",
];

export const STAGE_META: Record<TargetStage, { label: string; color: string }> = {
  generated: { label: "Generated", color: "text-muted-foreground border-border bg-muted/20" },
  validated: { label: "Validated", color: "text-info border-info/30 bg-info/10" },
  drill_ready: { label: "Drill-Ready", color: "text-gold border-gold/40 bg-gold/10" },
  drilling: { label: "Drilling", color: "text-copper border-copper/40 bg-copper/10" },
  drilled: { label: "Drilled", color: "text-teal border-teal/30 bg-teal/10" },
  closed: {
    label: "Closed",
    color: "text-muted-foreground border-border bg-muted/20 line-through",
  },
};

export const PRIORITY_META: Record<TargetPriority, { label: string; color: string }> = {
  low: { label: "Baja", color: "text-muted-foreground border-border" },
  medium: { label: "Media", color: "text-info border-info/30" },
  high: { label: "Alta", color: "text-gold border-gold/40" },
  critical: { label: "Crítica", color: "text-destructive border-destructive/40" },
};

export function useExplorationTargets(projectId: string | null) {
  const { user } = useAuth();
  const [targets, setTargets] = useState<ExplorationTarget[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!projectId) {
      setTargets([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error: err } = await supabase
      .from("exploration_targets")
      .select("*")
      .eq("project_id", projectId)
      .order("priority", { ascending: false })
      .order("score", { ascending: false });
    if (err) {
      setError(err.message);
      setTargets([]);
    } else {
      setTargets((data ?? []) as ExplorationTarget[]);
      setError(null);
    }
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    refresh();
    if (!projectId) return;
    const ch = supabase
      .channel(`exploration_targets:${projectId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "exploration_targets",
          filter: `project_id=eq.${projectId}`,
        },
        () => {
          refresh();
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [refresh, projectId]);

  const addTarget = useCallback(
    async (t: Partial<ExplorationTarget> & { code: string; name: string }) => {
      if (!projectId || !user) return { error: "no-context" };
      const { error } = await supabase.from("exploration_targets").insert({
        project_id: projectId,
        created_by: user.id,
        code: t.code,
        name: t.name,
        target_type: t.target_type ?? "vein",
        commodity: t.commodity ?? null,
        target_zone: t.target_zone ?? null,
        lat: t.lat ?? null,
        lng: t.lng ?? null,
        elevation_m: t.elevation_m ?? null,
        stage: t.stage ?? "generated",
        priority: t.priority ?? "medium",
        score: t.score ?? 50,
        confidence_pct: t.confidence_pct ?? null,
        rationale: t.rationale ?? null,
        planned_meters: t.planned_meters ?? null,
        estimated_cost_usd: t.estimated_cost_usd ?? null,
        notes: t.notes ?? null,
      });
      if (!error) await refresh();
      return { error: error?.message ?? null };
    },
    [projectId, user, refresh],
  );

  const updateStage = useCallback(
    async (id: string, stage: TargetStage, closedReason?: string) => {
      if (!user) return { error: "no-user" };
      const patch: {
        stage: TargetStage;
        validated_by?: string;
        validated_at?: string;
        closed_at?: string;
        closed_reason?: string | null;
      } = { stage };
      if (stage === "validated") {
        patch.validated_by = user.id;
        patch.validated_at = new Date().toISOString();
      }
      if (stage === "closed") {
        patch.closed_at = new Date().toISOString();
        patch.closed_reason = closedReason ?? null;
      }
      const { error } = await supabase.from("exploration_targets").update(patch).eq("id", id);
      if (!error) await refresh();
      return { error: error?.message ?? null };
    },
    [user, refresh],
  );

  const updateTarget = useCallback(
    async (
      id: string,
      patch: Partial<Omit<ExplorationTarget, "evidence" | "geometry_geojson">>,
    ) => {
      const { error } = await supabase.from("exploration_targets").update(patch).eq("id", id);
      if (!error) await refresh();
      return { error: error?.message ?? null };
    },
    [refresh],
  );

  const deleteTarget = useCallback(
    async (id: string) => {
      const { error } = await supabase.from("exploration_targets").delete().eq("id", id);
      if (!error) await refresh();
      return { error: error?.message ?? null };
    },
    [refresh],
  );

  return { targets, loading, error, refresh, addTarget, updateStage, updateTarget, deleteTarget };
}
