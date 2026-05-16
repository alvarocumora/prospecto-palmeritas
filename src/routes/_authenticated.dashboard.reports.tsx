import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useProjects } from "@/hooks/useProjects";
import { useProjectRole, canAccess } from "@/hooks/useProjectRole";
import { useHse } from "@/hooks/useHse";
import { generateMonthlyReport, type MonthlyReportInput } from "@/lib/pdf/monthly-report";
import { FileText, Download } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard/reports")({
  component: ReportsPage,
});

function ReportsPage() {
  const { active } = useProjects();
  const role = useProjectRole();
  const allowed = canAccess(role, "reports");
  const projectId = active?.id ?? null;
  const hse = useHse(projectId);

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth()); // 0-indexed
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const range = useMemo(() => {
    const start = new Date(year, month, 1);
    const end = new Date(year, month + 1, 0, 23, 59, 59);
    const monthName = start.toLocaleDateString("es-CL", { month: "long", year: "numeric" });
    return {
      start,
      end,
      label: monthName.charAt(0).toUpperCase() + monthName.slice(1),
      startISO: start.toISOString(),
      endISO: end.toISOString(),
      startDate: start.toISOString().slice(0, 10),
      endDate: end.toISOString().slice(0, 10),
    };
  }, [year, month]);

  if (!projectId || !active)
    return <div className="p-6 text-sm text-muted-foreground">Selecciona un proyecto.</div>;
  if (!allowed)
    return <div className="p-6 text-sm text-muted-foreground">No tienes acceso a Reportes.</div>;

  const handleGenerate = async () => {
    setBusy(true);
    setError(null);
    try {
      const [holes, samples, qaqc, logs, targets, expenses, budgets] = await Promise.all([
        supabase
          .from("drill_holes")
          .select("id,actual_depth,started_at,completed_at")
          .eq("project_id", projectId),
        supabase
          .from("sampling_results")
          .select("id,au_gpt,record_status,created_at")
          .eq("project_id", projectId)
          .gte("created_at", range.startISO)
          .lte("created_at", range.endISO),
        supabase
          .from("qaqc_results")
          .select("status,created_at")
          .eq("project_id", projectId)
          .gte("created_at", range.startISO)
          .lte("created_at", range.endISO),
        supabase
          .from("drill_core_logs")
          .select("hole_id,depth_from,depth_to,au_gpt,record_status,created_at")
          .eq("project_id", projectId)
          .gte("created_at", range.startISO)
          .lte("created_at", range.endISO),
        supabase.from("exploration_targets").select("stage").eq("project_id", projectId),
        supabase
          .from("campaign_expenses")
          .select("category,amount_usd,meters_drilled,status,expense_date")
          .eq("project_id", projectId)
          .gte("expense_date", range.startDate)
          .lte("expense_date", range.endDate),
        supabase
          .from("campaign_budgets")
          .select("category,planned_amount_usd")
          .eq("project_id", projectId),
      ]);

      // KPIs
      const inMonthHoles = (holes.data ?? []).filter(
        (h: { completed_at: string | null; started_at: string | null }) => {
          const d = h.completed_at || h.started_at;
          if (!d) return false;
          const t = new Date(d).getTime();
          return t >= range.start.getTime() && t <= range.end.getTime();
        },
      );
      const metersDrilled = inMonthHoles.reduce(
        (s, h: { actual_depth: number | null }) => s + (Number(h.actual_depth) || 0),
        0,
      );
      const auVals = (samples.data ?? [])
        .map((s: { au_gpt: number | null }) => Number(s.au_gpt))
        .filter((v) => !isNaN(v) && v > 0);
      const auAvg = auVals.length ? auVals.reduce((a, b) => a + b, 0) / auVals.length : null;
      const interceptCount = (logs.data ?? []).filter(
        (l: { au_gpt: number | null }) => Number(l.au_gpt) >= 0.5,
      ).length;

      // QA/QC
      const qaRows = qaqc.data ?? [];
      const qaSummary = {
        total: qaRows.length,
        pass: qaRows.filter((r: { status: string }) => r.status === "pass").length,
        warn: qaRows.filter((r: { status: string }) => r.status === "warn").length,
        fail: qaRows.filter((r: { status: string }) => r.status === "fail").length,
      };

      // Approvals (logs + samples in range)
      const allRecs = [...(logs.data ?? []), ...(samples.data ?? [])] as {
        record_status?: string;
      }[];
      const approvals = {
        draft: allRecs.filter((r) => r.record_status === "draft").length,
        review: allRecs.filter((r) => r.record_status === "review").length,
        approved: allRecs.filter((r) => r.record_status === "approved").length,
      };

      // Targets pipeline (cumulative)
      const tStages = (targets.data ?? []) as { stage: string }[];
      const targetsSummary = {
        generated: tStages.filter((t) => t.stage === "generated").length,
        validated: tStages.filter((t) => t.stage === "validated").length,
        drillReady: tStages.filter((t) => t.stage === "drill_ready").length,
        drilled: tStages.filter((t) => t.stage === "drilled").length,
        closed: tStages.filter((t) => t.stage === "closed").length,
      };

      // Budget vs actual
      const exps = (expenses.data ?? []) as {
        category: string;
        amount_usd: number;
        meters_drilled: number | null;
        status: string;
      }[];
      const buds = (budgets.data ?? []) as { category: string; planned_amount_usd: number }[];
      const approvedExps = exps.filter((e) => e.status === "approved");
      const totalCost = approvedExps.reduce((s, e) => s + Number(e.amount_usd || 0), 0);
      const drillingMeters = approvedExps
        .filter((e) => e.category === "drilling")
        .reduce((s, e) => s + Number(e.meters_drilled || 0), 0);
      const drillingCost = approvedExps
        .filter((e) => e.category === "drilling")
        .reduce((s, e) => s + Number(e.amount_usd || 0), 0);
      const costPerMeter = drillingMeters > 0 ? drillingCost / drillingMeters : null;

      const cats = Array.from(
        new Set([...buds.map((b) => b.category), ...exps.map((e) => e.category)]),
      );
      const byCategory = cats.map((category) => ({
        category,
        planned: buds
          .filter((b) => b.category === category)
          .reduce((s, b) => s + Number(b.planned_amount_usd || 0), 0),
        actual: approvedExps
          .filter((e) => e.category === category)
          .reduce((s, e) => s + Number(e.amount_usd || 0), 0),
      }));
      const totalPlanned = byCategory.reduce((s, c) => s + c.planned, 0);

      // Top intercepts (need hole codes)
      const holeMap = new Map<string, string>();
      (holes.data ?? []).forEach((h: { id: string }) => holeMap.set(h.id, h.id));
      const { data: holeCodes } = await supabase
        .from("drill_holes")
        .select("id,hole_id")
        .in(
          "id",
          Array.from(new Set((logs.data ?? []).map((l: { hole_id: string }) => l.hole_id))),
        );
      (holeCodes ?? []).forEach((h: { id: string; hole_id: string }) =>
        holeMap.set(h.id, h.hole_id),
      );

      const topIntercepts = (logs.data ?? [])
        .filter((l: { au_gpt: number | null }) => Number(l.au_gpt) >= 0.5)
        .sort(
          (a: { au_gpt: number | null }, b: { au_gpt: number | null }) =>
            Number(b.au_gpt) - Number(a.au_gpt),
        )
        .slice(0, 5)
        .map(
          (l: {
            hole_id: string;
            depth_from: number;
            depth_to: number;
            au_gpt: number | null;
          }) => ({
            hole: holeMap.get(l.hole_id) ?? l.hole_id.slice(0, 8),
            from: Number(l.depth_from),
            to: Number(l.depth_to),
            au: l.au_gpt != null ? Number(l.au_gpt) : null,
          }),
        );

      // HSE summary scoped to month for community events; permits/incidents use current state
      const eventsInRange = hse.events.filter(
        (e) => e.event_date >= range.startDate && e.event_date <= range.endDate,
      );
      const input: MonthlyReportInput = {
        projectName: active.name,
        projectCode: active.code,
        monthLabel: range.label,
        startDate: range.startDate,
        endDate: range.endDate,
        kpis: {
          metersDrilled,
          samplesAnalyzed: (samples.data ?? []).length,
          auAvg,
          interceptCount,
          totalCost,
          costPerMeter,
        },
        qaqc: qaSummary,
        approvals,
        targets: targetsSummary,
        budget: { planned: totalPlanned, actual: totalCost, byCategory },
        topIntercepts,
        hse: {
          activePermits: hse.permits.filter((p) => p.status === "active").length,
          expiringPermits: hse.expiringPermits.length,
          openIncidents: hse.openIncidents.length,
          communityEvents: eventsInRange.length,
        },
      };

      const doc = generateMonthlyReport(input);
      doc.save(`reporte-${active.code}-${year}-${String(month + 1).padStart(2, "0")}.pdf`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error generando reporte";
      setError(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-3xl mx-auto">
      <header>
        <h1 className="text-xl font-mono font-bold flex items-center gap-2">
          <FileText className="w-5 h-5 text-gold" /> Reportes Ejecutivos
        </h1>
        <p className="text-xs text-muted-foreground font-mono">
          Snapshot mensual con KPIs, QA/QC, targets, costos y HSE
        </p>
      </header>

      <div className="p-5 rounded border border-border bg-bg-secondary space-y-4">
        <div>
          <h2 className="text-sm font-mono font-bold mb-2">Generar reporte mensual</h2>
          <p className="text-xs text-muted-foreground font-mono">
            Período seleccionado: <span className="text-foreground">{range.label}</span>
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] uppercase font-mono text-muted-foreground block mb-1">
              Mes
            </label>
            <select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className="w-full px-2 py-1.5 rounded border border-border bg-background text-xs font-mono"
            >
              {Array.from({ length: 12 }, (_, i) => i).map((m) => (
                <option key={m} value={m}>
                  {new Date(2000, m, 1).toLocaleDateString("es-CL", { month: "long" })}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] uppercase font-mono text-muted-foreground block mb-1">
              Año
            </label>
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="w-full px-2 py-1.5 rounded border border-border bg-background text-xs font-mono"
            >
              {Array.from({ length: 5 }, (_, i) => now.getFullYear() - i).map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
        </div>

        <button
          onClick={handleGenerate}
          disabled={busy}
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded bg-gold text-bg-secondary font-mono text-sm hover:bg-gold/90 disabled:opacity-50"
        >
          <Download className="w-4 h-4" /> {busy ? "Generando…" : "Generar PDF"}
        </button>

        {error && <div className="text-xs text-destructive font-mono">{error}</div>}
      </div>

      <div className="p-4 rounded border border-border bg-bg-secondary text-xs font-mono text-muted-foreground space-y-1">
        <div className="font-bold text-foreground mb-1">Contenido del reporte:</div>
        <div>• Portada con KPIs principales del mes</div>
        <div>• Resumen ejecutivo</div>
        <div>• Gobernanza: QA/QC y workflow de aprobaciones</div>
        <div>• Pipeline de targets exploratorios</div>
        <div>• Control financiero: presupuesto vs real por categoría</div>
        <div>• Top 5 interceptos del período</div>
        <div>• Cumplimiento HSE: permisos, incidentes y comunidad</div>
      </div>
    </div>
  );
}
