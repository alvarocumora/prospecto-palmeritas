import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Eye,
  Loader2,
  MessageSquarePlus,
  Radar,
  Sparkles,
  X,
} from "lucide-react";
import {
  useInsarAlertHistory,
  useRunInsarWorkflow,
  useAddInsarAction,
} from "@/hooks/useInsarAlertWorkflow";
import { cn } from "@/lib/utils";

type Props = { projectId: string };

const ACTION_LABEL: Record<string, string> = {
  task_created: "Tarea creada",
  recommendation: "Recomendación",
  status_change: "Cambio de estado",
  dismissed: "Descartada",
  escalated: "Escalada",
  field_inspection: "Inspección de campo",
  closed: "Cerrada",
};

const ACTION_COLOR: Record<string, string> = {
  task_created: "bg-signal-cyan/15 text-signal-cyan border-signal-cyan/40",
  recommendation: "bg-violet-500/15 text-violet-300 border-violet-500/40",
  status_change: "bg-text-dim/15 text-text-secondary border-text-dim/30",
  dismissed: "bg-text-dim/10 text-text-dim border-text-dim/30",
  escalated: "bg-red-500/15 text-red-400 border-red-500/40",
  field_inspection: "bg-emerald-500/15 text-emerald-400 border-emerald-500/40",
  closed: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
};

const PRIO_COLOR: Record<string, string> = {
  critical: "bg-red-500/15 text-red-400 border-red-500/40",
  high: "bg-signal-amber/15 text-signal-amber border-signal-amber/40",
  medium: "bg-signal-cyan/15 text-signal-cyan border-signal-cyan/40",
  low: "bg-text-dim/15 text-text-secondary border-text-dim/30",
};

function priorityFor(vel: number, sev: string | null): "low" | "medium" | "high" | "critical" {
  const a = Math.abs(vel ?? 0);
  if (sev === "critical" || a >= 30) return "critical";
  if (a >= 20) return "high";
  if (a >= 15) return "medium";
  return "low";
}

export function InsarAlertWorkflowPanel({ projectId }: Props) {
  const { data, isLoading, refetch, isFetching } = useInsarAlertHistory(projectId);
  const runMut = useRunInsarWorkflow();
  const addMut = useAddInsarAction();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [composer, setComposer] = useState<{ insarId: string; text: string } | null>(null);

  const sites = data?.sites ?? [];
  const actions = data?.actions ?? [];
  const tasks = data?.tasks ?? [];

  const tasksByInsar = useMemo(() => {
    const m = new Map<string, (typeof tasks)[number][]>();
    tasks.forEach((t) => {
      if (!t.source_ref) return;
      const list = m.get(t.source_ref) ?? [];
      list.push(t);
      m.set(t.source_ref, list);
    });
    return m;
  }, [tasks]);

  const actionsByInsar = useMemo(() => {
    const m = new Map<string, (typeof actions)[number][]>();
    actions.forEach((a) => {
      const list = m.get(a.insar_id) ?? [];
      list.push(a);
      m.set(a.insar_id, list);
    });
    return m;
  }, [actions]);

  const stats = useMemo(() => {
    const taskedSet = new Set(
      actions.filter((a) => a.action_type === "task_created").map((a) => a.insar_id),
    );
    return {
      total: sites.length,
      tasked: taskedSet.size,
      pending: sites.length - taskedSet.size,
      tasksOpen: tasks.filter((t) => t.status === "open" || t.status === "in_progress").length,
    };
  }, [sites, actions, tasks]);

  function toggle(id: string) {
    setExpanded((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  async function submitRec() {
    if (!composer || !composer.text.trim()) return;
    await addMut.mutateAsync({
      projectId,
      insarId: composer.insarId,
      actionType: "recommendation",
      recommendation: composer.text.trim(),
    });
    setComposer(null);
  }

  async function quickAction(
    insarId: string,
    actionType: "field_inspection" | "escalated" | "dismissed" | "closed",
  ) {
    await addMut.mutateAsync({ projectId, insarId, actionType });
  }

  return (
    <div className="border border-border/50 rounded-md bg-surface-1/40 backdrop-blur">
      <header className="flex items-center justify-between gap-3 flex-wrap p-4 border-b border-border/30">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-signal-amber" />
          <h2 className="text-sm font-mono uppercase tracking-wider text-foreground">
            Workflow Alertas InSAR
          </h2>
          <span className="text-xs text-text-dim font-mono">
            {stats.total} sitios · {stats.tasked} c/tarea · {stats.pending} pendientes ·{" "}
            {stats.tasksOpen} tareas abiertas
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="text-xs px-2.5 py-1 rounded border border-border/40 text-text-secondary hover:border-border font-mono uppercase disabled:opacity-50"
          >
            Refrescar
          </button>
          <button
            onClick={() => runMut.mutate({ projectId })}
            disabled={runMut.isPending || stats.pending === 0}
            className="text-xs px-3 py-1.5 rounded border border-signal-cyan/40 text-signal-cyan hover:bg-signal-cyan/10 disabled:opacity-50 font-mono uppercase tracking-wide flex items-center gap-1.5"
          >
            {runMut.isPending ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Sparkles className="w-3 h-3" />
            )}
            Generar tareas ({stats.pending})
          </button>
        </div>
      </header>

      {runMut.data && (
        <div className="px-4 py-2 border-b border-border/20 text-xs font-mono text-emerald-400 bg-emerald-500/5">
          Workflow ejecutado: {runMut.data.created} tareas creadas, {runMut.data.skipped} omitidas
          (ya tenían tarea), {runMut.data.total} totales.
        </div>
      )}

      {isLoading ? (
        <div className="p-8 text-sm text-text-dim text-center font-mono flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Cargando…
        </div>
      ) : sites.length === 0 ? (
        <div className="p-8 text-sm text-text-dim text-center font-mono">
          Sin sitios InSAR en warning/critical.
        </div>
      ) : (
        <div className="divide-y divide-border/20">
          {sites.map((s) => {
            const vel = Number(s.velocity_mm_year);
            const prio = priorityFor(vel, s.alert_severity);
            const siteTasks = tasksByInsar.get(s.id) ?? [];
            const siteActions = actionsByInsar.get(s.id) ?? [];
            const isOpen = expanded.has(s.id);

            return (
              <div key={s.id} className="p-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={cn(
                          "text-[10px] font-mono uppercase px-1.5 py-0.5 rounded border",
                          PRIO_COLOR[prio],
                        )}
                      >
                        {prio}
                      </span>
                      <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded border bg-signal-amber/10 text-signal-amber border-signal-amber/40">
                        {s.alert_severity}
                      </span>
                      <span className="text-sm font-medium text-foreground">
                        {s.asset_name ?? "Sitio"}
                      </span>
                      <span className="text-[11px] text-text-dim font-mono">
                        · {s.asset_type ?? "—"}
                      </span>
                    </div>
                    <div className="text-[11px] text-text-secondary font-mono mt-1 flex flex-wrap gap-3">
                      <span>
                        <Radar className="w-2.5 h-2.5 inline mr-1" /> v ={" "}
                        <b className="text-foreground">{vel.toFixed(1)} mm/año</b>
                      </span>
                      <span>Σ = {Number(s.cumulative_displacement_mm ?? 0).toFixed(0)} mm</span>
                      <span>coh = {Number(s.coherence ?? 0).toFixed(2)}</span>
                      <span>cierre {String(s.end_date ?? "").slice(0, 10)}</span>
                      {siteTasks.length > 0 && (
                        <span className="text-signal-cyan">
                          <ClipboardList className="w-2.5 h-2.5 inline mr-1" />
                          {siteTasks.length} tarea{siteTasks.length > 1 ? "s" : ""}
                        </span>
                      )}
                      {siteActions.length > 0 && (
                        <span className="text-violet-300">
                          {siteActions.length} eventos en historial
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      onClick={() => setComposer({ insarId: s.id, text: "" })}
                      className="text-[10px] px-2 py-1 rounded border border-violet-500/40 text-violet-300 hover:bg-violet-500/10 font-mono uppercase flex items-center gap-1"
                    >
                      <MessageSquarePlus className="w-3 h-3" /> Recomendación
                    </button>
                    <button
                      onClick={() => quickAction(s.id, "field_inspection")}
                      disabled={addMut.isPending}
                      className="text-[10px] px-2 py-1 rounded border border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 font-mono uppercase flex items-center gap-1"
                    >
                      <Eye className="w-3 h-3" /> Campo
                    </button>
                    <button
                      onClick={() => quickAction(s.id, "escalated")}
                      disabled={addMut.isPending}
                      className="text-[10px] px-2 py-1 rounded border border-red-500/40 text-red-400 hover:bg-red-500/10 font-mono uppercase"
                    >
                      Escalar
                    </button>
                    <button
                      onClick={() => quickAction(s.id, "dismissed")}
                      disabled={addMut.isPending}
                      className="text-[10px] px-2 py-1 rounded border border-text-dim/40 text-text-dim hover:bg-text-dim/10 font-mono uppercase"
                    >
                      Descartar
                    </button>
                    <button
                      onClick={() => toggle(s.id)}
                      className="text-[10px] px-2 py-1 rounded border border-border/40 text-text-secondary hover:border-border font-mono uppercase flex items-center gap-1"
                    >
                      <ChevronDown
                        className={cn("w-3 h-3 transition-transform", isOpen && "rotate-180")}
                      />
                      Historial ({siteActions.length})
                    </button>
                  </div>
                </div>

                {composer && composer.insarId === s.id && (
                  <div className="mt-3 p-3 rounded border border-violet-500/30 bg-violet-500/5 space-y-2">
                    <textarea
                      value={composer.text}
                      onChange={(e) => setComposer({ insarId: s.id, text: e.target.value })}
                      placeholder="Recomendación geotécnica de seguimiento (instrumentación, frecuencia de inspección, criterios de gatillo, responsable, etc.)…"
                      className="w-full bg-surface-2/60 border border-border/40 rounded p-2 text-xs font-mono text-foreground placeholder:text-text-dim outline-none focus:border-violet-500/60 min-h-[80px]"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setComposer(null)}
                        className="text-[10px] px-2 py-1 rounded border border-border/40 text-text-secondary font-mono uppercase flex items-center gap-1"
                      >
                        <X className="w-3 h-3" /> Cancelar
                      </button>
                      <button
                        onClick={submitRec}
                        disabled={!composer.text.trim() || addMut.isPending}
                        className="text-[10px] px-2 py-1 rounded border border-violet-500/40 bg-violet-500/10 text-violet-300 font-mono uppercase disabled:opacity-50 flex items-center gap-1"
                      >
                        {addMut.isPending ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <CheckCircle2 className="w-3 h-3" />
                        )}
                        Registrar
                      </button>
                    </div>
                  </div>
                )}

                {isOpen && (
                  <div className="mt-3 ml-2 pl-3 border-l-2 border-border/30 space-y-2">
                    {siteActions.length === 0 ? (
                      <div className="text-[11px] text-text-dim font-mono">
                        Sin eventos registrados todavía.
                      </div>
                    ) : (
                      siteActions.map((a: any) => (
                        <div key={a.id} className="flex items-start gap-2 text-[11px] font-mono">
                          <span
                            className={cn(
                              "inline-block px-1.5 py-0.5 rounded border text-[9px] uppercase whitespace-nowrap",
                              ACTION_COLOR[a.action_type] ?? "",
                            )}
                          >
                            {ACTION_LABEL[a.action_type] ?? a.action_type}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="text-text-dim text-[10px]">
                              {new Date(a.created_at).toLocaleString("es-CL")}
                              {a.severity_at_time && ` · sev ${a.severity_at_time}`}
                              {a.velocity_mm_year != null &&
                                ` · ${Number(a.velocity_mm_year).toFixed(1)} mm/a`}
                            </div>
                            {a.recommendation && (
                              <div className="text-text-secondary mt-0.5 whitespace-pre-wrap">
                                {a.recommendation}
                              </div>
                            )}
                            {a.notes && !a.recommendation && (
                              <div className="text-text-dim mt-0.5">{a.notes}</div>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                    {siteTasks.length > 0 && (
                      <div className="pt-2 border-t border-border/20">
                        <div className="text-[10px] text-text-dim font-mono uppercase mb-1">
                          Tareas vinculadas
                        </div>
                        {siteTasks.map((t: any) => (
                          <div
                            key={t.id}
                            className="text-[11px] font-mono text-text-secondary flex items-center gap-2"
                          >
                            <ClipboardList className="w-3 h-3 text-signal-cyan" />
                            <span className="truncate flex-1">{t.title}</span>
                            <span
                              className={cn(
                                "text-[9px] uppercase px-1.5 py-0.5 rounded border",
                                PRIO_COLOR[t.priority] ?? "",
                              )}
                            >
                              {t.priority}
                            </span>
                            <span className="text-[10px] text-text-dim">{t.status}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
