import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type ComplianceStandard = "ni43101" | "jorc2012" | "samrec" | "perc" | "gkz";
export type EvalStatus = "pass" | "warn" | "fail" | "na" | "pending";

export interface ComplianceRule {
  id: string;
  standard: ComplianceStandard;
  rule_code: string;
  section_no: number | null;
  title: string;
  description: string;
  severity: "mandatory" | "recommended" | "conditional";
  evaluator_type: "manual" | "auto_count" | "auto_field" | "auto_evidence";
  evaluator_config: Record<string, any> | null;
  reference_url: string | null;
  display_order: number;
}

export interface ComplianceEvaluation {
  id: string;
  report_id: string;
  rule_id: string;
  status: EvalStatus;
  score: number | null;
  auto_evaluated: boolean;
  evaluator_notes: string | null;
  evaluated_at: string | null;
  evaluated_by: string | null;
}

export interface EvidenceLink {
  id: string;
  report_id: string;
  rule_id: string;
  evidence_type: string;
  evidence_id: string | null;
  url: string | null;
  caption: string | null;
  created_at: string;
}

export interface StandardScore {
  score: number;
  status: "compliant" | "partial" | "non_compliant";
  mandatory_pass: number;
  mandatory_total: number;
  rules_total: number;
}

export interface EvaluationResult {
  report_id: string;
  by_standard: Record<string, StandardScore>;
  global_score: number;
  threshold: number;
  is_blocking: boolean;
  blocking_failures: { rule_code: string; title: string; severity: string }[];
  warnings: { rule_code: string; title: string }[];
  evaluated_count: number;
}

export function useCompliance(reportId: string | null) {
  const [rules, setRules] = useState<ComplianceRule[]>([]);
  const [evaluations, setEvaluations] = useState<ComplianceEvaluation[]>([]);
  const [evidence, setEvidence] = useState<EvidenceLink[]>([]);
  const [activeStandards, setActiveStandards] = useState<ComplianceStandard[]>(["ni43101"]);
  const [threshold, setThreshold] = useState<number>(95);
  const [cachedScore, setCachedScore] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [evaluating, setEvaluating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    if (!reportId) {
      setRules([]); setEvaluations([]); setEvidence([]); setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [{ data: rep }, { data: rl }, { data: ev }, { data: links }] = await Promise.all([
        supabase
          .from("technical_reports")
          .select("active_standards, compliance_threshold, compliance_score_cached")
          .eq("id", reportId)
          .maybeSingle(),
        supabase.from("compliance_rules").select("*").order("display_order"),
        supabase.from("compliance_evaluations").select("*").eq("report_id", reportId),
        supabase.from("report_evidence_links").select("*").eq("report_id", reportId),
      ]);
      const stds = (rep?.active_standards as ComplianceStandard[] | null) ?? ["ni43101"];
      setActiveStandards(stds);
      setThreshold(rep?.compliance_threshold ?? 95);
      setCachedScore(rep?.compliance_score_cached ?? null);
      const stdsSet = new Set(stds);
      setRules(((rl ?? []) as ComplianceRule[]).filter((r) => stdsSet.has(r.standard)));
      setEvaluations((ev ?? []) as ComplianceEvaluation[]);
      setEvidence((links ?? []) as EvidenceLink[]);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error cargando compliance");
    } finally {
      setLoading(false);
    }
  }, [reportId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const evaluate = useCallback(async (): Promise<EvaluationResult | null> => {
    if (!reportId) return null;
    setEvaluating(true);
    try {
      const { data, error } = await supabase.functions.invoke("evaluate-compliance", {
        body: { report_id: reportId, standards: activeStandards },
      });
      if (error) throw error;
      toast.success(`Compliance evaluado: ${data.global_score}%`);
      await fetchAll();
      return data as EvaluationResult;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error evaluando";
      toast.error(msg);
      return null;
    } finally {
      setEvaluating(false);
    }
  }, [reportId, activeStandards, fetchAll]);

  const markManual = useCallback(async (ruleId: string, status: EvalStatus, notes?: string) => {
    if (!reportId) return;
    const { data: { user } } = await supabase.auth.getUser();
    const { data: rep } = await supabase.from("technical_reports").select("project_id").eq("id", reportId).single();
    if (!rep) throw new Error("Reporte no encontrado");
    const score = status === "pass" ? 100 : status === "warn" ? 50 : status === "na" ? 100 : 0;
    const { error } = await supabase
      .from("compliance_evaluations")
      .upsert({
        report_id: reportId,
        project_id: rep.project_id,
        rule_id: ruleId,
        status,
        score,
        auto_evaluated: false,
        evaluator_notes: notes ?? null,
        evaluated_at: new Date().toISOString(),
        evaluated_by: user?.id ?? null,
      }, { onConflict: "report_id,rule_id" });
    if (error) { toast.error(error.message); throw error; }
    toast.success("Evaluación actualizada");
    await fetchAll();
  }, [reportId, fetchAll]);

  const attachEvidence = useCallback(async (ruleId: string, evidenceType: string, evidenceId?: string, url?: string, caption?: string) => {
    if (!reportId) return;
    const { error } = await supabase.from("report_evidence_links").insert({
      report_id: reportId,
      rule_id: ruleId,
      evidence_type: evidenceType,
      evidence_id: evidenceId ?? null,
      url: url ?? null,
      caption: caption ?? null,
    });
    if (error) { toast.error(error.message); throw error; }
    toast.success("Evidencia adjuntada");
    await fetchAll();
  }, [reportId, fetchAll]);

  const removeEvidence = useCallback(async (linkId: string) => {
    const { error } = await supabase.from("report_evidence_links").delete().eq("id", linkId);
    if (error) { toast.error(error.message); throw error; }
    await fetchAll();
  }, [fetchAll]);

  const toggleStandard = useCallback(async (std: ComplianceStandard) => {
    if (!reportId) return;
    const next = activeStandards.includes(std)
      ? activeStandards.filter((s) => s !== std)
      : [...activeStandards, std];
    if (next.length === 0) { toast.error("Debe haber al menos un estándar activo"); return; }
    const { error } = await supabase
      .from("technical_reports")
      .update({ active_standards: next })
      .eq("id", reportId);
    if (error) { toast.error(error.message); throw error; }
    setActiveStandards(next);
    await fetchAll();
  }, [reportId, activeStandards, fetchAll]);

  const updateThreshold = useCallback(async (n: number) => {
    if (!reportId) return;
    const clamped = Math.max(0, Math.min(100, Math.round(n)));
    const { error } = await supabase
      .from("technical_reports")
      .update({ compliance_threshold: clamped })
      .eq("id", reportId);
    if (error) { toast.error(error.message); throw error; }
    setThreshold(clamped);
  }, [reportId]);

  // Derivados: scores por estándar usando evaluaciones cargadas
  const scoreByStandard = useMemo(() => {
    const out: Record<string, StandardScore> = {};
    for (const std of activeStandards) {
      const stdRules = rules.filter((r) => r.standard === std);
      let weightedScore = 0;
      let weightTotal = 0;
      let mandPass = 0;
      let mandTotal = 0;
      for (const rule of stdRules) {
        const ev = evaluations.find((e) => e.rule_id === rule.id);
        const w = rule.severity === "mandatory" ? 1.0 : rule.severity === "recommended" ? 0.3 : 0.1;
        weightTotal += w;
        if (ev?.status === "pass") weightedScore += w;
        else if (ev?.status === "warn") weightedScore += w * 0.5;
        if (rule.severity === "mandatory") {
          mandTotal += 1;
          if (ev?.status === "pass") mandPass += 1;
        }
      }
      const score = weightTotal > 0 ? Math.round((weightedScore / weightTotal) * 100) : 0;
      out[std] = {
        score,
        status: score >= threshold ? "compliant" : score >= 70 ? "partial" : "non_compliant",
        mandatory_pass: mandPass,
        mandatory_total: mandTotal,
        rules_total: stdRules.length,
      };
    }
    return out;
  }, [activeStandards, rules, evaluations, threshold]);

  const globalScore = useMemo(() => {
    const arr = Object.values(scoreByStandard).map((s) => s.score);
    return arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;
  }, [scoreByStandard]);

  const isBlocking = useMemo(() => {
    if (globalScore < threshold) return true;
    return rules.some((r) => {
      if (r.severity !== "mandatory") return false;
      const ev = evaluations.find((e) => e.rule_id === r.id);
      return !ev || ev.status === "fail" || ev.status === "pending";
    });
  }, [rules, evaluations, globalScore, threshold]);

  return {
    rules, evaluations, evidence,
    activeStandards, threshold, cachedScore,
    loading, evaluating, error,
    scoreByStandard, globalScore, isBlocking,
    refresh: fetchAll,
    evaluate, markManual,
    attachEvidence, removeEvidence,
    toggleStandard, updateThreshold,
  };
}
