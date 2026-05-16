// evaluate-compliance: motor de evaluación de cumplimiento normativo
// para reportes técnicos (NI 43-101, JORC, SAMREC, PERC, GKZ).
//
// POST { report_id: string, standards?: string[] }
//  → {
//      report_id, by_standard: { [std]: { score, status, mandatory_pass, mandatory_total } },
//      global_score, blocking_failures, warnings, evaluated_count
//    }
//
// Recalcula automáticamente cada compliance_rule activo según su evaluator_type:
//   - manual:        no toca evaluaciones existentes; solo crea 'pending' si faltan
//   - auto_count:    cuenta filas en una tabla con condiciones (evaluator_config.table, .where)
//   - auto_field:    verifica que un campo exista (evaluator_config.table, .field, .ref)
//   - auto_evidence: verifica que haya >= N report_evidence_links del tipo dado
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Status = "pass" | "warn" | "fail" | "na" | "pending";

interface Rule {
  id: string;
  standard: string;
  rule_code: string;
  section_no: number | null;
  title: string;
  severity: string; // mandatory | recommended | conditional
  evaluator_type: string;
  evaluator_config: Record<string, unknown> | null;
}

interface Report {
  id: string;
  project_id: string;
  active_standards: string[] | null;
  compliance_threshold: number | null;
}

interface Evaluation {
  rule_id: string;
  status: Status;
  score: number;
  auto_evaluated: boolean;
  evaluator_notes: string | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "POST required" }), {
      status: 405,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  try {
    const { report_id, standards } = await req.json();
    if (!report_id) {
      return new Response(JSON.stringify({ error: "report_id required" }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // 1) Carga reporte + estándares activos
    const { data: report, error: rErr } = await admin
      .from("technical_reports")
      .select("id, project_id, active_standards, compliance_threshold")
      .eq("id", report_id)
      .maybeSingle<Report>();
    if (rErr) throw rErr;
    if (!report) {
      return new Response(JSON.stringify({ error: "report_not_found" }), {
        status: 404,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const activeStandards = (standards && standards.length
      ? standards
      : report.active_standards) ?? ["ni43101"];
    const threshold = report.compliance_threshold ?? 95;

    // 2) Reglas aplicables
    const { data: rules, error: rulesErr } = await admin
      .from("compliance_rules")
      .select(
        "id, standard, rule_code, section_no, title, severity, evaluator_type, evaluator_config",
      )
      .in("standard", activeStandards)
      .order("display_order");
    if (rulesErr) throw rulesErr;
    const ruleList = (rules ?? []) as Rule[];

    // 3) Carga evaluaciones existentes (para preservar manuales)
    const { data: existing } = await admin
      .from("compliance_evaluations")
      .select("rule_id, status, score, auto_evaluated, evaluator_notes")
      .eq("report_id", report_id);
    const existingMap = new Map<string, Evaluation>();
    for (const e of (existing ?? []) as Evaluation[]) existingMap.set(e.rule_id, e);

    // 4) Carga evidencia para evaluators auto_evidence
    const { data: evidence } = await admin
      .from("report_evidence_links")
      .select("rule_id, evidence_type")
      .eq("report_id", report_id);
    const evidenceByRule = new Map<string, { type: string }[]>();
    for (const ev of evidence ?? []) {
      const arr = evidenceByRule.get(ev.rule_id) ?? [];
      arr.push({ type: ev.evidence_type });
      evidenceByRule.set(ev.rule_id, arr);
    }

    // 5) Evalúa cada regla
    const upserts: Evaluation[] = [];
    const blocking: { rule_code: string; title: string; severity: string }[] = [];
    const warnings: { rule_code: string; title: string }[] = [];

    const projectFilter = (cfg: Record<string, unknown>): boolean => cfg?.project_scope !== false;

    for (const rule of ruleList) {
      const prev = existingMap.get(rule.id);
      let result: { status: Status; score: number; notes: string | null; auto: boolean };

      if (rule.evaluator_type === "manual") {
        // Conserva manual previa o marca pending
        result = prev
          ? {
              status: prev.status,
              score: prev.score ?? 0,
              notes: prev.evaluator_notes,
              auto: false,
            }
          : {
              status: "pending",
              score: 0,
              notes: "Pendiente de revisión manual del QP",
              auto: false,
            };
      } else if (rule.evaluator_type === "auto_count") {
        const cfg = rule.evaluator_config ?? {};
        const table = cfg.table as string;
        const minCount = (cfg.min_count as number) ?? 1;
        let count = 0;
        if (table) {
          let q = admin.from(table).select("id", { count: "exact", head: true });
          if (projectFilter(cfg)) q = q.eq("project_id", report.project_id);
          if (cfg.where) {
            for (const [k, v] of Object.entries(cfg.where)) q = q.eq(k, v as unknown);
          }
          const { count: c } = await q;
          count = c ?? 0;
        }
        const pass = count >= minCount;
        result = {
          status: pass ? "pass" : "fail",
          score: pass ? 100 : 0,
          notes: `${count}/${minCount} registros encontrados`,
          auto: true,
        };
      } else if (rule.evaluator_type === "auto_field") {
        const cfg = rule.evaluator_config ?? {};
        const table = cfg.table as string;
        const field = cfg.field as string;
        const refId =
          cfg.ref === "report" ? report.id : cfg.ref === "project" ? report.project_id : null;
        const refField = cfg.ref === "report" ? "id" : "id";
        let ok = false;
        let val = null;
        if (table && field && refId) {
          const { data } = await admin.from(table).select(field).eq(refField, refId).maybeSingle();
          val = (data as any)?.[field];
          ok = val !== null && val !== undefined && val !== "";
        }
        result = {
          status: ok ? "pass" : "fail",
          score: ok ? 100 : 0,
          notes: ok ? `Campo ${field} = ${String(val).slice(0, 60)}` : `Falta ${field}`,
          auto: true,
        };
      } else if (rule.evaluator_type === "auto_evidence") {
        const cfg = rule.evaluator_config ?? {};
        const minCount = (cfg.min_count as number) ?? 1;
        const evType = cfg.evidence_type as string | undefined;
        const links = evidenceByRule.get(rule.id) ?? [];
        const matching = evType ? links.filter((l) => l.type === evType) : links;
        const pass = matching.length >= minCount;
        result = {
          status: pass ? "pass" : "fail",
          score: pass ? 100 : 0,
          notes: `${matching.length}/${minCount} evidencias adjuntas`,
          auto: true,
        };
      } else {
        result = { status: "pending", score: 0, notes: "Evaluator desconocido", auto: false };
      }

      upserts.push({
        report_id,
        project_id: report.project_id,
        rule_id: rule.id,
        status: result.status,
        score: result.score,
        auto_evaluated: result.auto,
        evaluator_notes: result.notes,
        evaluated_at: new Date().toISOString(),
      });

      if (result.status === "fail" && rule.severity === "mandatory") {
        blocking.push({ rule_code: rule.rule_code, title: rule.title, severity: rule.severity });
      } else if (result.status === "fail" || result.status === "warn") {
        warnings.push({ rule_code: rule.rule_code, title: rule.title });
      }
    }

    // 6) Persiste evaluaciones
    if (upserts.length) {
      const { error: upErr } = await admin
        .from("compliance_evaluations")
        .upsert(upserts, { onConflict: "report_id,rule_id" });
      if (upErr) throw upErr;
    }

    // 7) Calcula scores por estándar
    const byStandard: Record<
      string,
      {
        score: number;
        status: string;
        mandatory_pass: number;
        mandatory_total: number;
        rules_total: number;
      }
    > = {};
    for (const std of activeStandards) {
      const stdRules = ruleList.filter((r) => r.standard === std);
      let weightedScore = 0;
      let weightTotal = 0;
      let mandPass = 0;
      let mandTotal = 0;
      for (const rule of stdRules) {
        const ev = upserts.find((u) => u.rule_id === rule.id);
        if (!ev) continue;
        const w = rule.severity === "mandatory" ? 1.0 : rule.severity === "recommended" ? 0.3 : 0.1;
        weightTotal += w;
        if (ev.status === "pass") weightedScore += w;
        else if (ev.status === "warn") weightedScore += w * 0.5;
        if (rule.severity === "mandatory") {
          mandTotal += 1;
          if (ev.status === "pass") mandPass += 1;
        }
      }
      const score = weightTotal > 0 ? Math.round((weightedScore / weightTotal) * 100) : 0;
      byStandard[std] = {
        score,
        status: score >= threshold ? "compliant" : score >= 70 ? "partial" : "non_compliant",
        mandatory_pass: mandPass,
        mandatory_total: mandTotal,
        rules_total: stdRules.length,
      };
    }

    // 8) Score global = promedio de estándares
    const stdScores = Object.values(byStandard).map((s) => s.score);
    const globalScore = stdScores.length
      ? Math.round(stdScores.reduce((a, b) => a + b, 0) / stdScores.length)
      : 0;

    // 9) Cachea en technical_reports
    await admin
      .from("technical_reports")
      .update({
        compliance_score_cached: globalScore,
        compliance_evaluated_at: new Date().toISOString(),
      })
      .eq("id", report_id);

    return new Response(
      JSON.stringify({
        report_id,
        by_standard: byStandard,
        global_score: globalScore,
        threshold,
        is_blocking: globalScore < threshold || blocking.length > 0,
        blocking_failures: blocking,
        warnings,
        evaluated_count: upserts.length,
      }),
      { status: 200, headers: { ...cors, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("evaluate-compliance error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
