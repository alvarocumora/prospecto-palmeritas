import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

export const Route = createFileRoute("/api/public/verify-compliance/$reportId")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const reportId = params.reportId;
        const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
        const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!url || !key) {
          return new Response(
            JSON.stringify({ ok: false, error: "server_misconfigured" }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
        const sb = createClient(url, key, { auth: { persistSession: false } });

        const { data: report, error } = await sb
          .from("technical_reports")
          .select("id, project_id, title, version, active_standards, compliance_threshold, compliance_score_cached, compliance_evaluated_at, status")
          .eq("id", reportId)
          .maybeSingle();

        if (error || !report) {
          return new Response(
            JSON.stringify({ ok: false, error: "report_not_found" }),
            { status: 404, headers: { "Content-Type": "application/json" } },
          );
        }

        const { data: project } = await sb
          .from("projects")
          .select("name, code")
          .eq("id", report.project_id)
          .maybeSingle();

        const { data: rules } = await sb
          .from("compliance_rules")
          .select("id, standard, rule_code, title, severity")
          .in("standard", report.active_standards ?? ["ni43101"]);

        const { data: evals } = await sb
          .from("compliance_evaluations")
          .select("rule_id, status, score, auto_evaluated, evaluated_at")
          .eq("report_id", reportId);

        const evalMap = new Map((evals ?? []).map((e) => [e.rule_id, e]));
        const byStandard: Record<string, { total: number; pass: number; warn: number; fail: number; pending: number; mandatory_pass: number; mandatory_total: number }> = {};
        for (const r of rules ?? []) {
          const std = r.standard;
          byStandard[std] ??= { total: 0, pass: 0, warn: 0, fail: 0, pending: 0, mandatory_pass: 0, mandatory_total: 0 };
          const ev = evalMap.get(r.id);
          byStandard[std].total += 1;
          const st = ev?.status ?? "pending";
          if (st === "pass") byStandard[std].pass += 1;
          else if (st === "warn") byStandard[std].warn += 1;
          else if (st === "fail") byStandard[std].fail += 1;
          else byStandard[std].pending += 1;
          if (r.severity === "mandatory") {
            byStandard[std].mandatory_total += 1;
            if (st === "pass") byStandard[std].mandatory_pass += 1;
          }
        }

        const score = report.compliance_score_cached ?? 0;
        const threshold = report.compliance_threshold ?? 95;
        const verified = score >= threshold;

        return new Response(
          JSON.stringify({
            ok: true,
            verified,
            report: {
              id: report.id,
              title: report.title,
              version: report.version,
              status: report.status,
              project_name: project?.name,
              project_code: project?.code,
            },
            compliance: {
              global_score: score,
              threshold,
              evaluated_at: report.compliance_evaluated_at,
              active_standards: report.active_standards,
              by_standard: byStandard,
            },
            verification: {
              method: "automated_evaluation",
              issued_at: new Date().toISOString(),
              verifier: "GeoCapitals Compliance Engine",
            },
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              "Cache-Control": "public, max-age=60",
              "Access-Control-Allow-Origin": "*",
            },
          },
        );
      },
    },
  },
});
