import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Pencil, Trash2, FileText, Compass } from "lucide-react";
import { useProjects } from "@/hooks/useProjects";
import { useAuth } from "@/hooks/useAuth";
import {
  useDrillHoles,
  HOLE_STATUSES,
  STATUS_LABELS,
  STATUS_COLORS,
  progressPct,
  type DrillHole,
  type HoleStatus,
} from "@/hooks/useDrilling";
import { useProjectCoreLogs } from "@/hooks/useProjectCoreLogs";
import { computeIntercepts, bestIntercept, formatIntercept } from "@/lib/drilling/intercepts";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CoreLogPanel } from "@/components/drilling/CoreLogPanel";
import { SurveysDialog } from "@/components/drilling/SurveysDialog";
import { computeProjectTrajectories } from "@/lib/miningEngine.functions";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/dashboard/drilling")({
  head: () => ({ meta: [{ title: "Sondajes — Geocapitals" }] }),
  component: DrillingModule,
});

function DrillingModule() {
  const { active } = useProjects();
  const { user } = useAuth();
  const { data, loading, refresh } = useDrillHoles(active?.id ?? null);
  const { byHole, refresh: refreshLogs } = useProjectCoreLogs(active?.id ?? null);
  const [filter, setFilter] = useState<HoleStatus | "all">("all");
  const [editing, setEditing] = useState<DrillHole | null>(null);
  const [creating, setCreating] = useState(false);
  const [logHole, setLogHole] = useState<DrillHole | null>(null);
  const [surveysHole, setSurveysHole] = useState<DrillHole | null>(null);
  const [batchRunning, setBatchRunning] = useState(false);
  const computeAll = useServerFn(computeProjectTrajectories);

  const bestByHole = useMemo(() => {
    const m: Record<string, ReturnType<typeof bestIntercept>> = {};
    for (const h of data) {
      const logs = byHole[h.id] ?? [];
      m[h.id] = bestIntercept(computeIntercepts(logs, 0.5, 2));
    }
    return m;
  }, [data, byHole]);

  const filtered = useMemo(
    () => (filter === "all" ? data : data.filter((h) => h.status === filter)),
    [data, filter],
  );

  const stats = useMemo(() => {
    let plannedM = 0,
      drilledM = 0;
    const byStatus: Record<string, number> = {
      proposed: 0,
      in_progress: 0,
      completed: 0,
      abandoned: 0,
    };
    for (const h of data) {
      plannedM += Number(h.planned_depth ?? 0);
      drilledM += Number(h.actual_depth ?? 0);
      byStatus[h.status] = (byStatus[h.status] ?? 0) + 1;
    }
    const pct = plannedM > 0 ? Math.round((drilledM / plannedM) * 100) : 0;
    return { total: data.length, plannedM, drilledM, pct, byStatus };
  }, [data]);

  if (!active) {
    return (
      <div className="p-6 text-text-secondary">Selecciona un proyecto para ver sus sondajes.</div>
    );
  }

  const onDelete = async (h: DrillHole) => {
    if (!confirm(`¿Eliminar sondaje "${h.hole_id}" y todos sus intervalos?`)) return;
    await supabase.from("drill_core_logs").delete().eq("hole_id", h.id);
    const { error } = await supabase.from("drill_holes").delete().eq("id", h.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Sondaje eliminado");
      refresh();
      refreshLogs();
    }
  };

  const onRecomputeAll = async () => {
    if (!active) return;
    setBatchRunning(true);
    try {
      const r = await computeAll({ data: { projectId: active.id } });
      if (r.failed === 0) {
        toast.success(`Trayectorias recalculadas: ${r.succeeded}/${r.attempted}`);
      } else {
        toast.warning(
          `Recalculadas ${r.succeeded}/${r.attempted}. ${r.failed} fallidas (${r.failures
            .map((f) => f.hole_id)
            .slice(0, 3)
            .join(", ")}${r.failures.length > 3 ? "…" : ""})`,
        );
      }
    } catch (e) {
      toast.error(String((e as Error).message ?? e));
    } finally {
      setBatchRunning(false);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Sondajes</h1>
          <p className="text-xs text-text-secondary mt-0.5">
            DDH del proyecto · {active.code} · {active.name}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onRecomputeAll}
            disabled={batchRunning || data.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-border text-sm hover:bg-accent disabled:opacity-50"
            title="Calcular trayectorias 3D vía mining-engine para todos los sondajes del proyecto"
          >
            <Compass className="w-4 h-4" />
            {batchRunning ? "Calculando…" : "Recalcular trayectorias"}
          </button>
          <button
            onClick={() => setCreating(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-primary text-primary-foreground text-sm hover:opacity-90"
          >
            <Plus className="w-4 h-4" /> Nuevo sondaje
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
        <Stat label="Total" value={String(stats.total)} />
        <Stat
          label="Propuestos"
          value={String(stats.byStatus.proposed)}
          color={STATUS_COLORS.proposed}
        />
        <Stat
          label="En curso"
          value={String(stats.byStatus.in_progress)}
          color={STATUS_COLORS.in_progress}
        />
        <Stat
          label="Completados"
          value={String(stats.byStatus.completed)}
          color={STATUS_COLORS.completed}
        />
        <Stat
          label="Avance"
          value={`${stats.drilledM.toFixed(0)}/${stats.plannedM.toFixed(0)} m`}
        />
        <Stat label="% global" value={`${stats.pct}%`} color="#0d9488" />
      </div>

      {/* Filters */}
      <div className="flex gap-1 flex-wrap">
        {(["all", ...HOLE_STATUSES] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f as HoleStatus | "all")}
            className={`px-2.5 py-1 rounded text-xs border transition-colors ${
              filter === f
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-bg-secondary border-border hover:bg-accent"
            }`}
          >
            {f === "all" ? "Todos" : STATUS_LABELS[f]}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="border border-border rounded overflow-hidden">
        {loading ? (
          <div className="p-6 text-center text-text-secondary text-sm">Cargando…</div>
        ) : filtered.length === 0 ? (
          <div className="p-6 text-center text-text-secondary text-sm">
            {data.length === 0
              ? "Sin sondajes todavía. Crea el primero."
              : "Sin resultados con ese filtro."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-bg-secondary border-b border-border">
                <tr className="text-left">
                  <Th>Sondaje</Th>
                  <Th>Estado</Th>
                  <Th>Zona</Th>
                  <Th>Az/Dip</Th>
                  <Th>Plan/Real (m)</Th>
                  <Th>Avance</Th>
                  <Th>Mejor intercept</Th>
                  <Th>Inicio</Th>
                  <Th>Fin</Th>
                  <Th> </Th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((h) => {
                  const pct = progressPct(h);
                  const color = STATUS_COLORS[h.status] ?? "#64748b";
                  return (
                    <tr
                      key={h.id}
                      className="border-b border-border last:border-0 hover:bg-accent/30"
                    >
                      <Td>
                        <span className="font-mono font-medium">{h.hole_id}</span>
                      </Td>
                      <Td>
                        <span
                          className="inline-block px-2 py-0.5 rounded text-[10px] font-medium"
                          style={{ background: `${color}20`, color }}
                        >
                          {STATUS_LABELS[h.status] ?? h.status}
                        </span>
                      </Td>
                      <Td>{h.target_zone ?? "—"}</Td>
                      <Td>
                        <span className="font-mono">
                          {h.azimuth ?? "—"}°/{h.dip ?? "—"}°
                        </span>
                      </Td>
                      <Td>
                        <span className="font-mono">
                          {h.planned_depth ?? "—"}/{h.actual_depth ?? "—"}
                        </span>
                      </Td>
                      <Td>
                        <div className="flex items-center gap-2 min-w-[100px]">
                          <div className="flex-1 h-1.5 bg-bg-secondary rounded overflow-hidden">
                            <div
                              className="h-full"
                              style={{ width: `${pct}%`, background: color }}
                            />
                          </div>
                          <span className="text-[10px] text-text-secondary w-8 text-right">
                            {pct}%
                          </span>
                        </div>
                      </Td>
                      <Td>
                        {bestByHole[h.id] ? (
                          <span className="font-mono text-amber-600 font-semibold">
                            {formatIntercept(bestByHole[h.id]!)}
                          </span>
                        ) : (
                          <span className="text-text-secondary">—</span>
                        )}
                      </Td>
                      <Td>{h.started_at ?? "—"}</Td>
                      <Td>{h.completed_at ?? "—"}</Td>
                      <Td>
                        <div className="flex gap-1 justify-end">
                          <button
                            onClick={() => setLogHole(h)}
                            className="p-1 rounded hover:bg-accent"
                            title="Ver log de testigos"
                          >
                            <FileText className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setEditing(h)}
                            className="p-1 rounded hover:bg-accent"
                            title="Editar"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => onDelete(h)}
                            className="p-1 rounded hover:bg-destructive/20 text-destructive"
                            title="Eliminar"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {(creating || editing) && user && active && (
        <HoleDialog
          projectId={active.id}
          userId={user.id}
          initial={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={() => {
            refresh();
            setCreating(false);
            setEditing(null);
          }}
        />
      )}

      {logHole && user && active && (
        <CoreLogPanel
          hole={logHole}
          projectId={active.id}
          userId={user.id}
          onClose={() => {
            setLogHole(null);
            refreshLogs();
          }}
        />
      )}
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="border border-border rounded p-2.5 bg-bg-secondary/30">
      <div className="text-[10px] uppercase tracking-wider text-text-secondary">{label}</div>
      <div className="text-lg font-semibold" style={color ? { color } : undefined}>
        {value}
      </div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-2.5 py-1.5 font-medium text-text-secondary uppercase tracking-wider text-[10px] whitespace-nowrap">
      {children}
    </th>
  );
}
function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-2.5 py-1.5 whitespace-nowrap">{children}</td>;
}

function HoleDialog({
  projectId,
  userId,
  initial,
  onClose,
  onSaved,
}: {
  projectId: string;
  userId: string;
  initial: DrillHole | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    hole_id: initial?.hole_id ?? "",
    target_zone: initial?.target_zone ?? "",
    status: initial?.status ?? "proposed",
    easting: initial?.easting?.toString() ?? "",
    northing: initial?.northing?.toString() ?? "",
    elevation: initial?.elevation?.toString() ?? "",
    azimuth: initial?.azimuth?.toString() ?? "",
    dip: initial?.dip?.toString() ?? "",
    planned_depth: initial?.planned_depth?.toString() ?? "",
    actual_depth: initial?.actual_depth?.toString() ?? "",
    started_at: initial?.started_at ?? "",
    completed_at: initial?.completed_at ?? "",
    notes: initial?.notes ?? "",
  });
  const [saving, setSaving] = useState(false);

  const onSave = async () => {
    if (!form.hole_id.trim()) {
      toast.error("ID del sondaje es requerido");
      return;
    }
    setSaving(true);
    const payload = {
      project_id: projectId,
      created_by: userId,
      hole_id: form.hole_id.trim(),
      target_zone: form.target_zone.trim() || null,
      status: form.status,
      easting: form.easting ? Number(form.easting) : null,
      northing: form.northing ? Number(form.northing) : null,
      elevation: form.elevation ? Number(form.elevation) : null,
      azimuth: form.azimuth ? Number(form.azimuth) : null,
      dip: form.dip ? Number(form.dip) : null,
      planned_depth: form.planned_depth ? Number(form.planned_depth) : null,
      actual_depth: form.actual_depth ? Number(form.actual_depth) : null,
      started_at: form.started_at || null,
      completed_at: form.completed_at || null,
      notes: form.notes.trim() || null,
    };
    const { error } = initial
      ? await supabase.from("drill_holes").update(payload).eq("id", initial.id)
      : await supabase.from("drill_holes").insert(payload);
    setSaving(false);
    if (error) toast.error(error.message);
    else {
      toast.success(initial ? "Sondaje actualizado" : "Sondaje creado");
      onSaved();
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial ? "Editar sondaje" : "Nuevo sondaje"}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <Field label="ID Sondaje" required>
            <input
              className={inp}
              placeholder="ALH-DDH-001"
              value={form.hole_id}
              onChange={(e) => setForm({ ...form, hole_id: e.target.value })}
            />
          </Field>
          <Field label="Zona objetivo">
            <input
              className={inp}
              value={form.target_zone}
              onChange={(e) => setForm({ ...form, target_zone: e.target.value })}
            />
          </Field>
          <Field label="Estado">
            <select
              className={inp}
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
            >
              {HOLE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </Field>
          <div />
          <Field label="Easting">
            <input
              type="number"
              step="0.01"
              className={inp}
              value={form.easting}
              onChange={(e) => setForm({ ...form, easting: e.target.value })}
            />
          </Field>
          <Field label="Northing">
            <input
              type="number"
              step="0.01"
              className={inp}
              value={form.northing}
              onChange={(e) => setForm({ ...form, northing: e.target.value })}
            />
          </Field>
          <Field label="Elevación (m)">
            <input
              type="number"
              step="0.01"
              className={inp}
              value={form.elevation}
              onChange={(e) => setForm({ ...form, elevation: e.target.value })}
            />
          </Field>
          <Field label="Azimut (°)">
            <input
              type="number"
              step="0.1"
              className={inp}
              value={form.azimuth}
              onChange={(e) => setForm({ ...form, azimuth: e.target.value })}
            />
          </Field>
          <Field label="Dip (°)">
            <input
              type="number"
              step="0.1"
              className={inp}
              value={form.dip}
              onChange={(e) => setForm({ ...form, dip: e.target.value })}
            />
          </Field>
          <div />
          <Field label="Profundidad planificada (m)">
            <input
              type="number"
              step="0.01"
              className={inp}
              value={form.planned_depth}
              onChange={(e) => setForm({ ...form, planned_depth: e.target.value })}
            />
          </Field>
          <Field label="Profundidad real (m)">
            <input
              type="number"
              step="0.01"
              className={inp}
              value={form.actual_depth}
              onChange={(e) => setForm({ ...form, actual_depth: e.target.value })}
            />
          </Field>
          <Field label="Fecha inicio">
            <input
              type="date"
              className={inp}
              value={form.started_at}
              onChange={(e) => setForm({ ...form, started_at: e.target.value })}
            />
          </Field>
          <Field label="Fecha fin">
            <input
              type="date"
              className={inp}
              value={form.completed_at}
              onChange={(e) => setForm({ ...form, completed_at: e.target.value })}
            />
          </Field>
          <div className="col-span-2">
            <Field label="Notas">
              <textarea
                rows={2}
                className={inp}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </Field>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm rounded border border-border hover:bg-accent"
          >
            Cancelar
          </button>
          <button
            onClick={onSave}
            disabled={saving}
            className="px-3 py-1.5 text-sm rounded bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const inp =
  "w-full px-2 py-1.5 text-sm bg-bg-secondary border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary";

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-[10px] uppercase tracking-wider text-text-secondary mb-1">
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}
