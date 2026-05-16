import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export type AnomalyStatus = "detected" | "reviewed" | "validated" | "promoted" | "dismissed";
export type AnomalySeverity = "low" | "medium" | "high" | "critical";
export type AnomalyType =
  | "magnetic_high"
  | "magnetic_low"
  | "ip_high"
  | "resistivity_low"
  | "csamt_conductor"
  | "gravity_high"
  | "radiometric_high"
  | "other";

export type GeophysicsAnomaly = {
  id: string;
  project_id: string;
  survey_id: string;
  station_id: string | null;
  target_id: string | null;
  created_by: string;
  code: string;
  anomaly_type: AnomalyType;
  severity: AnomalySeverity;
  status: AnomalyStatus;
  confidence_pct: number | null;
  lat: number | null;
  lng: number | null;
  peak_value: number | null;
  peak_unit: string | null;
  estimated_depth_m: number | null;
  estimated_area_m2: number | null;
  rationale: string | null;
  evidence: Record<string, unknown> | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  validated_by: string | null;
  validated_at: string | null;
  promoted_at: string | null;
  dismissed_reason: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export const ANOMALY_STATUSES: AnomalyStatus[] = [
  "detected",
  "reviewed",
  "validated",
  "promoted",
  "dismissed",
];

export const ANOMALY_TYPES: AnomalyType[] = [
  "magnetic_high",
  "magnetic_low",
  "ip_high",
  "resistivity_low",
  "csamt_conductor",
  "gravity_high",
  "radiometric_high",
  "other",
];

export const ANOMALY_TYPE_LABELS: Record<AnomalyType, string> = {
  magnetic_high: "Mag. alta",
  magnetic_low: "Mag. baja",
  ip_high: "IP cargabilidad alta",
  resistivity_low: "Resistividad baja",
  csamt_conductor: "Conductor CSAMT",
  gravity_high: "Gravedad alta",
  radiometric_high: "Radiometría alta",
  other: "Otro",
};

export const ANOMALY_SEVERITY_META: Record<AnomalySeverity, { label: string; color: string }> = {
  low: { label: "Baja", color: "text-muted-foreground border-border bg-muted/20" },
  medium: { label: "Media", color: "text-info border-info/30 bg-info/10" },
  high: { label: "Alta", color: "text-gold border-gold/40 bg-gold/10" },
  critical: { label: "Crítica", color: "text-destructive border-destructive/40 bg-destructive/10" },
};

export const ANOMALY_STATUS_META: Record<AnomalyStatus, { label: string; color: string }> = {
  detected: { label: "Detectada", color: "text-muted-foreground border-border bg-muted/20" },
  reviewed: { label: "Revisada", color: "text-info border-info/30 bg-info/10" },
  validated: { label: "Validada", color: "text-gold border-gold/40 bg-gold/10" },
  promoted: { label: "Promovida", color: "text-teal border-teal/30 bg-teal/10" },
  dismissed: {
    label: "Descartada",
    color: "text-muted-foreground border-border bg-muted/20 line-through",
  },
};

// Cast helper — supabase types regenerate after migration
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

export function useGeophysicsAnomalies(surveyId: string | null) {
  const [data, setData] = useState<GeophysicsAnomaly[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!surveyId) {
      setData([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data: rows, error: err } = await sb
      .from("geophysics_anomalies")
      .select("*")
      .eq("survey_id", surveyId)
      .order("created_at", { ascending: false });
    if (err) {
      setError(err.message);
      setData([]);
    } else {
      setData((rows ?? []) as GeophysicsAnomaly[]);
      setError(null);
    }
    setLoading(false);
  }, [surveyId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { data, loading, error, refresh };
}

export function useGeophysicsAnomalyMutations() {
  const { user } = useAuth();

  const createAnomaly = useCallback(
    async (
      projectId: string,
      surveyId: string,
      payload: Partial<GeophysicsAnomaly>,
    ): Promise<GeophysicsAnomaly> => {
      if (!user) throw new Error("Sin sesión");
      const { data, error } = await sb
        .from("geophysics_anomalies")
        .insert({
          project_id: projectId,
          survey_id: surveyId,
          created_by: user.id,
          code: payload.code ?? "ANOM-NEW",
          anomaly_type: payload.anomaly_type ?? "other",
          severity: payload.severity ?? "medium",
          status: payload.status ?? "detected",
          confidence_pct: payload.confidence_pct ?? null,
          lat: payload.lat ?? null,
          lng: payload.lng ?? null,
          peak_value: payload.peak_value ?? null,
          peak_unit: payload.peak_unit ?? null,
          estimated_depth_m: payload.estimated_depth_m ?? null,
          estimated_area_m2: payload.estimated_area_m2 ?? null,
          rationale: payload.rationale ?? null,
          station_id: payload.station_id ?? null,
          notes: payload.notes ?? null,
          evidence: payload.evidence ?? {},
        })
        .select()
        .single();
      if (error) throw error;
      return data as GeophysicsAnomaly;
    },
    [user],
  );

  const updateAnomaly = useCallback(
    async (id: string, patch: Partial<GeophysicsAnomaly>): Promise<GeophysicsAnomaly> => {
      const { data, error } = await sb
        .from("geophysics_anomalies")
        .update(patch)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as GeophysicsAnomaly;
    },
    [],
  );

  const deleteAnomaly = useCallback(async (id: string) => {
    const { error } = await sb.from("geophysics_anomalies").delete().eq("id", id);
    if (error) throw error;
  }, []);

  /** Mark as reviewed/validated (workflow advances) */
  const setStatus = useCallback(
    async (id: string, status: AnomalyStatus, dismissedReason?: string) => {
      if (!user) throw new Error("Sin sesión");
      const patch: Partial<GeophysicsAnomaly> = { status };
      const now = new Date().toISOString();
      if (status === "reviewed") {
        patch.reviewed_by = user.id;
        patch.reviewed_at = now;
      } else if (status === "validated") {
        patch.validated_by = user.id;
        patch.validated_at = now;
      } else if (status === "dismissed" && dismissedReason) {
        patch.dismissed_reason = dismissedReason;
      }
      return updateAnomaly(id, patch);
    },
    [user, updateAnomaly],
  );

  /**
   * Promotes a validated anomaly into an exploration_target.
   * Returns the new target id, and links the anomaly via target_id + status='promoted'.
   */
  const promoteToTarget = useCallback(
    async (
      anomaly: GeophysicsAnomaly,
      overrides: {
        code: string;
        name: string;
        target_type: string;
        priority: string;
        commodity?: string | null;
        target_zone?: string | null;
        rationale?: string | null;
        planned_meters?: number | null;
        estimated_cost_usd?: number | null;
        campaign_id?: string | null;
      },
    ): Promise<{ targetId: string }> => {
      if (!user) throw new Error("Sin sesión");

      const evidence = {
        source: "geophysics_anomaly",
        anomaly_id: anomaly.id,
        survey_id: anomaly.survey_id,
        anomaly_type: anomaly.anomaly_type,
        severity: anomaly.severity,
        confidence_pct: anomaly.confidence_pct,
        peak_value: anomaly.peak_value,
        peak_unit: anomaly.peak_unit,
        estimated_depth_m: anomaly.estimated_depth_m,
        estimated_area_m2: anomaly.estimated_area_m2,
      };

      const { data: target, error: tErr } = await supabase
        .from("exploration_targets")
        .insert({
          project_id: anomaly.project_id,
          campaign_id: overrides.campaign_id ?? null,
          created_by: user.id,
          code: overrides.code,
          name: overrides.name,
          target_type: overrides.target_type,
          priority: overrides.priority,
          stage: "validated",
          commodity: overrides.commodity ?? null,
          target_zone: overrides.target_zone ?? null,
          lat: anomaly.lat,
          lng: anomaly.lng,
          confidence_pct: anomaly.confidence_pct,
          rationale: overrides.rationale ?? anomaly.rationale ?? null,
          evidence,
          planned_meters: overrides.planned_meters ?? null,
          estimated_cost_usd: overrides.estimated_cost_usd ?? null,
          validated_by: user.id,
          validated_at: new Date().toISOString(),
        })
        .select("id")
        .single();
      if (tErr) throw tErr;

      const targetId = (target as { id: string }).id;

      await updateAnomaly(anomaly.id, {
        status: "promoted",
        target_id: targetId,
        promoted_at: new Date().toISOString(),
      });

      return { targetId };
    },
    [user, updateAnomaly],
  );

  return { createAnomaly, updateAnomaly, deleteAnomaly, setStatus, promoteToTarget };
}
