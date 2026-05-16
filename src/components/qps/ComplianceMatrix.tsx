import { useState } from "react";
import { useCompliance, type ComplianceStandard, type EvalStatus } from "@/hooks/useCompliance";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  ChevronDown,
  ChevronRight,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Circle,
  Minus,
  Paperclip,
  Lock,
  ShieldCheck,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { EvidenceDrawer } from "./EvidenceDrawer";

const STANDARD_LABELS: Record<ComplianceStandard, string> = {
  ni43101: "NI 43-101",
  jorc2012: "JORC 2012",
  samrec: "SAMREC",
  perc: "PERC",
  gkz: "GKZ (RU)",
};

const STATUS_META: Record<EvalStatus, { label: string; color: string; Icon: typeof Circle }> = {
  pass: { label: "OK", color: "text-emerald-500", Icon: CheckCircle2 },
  warn: { label: "Advertencia", color: "text-amber-500", Icon: AlertTriangle },
  fail: { label: "Falla", color: "text-rose-500", Icon: XCircle },
  na: { label: "N/A", color: "text-muted-foreground", Icon: Minus },
  pending: { label: "Pendiente", color: "text-sky-400", Icon: Circle },
};

const ALL_STANDARDS: ComplianceStandard[] = ["ni43101", "jorc2012", "samrec", "perc", "gkz"];

export function ComplianceMatrix({ reportId }: { reportId: string }) {
  const c = useCompliance(reportId);
  const [filter, setFilter] = useState<"all" | "fails" | "mandatory">("all");
  const [openSections, setOpenSections] = useState<Set<number>>(new Set());
  const [evidenceTarget, setEvidenceTarget] = useState<{
    ruleId: string;
    ruleCode: string;
    title: string;
  } | null>(null);

  const toggleSection = (n: number) => {
    const next = new Set(openSections);
    if (next.has(n)) next.delete(n);
    else next.add(n);
    setOpenSections(next);
  };

  if (c.loading)
    return <div className="p-6 text-sm text-muted-foreground">Cargando matriz de compliance…</div>;

  // Agrupa por (standard, section_no)
  const filtered = c.rules.filter((r) => {
    const ev = c.evaluations.find((e) => e.rule_id === r.id);
    if (filter === "fails") return ev?.status === "fail" || ev?.status === "warn";
    if (filter === "mandatory") return r.severity === "mandatory";
    return true;
  });

  const grouped = new Map<string, typeof c.rules>();
  for (const r of filtered) {
    const key = `${r.standard}::§${r.section_no ?? 0}`;
    const arr = grouped.get(key) ?? [];
    arr.push(r);
    grouped.set(key, arr);
  }

  return (
    <div className="space-y-4">
      {/* Header: estándares + umbral + acción */}
      <div className="rounded-lg border border-border bg-card p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2 justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-sm">Compliance Engine</h3>
          </div>
          <Button size="sm" onClick={c.evaluate} disabled={c.evaluating}>
            <RefreshCw className={cn("w-3.5 h-3.5 mr-1.5", c.evaluating && "animate-spin")} />
            {c.evaluating ? "Evaluando…" : "Re-evaluar"}
          </Button>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {ALL_STANDARDS.map((std) => {
            const active = c.activeStandards.includes(std);
            return (
              <button
                key={std}
                onClick={() => c.toggleStandard(std)}
                className={cn(
                  "px-2.5 py-1 text-xs rounded-md font-mono transition-colors",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80",
                )}
              >
                {STANDARD_LABELS[std]}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-3 text-xs">
          <label className="text-muted-foreground">Umbral firma:</label>
          <input
            type="number"
            min={0}
            max={100}
            value={c.threshold}
            onChange={(e) => c.updateThreshold(Number(e.target.value))}
            className="w-16 px-2 py-1 rounded border border-border bg-background font-mono"
          />
          <span className="text-muted-foreground">%</span>
        </div>
      </div>

      {/* Score cards por estándar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {c.activeStandards.map((std) => {
          const s = c.scoreByStandard[std];
          if (!s) return null;
          const color =
            s.score >= c.threshold
              ? "text-emerald-500"
              : s.score >= 70
                ? "text-amber-500"
                : "text-rose-500";
          return (
            <div key={std} className="rounded-lg border border-border bg-card p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-mono text-muted-foreground">
                  {STANDARD_LABELS[std]}
                </span>
                <span className={cn("text-2xl font-bold tabular-nums", color)}>{s.score}%</span>
              </div>
              <Progress value={s.score} className="h-1.5" />
              <div className="mt-2 text-[10px] font-mono text-muted-foreground flex justify-between">
                <span>
                  Obligatorios {s.mandatory_pass}/{s.mandatory_total}
                </span>
                <span>{s.rules_total} ítems</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Banner global */}
      {c.isBlocking ? (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 flex items-start gap-3">
          <Lock className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
          <div className="flex-1 text-xs">
            <div className="font-semibold text-rose-400">Firma bloqueada</div>
            <div className="text-muted-foreground mt-0.5">
              Compliance global {c.globalScore}% &lt; umbral {c.threshold}%. Cierra los ítems
              obligatorios pendientes para habilitar la firma.
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 flex items-center gap-3">
          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          <div className="text-xs font-semibold text-emerald-400">
            Compliance OK · {c.globalScore}% — Firma habilitada
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="flex gap-1.5 text-xs">
        {(["all", "mandatory", "fails"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "px-2.5 py-1 rounded-md font-mono",
              filter === f
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80",
            )}
          >
            {f === "all" ? "Todos" : f === "mandatory" ? "Solo obligatorios" : "Solo fallas"}
          </button>
        ))}
        <span className="ml-auto text-muted-foreground">{filtered.length} reglas</span>
      </div>

      {/* Matriz colapsable por sección */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        {[...grouped.entries()].map(([key, rls]) => {
          const [std, sec] = key.split("::");
          const sectionNo = parseInt(sec.replace("§", ""), 10) || 0;
          const expanded = openSections.has(sectionNo);
          const failures = rls.filter((r) => {
            const ev = c.evaluations.find((e) => e.rule_id === r.id);
            return ev?.status === "fail" || ev?.status === "pending";
          }).length;
          return (
            <div key={key} className="border-b border-border last:border-b-0">
              <button
                onClick={() => toggleSection(sectionNo)}
                className="w-full px-3 py-2 flex items-center gap-2 hover:bg-muted/30 text-left"
              >
                {expanded ? (
                  <ChevronDown className="w-3.5 h-3.5" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5" />
                )}
                <Badge variant="outline" className="font-mono text-[10px]">
                  {STANDARD_LABELS[std as ComplianceStandard]}
                </Badge>
                <span className="text-xs font-mono">§{sectionNo}</span>
                <span className="text-xs text-muted-foreground">· {rls.length} ítems</span>
                {failures > 0 && (
                  <Badge variant="destructive" className="ml-auto text-[10px]">
                    {failures} pendientes
                  </Badge>
                )}
              </button>
              {expanded && (
                <div className="divide-y divide-border bg-background/40">
                  {rls.map((rule) => {
                    const ev = c.evaluations.find((e) => e.rule_id === rule.id);
                    const status: EvalStatus = ev?.status ?? "pending";
                    const meta = STATUS_META[status];
                    const evCount = c.evidence.filter((x) => x.rule_id === rule.id).length;
                    return (
                      <div key={rule.id} className="px-4 py-2.5">
                        <div className="flex items-start gap-3">
                          <meta.Icon className={cn("w-4 h-4 shrink-0 mt-0.5", meta.color)} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[10px] font-mono text-muted-foreground">
                                {rule.rule_code}
                              </span>
                              {rule.severity === "mandatory" && (
                                <Badge
                                  variant="outline"
                                  className="text-[9px] h-4 border-rose-500/40 text-rose-400"
                                >
                                  obligatorio
                                </Badge>
                              )}
                              {rule.severity === "recommended" && (
                                <Badge variant="outline" className="text-[9px] h-4">
                                  recomendado
                                </Badge>
                              )}
                              <Badge variant="secondary" className="text-[9px] h-4">
                                {rule.evaluator_type}
                              </Badge>
                            </div>
                            <div className="text-sm font-medium mt-0.5">{rule.title}</div>
                            {rule.description && (
                              <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                                {rule.description}
                              </div>
                            )}
                            {ev?.evaluator_notes && (
                              <div className="text-[11px] font-mono text-muted-foreground/80 mt-1 italic">
                                {ev.evaluator_notes}
                              </div>
                            )}
                            <div className="flex items-center gap-2 mt-2">
                              <button
                                onClick={() =>
                                  setEvidenceTarget({
                                    ruleId: rule.id,
                                    ruleCode: rule.rule_code,
                                    title: rule.title,
                                  })
                                }
                                className="text-[11px] font-mono inline-flex items-center gap-1 px-2 py-0.5 rounded border border-border hover:bg-muted"
                              >
                                <Paperclip className="w-3 h-3" /> Evidencia ({evCount})
                              </button>
                              {rule.evaluator_type === "manual" && (
                                <>
                                  <button
                                    onClick={() => c.markManual(rule.id, "pass")}
                                    className="text-[11px] font-mono px-2 py-0.5 rounded border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                                  >
                                    Pass
                                  </button>
                                  <button
                                    onClick={() => c.markManual(rule.id, "warn")}
                                    className="text-[11px] font-mono px-2 py-0.5 rounded border border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                                  >
                                    Warn
                                  </button>
                                  <button
                                    onClick={() => c.markManual(rule.id, "fail")}
                                    className="text-[11px] font-mono px-2 py-0.5 rounded border border-rose-500/30 text-rose-400 hover:bg-rose-500/10"
                                  >
                                    Fail
                                  </button>
                                  <button
                                    onClick={() => c.markManual(rule.id, "na")}
                                    className="text-[11px] font-mono px-2 py-0.5 rounded border border-border text-muted-foreground hover:bg-muted"
                                  >
                                    N/A
                                  </button>
                                </>
                              )}
                              {rule.reference_url && (
                                <a
                                  href={rule.reference_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-[11px] font-mono inline-flex items-center gap-1 ml-auto text-sky-400 hover:underline"
                                >
                                  Ref <ExternalLink className="w-3 h-3" />
                                </a>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
        {grouped.size === 0 && (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            No hay reglas que coincidan con el filtro.
          </div>
        )}
      </div>

      {evidenceTarget && (
        <EvidenceDrawer
          reportId={reportId}
          ruleId={evidenceTarget.ruleId}
          ruleCode={evidenceTarget.ruleCode}
          ruleTitle={evidenceTarget.title}
          evidence={c.evidence.filter((e) => e.rule_id === evidenceTarget.ruleId)}
          onAttach={c.attachEvidence}
          onRemove={c.removeEvidence}
          onClose={() => setEvidenceTarget(null)}
        />
      )}
    </div>
  );
}
