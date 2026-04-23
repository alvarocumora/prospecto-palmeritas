import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { RefreshCw, Loader2, CheckCircle2, AlertTriangle, XCircle, Database, ShieldAlert, FileWarning } from "lucide-react";
import { useProjects } from "@/hooks/useProjects";
import { useDataValidation, type TableAudit, type Inconsistency } from "@/hooks/useDataValidation";
import { HudPanel } from "@/components/ops/HudPanel";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dashboard/validation")({
  component: ValidationPage,
});

function ValidationPage() {
  const { active } = useProjects();
  const { report, loading, refresh } = useDataValidation(active?.id ?? null);
  const [filter, setFilter] = useState<"all" | "issues">("all");

  const grouped = useMemo(() => {
    if (!report) return {} as Record<string, TableAudit[]>;
    const list = filter === "issues"
      ? report.tables.filter((t) => t.status !== "ok")
      : report.tables;
    return list.reduce<Record<string, TableAudit[]>>((acc, t) => {
      (acc[t.group] ??= []).push(t);
      return acc;
    }, {});
  }, [report, filter]);

  return (
    <div className="px-3 md:px-6 py-4 max-w-[1400px] mx-auto space-y-4">
      <header className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="text-[10px] font-mono text-text-dim uppercase tracking-wider">QA · Data Integrity</div>
          <h1 className="text-xl font-mono font-bold text-foreground">Validación & Sync Status</h1>
          <p className="text-[11px] text-text-dim mt-1">
            Audita el estado del seed por tabla, detecta inconsistencias en enums, claves únicas y referencias.
          </p>
        </div>
        <button
          onClick={refresh}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[2px] border border-signal-cyan/40 bg-signal-cyan/10 text-signal-cyan text-[11px] font-mono uppercase hover:bg-signal-cyan/20 disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          Re-ejecutar audit
        </button>
      </header>

      {!active && (
        <div className="p-6 border border-border rounded-[2px] bg-bg-panel/40 text-center text-[12px] font-mono text-text-dim">
          Selecciona un proyecto para auditar sus tablas.
        </div>
      )}

      {active && report && (
        <>
          {/* Summary stats */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            <StatCard label="Tablas OK" value={report.totals.ok} tone="ok" Icon={CheckCircle2} />
            <StatCard label="Vacías" value={report.totals.empty} tone="dim" Icon={Database} />
            <StatCard label="Warnings" value={report.totals.warn} tone="warn" Icon={AlertTriangle} />
            <StatCard label="Errores" value={report.totals.error} tone="crit" Icon={XCircle} />
            <StatCard label="Total filas" value={report.totals.rows} tone="cyan" Icon={Database} />
          </div>

          {/* Inconsistencies */}
          <HudPanel title="Inconsistencias detectadas" accent="amber" className="bg-bg-panel/40">
            {report.inconsistencies.length === 0 ? (
              <div className="p-4 text-center">
                <CheckCircle2 className="w-6 h-6 mx-auto text-signal-green mb-2" />
                <div className="text-[11px] font-mono text-text-dim">
                  Sin inconsistencias detectadas. Stages, enums y claves únicas en orden.
                </div>
              </div>
            ) : (
              <div className="border border-border rounded-[2px] divide-y divide-border">
                {report.inconsistencies.map((iss) => (
                  <IncRow key={iss.id} iss={iss} />
                ))}
              </div>
            )}
          </HudPanel>

          {/* Tables audit */}
          <HudPanel
            title={`Estado por tabla · ${active.name ?? active.id.slice(0, 8)}`}
            accent="cyan"
            className="bg-bg-panel/40"
          >
            <div className="flex items-center gap-2 mb-3">
              <button
                onClick={() => setFilter("all")}
                className={cn(
                  "px-2 py-1 text-[10px] font-mono uppercase rounded-[2px] border",
                  filter === "all" ? "border-signal-cyan/60 bg-signal-cyan/15 text-signal-cyan" : "border-border text-text-dim",
                )}
              >
                Todas ({report.tables.length})
              </button>
              <button
                onClick={() => setFilter("issues")}
                className={cn(
                  "px-2 py-1 text-[10px] font-mono uppercase rounded-[2px] border",
                  filter === "issues" ? "border-signal-amber/60 bg-signal-amber/15 text-signal-amber" : "border-border text-text-dim",
                )}
              >
                Solo issues ({report.totals.warn + report.totals.empty + report.totals.error})
              </button>
              <div className="ml-auto text-[10px] font-mono text-text-dim">
                Generado: {new Date(report.generatedAt).toLocaleTimeString("es-CL")}
              </div>
            </div>

            <div className="space-y-3">
              {Object.entries(grouped).map(([group, list]) => (
                <div key={group}>
                  <div className="text-[10px] font-mono text-text-dim uppercase tracking-wider mb-1.5">{group}</div>
                  <div className="border border-border rounded-[2px] divide-y divide-border">
                    {list.map((t) => <TableRow key={t.table} audit={t} />)}
                  </div>
                </div>
              ))}
              {Object.keys(grouped).length === 0 && (
                <div className="p-4 text-center text-[11px] font-mono text-text-dim">
                  Todo limpio. No hay tablas con issues.
                </div>
              )}
            </div>
          </HudPanel>
        </>
      )}

      {loading && !report && (
        <div className="p-8 text-center text-[11px] font-mono text-text-dim">
          <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
          Auditando tablas…
        </div>
      )}
    </div>
  );
}

function StatCard({
  label, value, tone, Icon,
}: {
  label: string;
  value: number;
  tone: "ok" | "warn" | "crit" | "cyan" | "dim";
  Icon: typeof CheckCircle2;
}) {
  const toneCls: Record<typeof tone, string> = {
    ok: "border-signal-green/40 bg-signal-green/5 text-signal-green",
    warn: "border-signal-amber/40 bg-signal-amber/5 text-signal-amber",
    crit: "border-signal-red/40 bg-signal-red/5 text-signal-red",
    cyan: "border-signal-cyan/40 bg-signal-cyan/5 text-signal-cyan",
    dim: "border-border bg-bg-panel/40 text-text-dim",
  };
  return (
    <div className={cn("border rounded-[2px] p-2.5", toneCls[tone])}>
      <div className="flex items-center gap-1.5">
        <Icon className="w-3 h-3" />
        <span className="text-[9px] font-mono uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-2xl font-mono font-bold mt-1 tabular-nums">{value.toLocaleString()}</div>
    </div>
  );
}

function TableRow({ audit }: { audit: TableAudit }) {
  const dotCls =
    audit.status === "ok" ? "bg-signal-green" :
    audit.status === "warn" ? "bg-signal-amber" :
    audit.status === "error" ? "bg-signal-red" : "bg-text-dim/50";
  const statusLabel =
    audit.status === "ok" ? "OK" :
    audit.status === "empty" ? "VACÍA" :
    audit.status === "warn" ? "BAJO MIN" : "ERROR";
  const statusCls =
    audit.status === "ok" ? "text-signal-green" :
    audit.status === "warn" ? "text-signal-amber" :
    audit.status === "error" ? "text-signal-red" : "text-text-dim";
  return (
    <div className="px-3 py-2 hover:bg-accent/30 flex items-center gap-3">
      <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", dotCls)} />
      <div className="flex-1 min-w-0">
        <div className="text-[12px] font-mono text-foreground truncate">{audit.label}</div>
        <div className="text-[10px] text-text-dim font-mono truncate">
          {audit.table}{audit.expectedMin ? ` · min ${audit.expectedMin}` : ""}{audit.error ? ` · ${audit.error}` : ""}
        </div>
      </div>
      <div className="text-right">
        <div className="text-[13px] font-mono font-bold tabular-nums">{audit.count.toLocaleString()}</div>
        <div className={cn("text-[9px] font-mono uppercase tracking-wider", statusCls)}>{statusLabel}</div>
      </div>
    </div>
  );
}

function IncRow({ iss }: { iss: Inconsistency }) {
  const Icon = iss.severity === "error" ? XCircle : iss.severity === "warn" ? AlertTriangle : FileWarning;
  const tone =
    iss.severity === "error" ? "text-signal-red border-l-signal-red" :
    iss.severity === "warn" ? "text-signal-amber border-l-signal-amber" :
    "text-signal-cyan border-l-signal-cyan";
  return (
    <div className={cn("px-3 py-2 border-l-2 hover:bg-accent/30", tone)}>
      <div className="flex items-start gap-2">
        <Icon className="w-3.5 h-3.5 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-mono font-bold text-foreground">{iss.rule}</span>
            <span className="text-[9px] font-mono text-text-dim uppercase">{iss.table}</span>
            <span className="ml-auto text-[10px] font-mono tabular-nums px-1.5 py-0.5 rounded-[2px] bg-bg-elevated border border-border">
              {iss.count} {iss.count === 1 ? "fila" : "filas"}
            </span>
          </div>
          <div className="text-[10px] text-text-dim font-mono mt-0.5 truncate">{iss.detail}</div>
        </div>
      </div>
    </div>
  );
}
