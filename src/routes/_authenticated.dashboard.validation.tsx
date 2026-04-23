import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { RefreshCw, Loader2, CheckCircle2, AlertTriangle, XCircle, Database, FileWarning, Wrench, Eye, Play, ChevronRight, ChevronDown, Copy } from "lucide-react";
import { toast } from "sonner";
import { useProjects } from "@/hooks/useProjects";
import { useDataValidation, type TableAudit, type Inconsistency } from "@/hooks/useDataValidation";
import { useDataRepairs, type RepairDefinition, type RepairPreviewRow } from "@/hooks/useDataRepairs";
import { HudPanel } from "@/components/ops/HudPanel";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dashboard/validation")({
  component: ValidationPage,
});

function ValidationPage() {
  const { active } = useProjects();
  const { report, loading, refresh } = useDataValidation(active?.id ?? null);
  const repairs = useDataRepairs(active?.id ?? null);
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

          {/* Inconsistencies grouped by severity */}
          <HudPanel title="Inconsistencias detectadas · agrupadas por severidad" accent="amber" className="bg-bg-panel/40">
            {report.inconsistencies.length === 0 ? (
              <div className="p-4 text-center">
                <CheckCircle2 className="w-6 h-6 mx-auto text-signal-green mb-2" />
                <div className="text-[11px] font-mono text-text-dim">
                  Sin inconsistencias detectadas. Stages, enums, claves únicas y referencias cruzadas en orden.
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {(["error", "warn", "info"] as const).map((sev) => {
                  const items = report.inconsistencies.filter((i) => i.severity === sev);
                  if (items.length === 0) return null;
                  const xrefCount = items.filter((i) => i.category === "xref").length;
                  const sevLabel = sev === "error" ? "Errores críticos" : sev === "warn" ? "Advertencias" : "Informativo";
                  const sevCls =
                    sev === "error" ? "text-signal-red border-signal-red/40 bg-signal-red/5" :
                    sev === "warn" ? "text-signal-amber border-signal-amber/40 bg-signal-amber/5" :
                    "text-signal-cyan border-signal-cyan/40 bg-signal-cyan/5";
                  return (
                    <div key={sev} className={cn("border rounded-[2px]", sevCls)}>
                      <div className="px-3 py-1.5 flex items-center gap-2 border-b border-current/20">
                        <span className="text-[10px] font-mono uppercase tracking-wider font-bold">{sevLabel}</span>
                        <span className="text-[10px] font-mono opacity-60">{items.length} regla{items.length === 1 ? "" : "s"}</span>
                        {xrefCount > 0 && (
                          <span className="ml-auto text-[9px] font-mono px-1.5 py-0.5 rounded-[2px] border border-current/40 uppercase">
                            {xrefCount} FK rota{xrefCount === 1 ? "" : "s"}
                          </span>
                        )}
                      </div>
                      <div className="divide-y divide-border bg-bg-panel/40">
                        {items.map((iss) => <IncRow key={iss.id} iss={iss} />)}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </HudPanel>

          {/* Repair actions */}
          <HudPanel title="Acciones de reparación · vista previa antes de aplicar" accent="violet" className="bg-bg-panel/40">
            <div className="text-[10px] font-mono text-text-dim mb-3">
              Cada reparación primero genera un dry-run. Revisa los cambios y luego confirma para aplicarlos a la base.
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {repairs.repairs.map((repair) => (
                <RepairCard
                  key={repair.id}
                  repair={repair}
                  state={repairs.states[repair.id]}
                  onPreview={() => repairs.runPreview(repair)}
                  onApply={async () => {
                    const n = await repairs.applyRepair(repair);
                    if (n > 0) {
                      toast.success(`${repair.title}: ${n} fila${n === 1 ? "" : "s"} corregida${n === 1 ? "" : "s"}`);
                      refresh();
                    }
                  }}
                  onClear={() => repairs.clear(repair.id)}
                />
              ))}
            </div>
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
                    {list.map((t) => <TableRow key={t.table} audit={t} sync={report.lastSync[t.table] ?? null} />)}
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

function TableRow({ audit, sync }: {
  audit: TableAudit;
  sync: { at: string; prevCount: number; delta: number } | null;
}) {
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

  const deltaCls = !sync ? "text-text-dim" :
    sync.delta > 0 ? "text-signal-green" :
    sync.delta < 0 ? "text-signal-red" : "text-text-dim";
  const deltaLabel = !sync ? "—" :
    sync.delta === 0 ? "±0" :
    sync.delta > 0 ? `+${sync.delta.toLocaleString()}` : sync.delta.toLocaleString();

  return (
    <div className="px-3 py-2 hover:bg-accent/30 flex items-center gap-3">
      <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", dotCls)} />
      <div className="flex-1 min-w-0">
        <div className="text-[12px] font-mono text-foreground truncate">{audit.label}</div>
        <div className="text-[10px] text-text-dim font-mono truncate">
          {audit.table}{audit.expectedMin ? ` · min ${audit.expectedMin}` : ""}{audit.error ? ` · ${audit.error}` : ""}
        </div>
      </div>
      <div className="text-right shrink-0 w-28" title={sync ? `Última sync: ${new Date(sync.at).toLocaleString("es-CL")}` : "Sin snapshots previos"}>
        <div className={cn("text-[11px] font-mono tabular-nums", deltaCls)}>{deltaLabel}</div>
        <div className="text-[9px] font-mono text-text-dim truncate">
          {sync ? formatRelative(sync.at) : "primera corrida"}
        </div>
      </div>
      <div className="text-right shrink-0 w-20">
        <div className="text-[13px] font-mono font-bold tabular-nums">{audit.count.toLocaleString()}</div>
        <div className={cn("text-[9px] font-mono uppercase tracking-wider", statusCls)}>{statusLabel}</div>
      </div>
    </div>
  );
}

function formatRelative(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60_000);
  if (min < 1) return "ahora";
  if (min < 60) return `hace ${min} min`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `hace ${hr} h`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `hace ${day} d`;
  const mo = Math.floor(day / 30);
  return `hace ${mo} mes`;
}

function IncRow({ iss }: { iss: Inconsistency }) {
  const [open, setOpen] = useState(false);
  const Icon = iss.severity === "error" ? XCircle : iss.severity === "warn" ? AlertTriangle : FileWarning;
  const tone =
    iss.severity === "error" ? "text-signal-red border-l-signal-red" :
    iss.severity === "warn" ? "text-signal-amber border-l-signal-amber" :
    "text-signal-cyan border-l-signal-cyan";
  const hasAffected = !!iss.affected && iss.affected.length > 0;
  const Chevron = open ? ChevronDown : ChevronRight;

  return (
    <div className={cn("border-l-2", tone)}>
      <button
        type="button"
        onClick={() => hasAffected && setOpen((v) => !v)}
        disabled={!hasAffected}
        className={cn(
          "w-full text-left px-3 py-2 flex items-start gap-2 hover:bg-accent/30 transition-colors",
          hasAffected ? "cursor-pointer" : "cursor-default",
        )}
      >
        <Icon className="w-3.5 h-3.5 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-mono font-bold text-foreground">{iss.rule}</span>
            <span className="text-[9px] font-mono text-text-dim uppercase">{iss.table}</span>
            {iss.category === "xref" && (
              <span className="text-[8px] font-mono uppercase px-1 py-0 rounded-[2px] border border-signal-violet/40 text-signal-violet">
                FK rota
              </span>
            )}
            <span className="ml-auto text-[10px] font-mono tabular-nums px-1.5 py-0.5 rounded-[2px] bg-bg-elevated border border-border">
              {iss.count} {iss.count === 1 ? "fila" : "filas"}
            </span>
            {hasAffected && <Chevron className="w-3 h-3 text-text-dim shrink-0" />}
          </div>
          <div className="text-[10px] text-text-dim font-mono mt-0.5 truncate">{iss.detail}</div>
        </div>
      </button>
      {open && hasAffected && <AffectedTable affected={iss.affected!} totalCount={iss.count} />}
    </div>
  );
}

function AffectedTable({
  affected,
  totalCount,
}: {
  affected: NonNullable<Inconsistency["affected"]>;
  totalCount: number;
}) {
  const columns = useMemo(() => {
    const cols: string[] = [];
    const seen = new Set<string>();
    for (const r of affected) {
      for (const k of Object.keys(r.fields)) {
        if (!seen.has(k)) { seen.add(k); cols.push(k); }
      }
    }
    return cols;
  }, [affected]);
  const truncated = totalCount > affected.length;

  return (
    <div className="bg-bg-elevated/30 border-t border-border/50">
      <div className="px-3 py-1.5 border-b border-border/40">
        <span className="text-[9px] font-mono uppercase tracking-wider text-text-dim">
          Registros afectados · mostrando {affected.length}/{totalCount}
          {truncated && " (truncado a 50)"}
        </span>
      </div>
      <div className="overflow-x-auto max-h-[280px] overflow-y-auto">
        <table className="w-full text-[10px] font-mono">
          <thead className="bg-bg-panel/60 sticky top-0">
            <tr className="text-left text-text-dim">
              <th className="px-2 py-1.5 font-normal">label</th>
              {columns.map((c) => (
                <th key={c} className="px-2 py-1.5 font-normal whitespace-nowrap">{c}</th>
              ))}
              <th className="px-2 py-1.5 font-normal w-6"></th>
            </tr>
          </thead>
          <tbody>
            {affected.map((r) => (
              <tr key={r.id} className="border-t border-border/30 hover:bg-accent/20">
                <td className="px-2 py-1 text-foreground font-bold whitespace-nowrap">
                  {r.label ?? <span className="text-text-dim">—</span>}
                </td>
                {columns.map((c) => {
                  const v = r.fields[c];
                  return (
                    <td
                      key={c}
                      className="px-2 py-1 text-text-secondary whitespace-nowrap max-w-[200px] truncate"
                      title={v == null ? "(null)" : String(v)}
                    >
                      {v == null ? <span className="text-text-dim italic">∅</span> : String(v)}
                    </td>
                  );
                })}
                <td className="px-2 py-1">
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard?.writeText(r.id);
                      toast.success("ID copiado", { description: r.id });
                    }}
                    title={`Copiar id: ${r.id}`}
                    className="p-0.5 text-text-dim hover:text-foreground"
                  >
                    <Copy className="w-3 h-3" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RepairCard({
  repair,
  state,
  onPreview,
  onApply,
  onClear,
}: {
  repair: RepairDefinition;
  state: { preview: RepairPreviewRow[] | null; loading: boolean; applying: boolean; appliedCount: number | null; error: string | null } | undefined;
  onPreview: () => void;
  onApply: () => void;
  onClear: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const s = state ?? { preview: null, loading: false, applying: false, appliedCount: null, error: null };
  const hasPreview = s.preview !== null;
  const previewCount = s.preview?.length ?? 0;
  const catCls =
    repair.category === "enum" ? "border-signal-cyan/40 text-signal-cyan"
    : repair.category === "orphan" ? "border-signal-amber/40 text-signal-amber"
    : "border-signal-violet/40 text-signal-violet";

  return (
    <div className="border border-border rounded-[2px] bg-bg-elevated/40">
      <div className="px-3 py-2 flex items-start gap-2">
        <Wrench className="w-3.5 h-3.5 text-signal-violet shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[12px] font-mono font-bold text-foreground truncate">{repair.title}</span>
            <span className={cn("text-[8px] font-mono uppercase px-1 py-0 border rounded-[2px]", catCls)}>{repair.category}</span>
            <span className="text-[9px] font-mono text-text-dim">{repair.table}</span>
          </div>
          <div className="text-[10px] text-text-dim font-mono mt-0.5">{repair.description}</div>
          {s.error && (
            <div className="mt-1.5 text-[10px] font-mono text-signal-red border-l-2 border-signal-red pl-1.5">{s.error}</div>
          )}
          {s.appliedCount !== null && (
            <div className="mt-1.5 text-[10px] font-mono text-signal-green flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              {s.appliedCount} fila{s.appliedCount === 1 ? "" : "s"} corregida{s.appliedCount === 1 ? "" : "s"}.
            </div>
          )}
        </div>
        <div className="flex flex-col gap-1 shrink-0">
          {!hasPreview ? (
            <button
              onClick={onPreview}
              disabled={s.loading}
              className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-mono uppercase rounded-[2px] border border-signal-cyan/40 bg-signal-cyan/10 text-signal-cyan hover:bg-signal-cyan/20 disabled:opacity-50"
            >
              {s.loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Eye className="w-3 h-3" />}
              Preview
            </button>
          ) : previewCount === 0 ? (
            <span className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-mono uppercase rounded-[2px] border border-signal-green/40 bg-signal-green/10 text-signal-green">
              <CheckCircle2 className="w-3 h-3" /> Sin cambios
            </span>
          ) : (
            <>
              <button
                onClick={onApply}
                disabled={s.applying}
                className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-mono uppercase rounded-[2px] border border-signal-violet/60 bg-signal-violet/15 text-signal-violet hover:bg-signal-violet/25 disabled:opacity-50"
              >
                {s.applying ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                Aplicar ({previewCount})
              </button>
              <button
                onClick={onClear}
                className="inline-flex items-center justify-center gap-1 px-2 py-1 text-[10px] font-mono uppercase rounded-[2px] border border-border text-text-dim hover:text-foreground"
              >
                Cancelar
              </button>
            </>
          )}
        </div>
      </div>

      {hasPreview && previewCount > 0 && (
        <div className="border-t border-border">
          <button
            onClick={() => setExpanded((v) => !v)}
            className="w-full px-3 py-1.5 flex items-center gap-1.5 text-[10px] font-mono uppercase text-text-dim hover:text-foreground hover:bg-accent/30"
          >
            <ChevronRight className={cn("w-3 h-3 transition-transform", expanded && "rotate-90")} />
            Vista previa · {previewCount} fila{previewCount === 1 ? "" : "s"}
          </button>
          {expanded && (
            <div className="max-h-64 overflow-y-auto border-t border-border divide-y divide-border">
              {s.preview!.slice(0, 50).map((row) => (
                <div key={row.id} className="px-3 py-1.5 text-[10px] font-mono">
                  <div className="text-foreground">{row.label}</div>
                  <div className="flex items-center gap-1 mt-0.5 text-text-dim">
                    <span className="text-signal-red line-through truncate">
                      {Object.entries(row.before).map(([k, v]) => `${k}=${String(v ?? "—")}`).join(" · ")}
                    </span>
                    <ChevronRight className="w-2.5 h-2.5 shrink-0" />
                    <span className="text-signal-green truncate">
                      {Object.entries(row.after).map(([k, v]) => `${k}=${String(v ?? "—")}`).join(" · ")}
                    </span>
                  </div>
                </div>
              ))}
              {previewCount > 50 && (
                <div className="px-3 py-1.5 text-[10px] font-mono text-text-dim text-center">
                  + {previewCount - 50} más…
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
