import { useMemo, useState } from "react";
import { Plus, Pencil, Trash2, AlertTriangle, Sparkles } from "lucide-react";
import { useDrillCoreLogs, type DrillCoreLog, type DrillHole } from "@/hooks/useDrilling";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  computeIntercepts,
  DEFAULT_AU_CUTOFF,
  DEFAULT_INTERNAL_DILUTION_M,
} from "@/lib/drilling/intercepts";

const inp = "w-full px-2 py-1.5 text-sm bg-bg-secondary border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary";

export function CoreLogPanel({
  hole,
  projectId,
  userId,
  onClose,
}: {
  hole: DrillHole;
  projectId: string;
  userId: string;
  onClose: () => void;
}) {
  const { data: logs, loading, refresh } = useDrillCoreLogs(hole.id);
  const [editing, setEditing] = useState<DrillCoreLog | null>(null);
  const [creating, setCreating] = useState(false);
  const [cutoff, setCutoff] = useState<number>(DEFAULT_AU_CUTOFF);
  const [dilution, setDilution] = useState<number>(DEFAULT_INTERNAL_DILUTION_M);

  const intercepts = useMemo(
    () => computeIntercepts(logs, cutoff, dilution),
    [logs, cutoff, dilution]
  );

  const overlaps = useMemo(() => {
    const set = new Set<string>();
    const sorted = [...logs].sort((a, b) => a.depth_from - b.depth_from);
    for (let i = 0; i < sorted.length - 1; i++) {
      if (sorted[i].depth_to > sorted[i + 1].depth_from) {
        set.add(sorted[i].id);
        set.add(sorted[i + 1].id);
      }
    }
    return set;
  }, [logs]);

  const totalLogged = useMemo(
    () => logs.reduce((acc, l) => acc + (l.depth_to - l.depth_from), 0),
    [logs]
  );

  const onDelete = async (l: DrillCoreLog) => {
    if (!confirm(`¿Eliminar intervalo ${l.depth_from}-${l.depth_to} m?`)) return;
    const { error } = await supabase.from("drill_core_logs").delete().eq("id", l.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Intervalo eliminado");
      refresh();
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-6xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-2 pr-8">
            <span>
              Log de testigos · <span className="font-mono">{hole.hole_id}</span>
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-wrap gap-3 text-xs text-text-secondary border-b border-border pb-2">
          <span>Zona: <strong className="text-foreground">{hole.target_zone ?? "—"}</strong></span>
          <span>Profundidad: <strong className="text-foreground">{hole.actual_depth ?? "—"}/{hole.planned_depth ?? "—"} m</strong></span>
          <span>Az/Dip: <strong className="text-foreground">{hole.azimuth ?? "—"}°/{hole.dip ?? "—"}°</strong></span>
          <span>Logueado: <strong className="text-foreground">{totalLogged.toFixed(2)} m</strong> en {logs.length} intervalos</span>
        </div>

        <div className="flex justify-between items-center">
          <div className="text-xs text-text-secondary">
            {overlaps.size > 0 && (
              <span className="inline-flex items-center gap-1 text-amber-600">
                <AlertTriangle className="w-3.5 h-3.5" /> Hay intervalos solapados
              </span>
            )}
          </div>
          <button
            onClick={() => setCreating(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-primary text-primary-foreground text-sm hover:opacity-90"
          >
            <Plus className="w-4 h-4" /> Nuevo intervalo
          </button>
        </div>

        <div className="border border-border rounded overflow-hidden">
          {loading ? (
            <div className="p-6 text-center text-text-secondary text-sm">Cargando…</div>
          ) : logs.length === 0 ? (
            <div className="p-6 text-center text-text-secondary text-sm">Sin intervalos. Agrega el primero.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-bg-secondary border-b border-border">
                  <tr className="text-left">
                    <Th>Desde-Hasta (m)</Th>
                    <Th>Litología</Th>
                    <Th>Alteración</Th>
                    <Th>Mineralización</Th>
                    <Th>Estructura</Th>
                    <Th>RQD%</Th>
                    <Th>Rec%</Th>
                    <Th>Veta%</Th>
                    <Th>Sulf%</Th>
                    <Th>Au g/t</Th>
                    <Th>Cu %</Th>
                    <Th>Ag g/t</Th>
                    <Th> </Th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((l) => {
                    const auHi = (l.au_gpt ?? 0) > 1;
                    const cuHi = (l.cu_pct ?? 0) > 0.5;
                    const isOverlap = overlaps.has(l.id);
                    return (
                      <tr
                        key={l.id}
                        className={`border-b border-border last:border-0 hover:bg-accent/30 ${
                          isOverlap ? "bg-amber-500/5" : ""
                        }`}
                      >
                        <Td>
                          <span className="font-mono">
                            {l.depth_from}–{l.depth_to}
                          </span>
                          <span className="text-text-secondary ml-1">({(l.depth_to - l.depth_from).toFixed(2)})</span>
                        </Td>
                        <Td>{l.lithology ?? "—"}</Td>
                        <Td>{l.alteration ?? "—"}</Td>
                        <Td>{l.mineralization ?? "—"}</Td>
                        <Td>{l.structure ?? "—"}</Td>
                        <Td>{l.rqd_pct ?? "—"}</Td>
                        <Td>{l.recovery_pct ?? "—"}</Td>
                        <Td>{l.vein_pct ?? "—"}</Td>
                        <Td>{l.sulfide_pct ?? "—"}</Td>
                        <Td>
                          <span className={auHi ? "text-amber-600 font-semibold" : ""}>
                            {l.au_gpt ?? "—"}
                          </span>
                        </Td>
                        <Td>
                          <span className={cuHi ? "text-orange-600 font-semibold" : ""}>
                            {l.cu_pct ?? "—"}
                          </span>
                        </Td>
                        <Td>{l.ag_gpt ?? "—"}</Td>
                        <Td>
                          <div className="flex gap-1 justify-end">
                            <button
                              onClick={() => setEditing(l)}
                              className="p-1 rounded hover:bg-accent"
                              title="Editar"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => onDelete(l)}
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

        {(creating || editing) && (
          <CoreLogDialog
            holeId={hole.id}
            projectId={projectId}
            userId={userId}
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
      </DialogContent>
    </Dialog>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-2 py-1.5 font-medium text-text-secondary uppercase tracking-wider text-[10px] whitespace-nowrap">{children}</th>;
}
function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-2 py-1.5 whitespace-nowrap">{children}</td>;
}

function CoreLogDialog({
  holeId,
  projectId,
  userId,
  initial,
  onClose,
  onSaved,
}: {
  holeId: string;
  projectId: string;
  userId: string;
  initial: DrillCoreLog | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    depth_from: initial?.depth_from?.toString() ?? "",
    depth_to: initial?.depth_to?.toString() ?? "",
    lithology: initial?.lithology ?? "",
    alteration: initial?.alteration ?? "",
    mineralization: initial?.mineralization ?? "",
    structure: initial?.structure ?? "",
    rqd_pct: initial?.rqd_pct?.toString() ?? "",
    recovery_pct: initial?.recovery_pct?.toString() ?? "",
    vein_pct: initial?.vein_pct?.toString() ?? "",
    sulfide_pct: initial?.sulfide_pct?.toString() ?? "",
    au_gpt: initial?.au_gpt?.toString() ?? "",
    cu_pct: initial?.cu_pct?.toString() ?? "",
    ag_gpt: initial?.ag_gpt?.toString() ?? "",
    notes: initial?.notes ?? "",
  });
  const [saving, setSaving] = useState(false);

  const onSave = async () => {
    const df = Number(form.depth_from);
    const dt = Number(form.depth_to);
    if (!Number.isFinite(df) || !Number.isFinite(dt)) {
      toast.error("Profundidades requeridas");
      return;
    }
    if (dt <= df) {
      toast.error("Profundidad final debe ser mayor que inicial");
      return;
    }
    setSaving(true);
    const payload = {
      hole_id: holeId,
      project_id: projectId,
      created_by: userId,
      depth_from: df,
      depth_to: dt,
      lithology: form.lithology.trim() || null,
      alteration: form.alteration.trim() || null,
      mineralization: form.mineralization.trim() || null,
      structure: form.structure.trim() || null,
      rqd_pct: form.rqd_pct ? Number(form.rqd_pct) : null,
      recovery_pct: form.recovery_pct ? Number(form.recovery_pct) : null,
      vein_pct: form.vein_pct ? Number(form.vein_pct) : null,
      sulfide_pct: form.sulfide_pct ? Number(form.sulfide_pct) : null,
      au_gpt: form.au_gpt ? Number(form.au_gpt) : null,
      cu_pct: form.cu_pct ? Number(form.cu_pct) : null,
      ag_gpt: form.ag_gpt ? Number(form.ag_gpt) : null,
      notes: form.notes.trim() || null,
    };
    const { error } = initial
      ? await supabase.from("drill_core_logs").update(payload).eq("id", initial.id)
      : await supabase.from("drill_core_logs").insert(payload);
    setSaving(false);
    if (error) toast.error(error.message);
    else {
      toast.success(initial ? "Intervalo actualizado" : "Intervalo creado");
      onSaved();
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial ? "Editar intervalo" : "Nuevo intervalo"}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Desde (m)" required>
            <input type="number" step="0.01" className={inp} value={form.depth_from} onChange={(e) => setForm({ ...form, depth_from: e.target.value })} />
          </Field>
          <Field label="Hasta (m)" required>
            <input type="number" step="0.01" className={inp} value={form.depth_to} onChange={(e) => setForm({ ...form, depth_to: e.target.value })} />
          </Field>
          <Field label="Litología">
            <input className={inp} value={form.lithology} onChange={(e) => setForm({ ...form, lithology: e.target.value })} />
          </Field>
          <Field label="Alteración">
            <input className={inp} value={form.alteration} onChange={(e) => setForm({ ...form, alteration: e.target.value })} />
          </Field>
          <Field label="Mineralización">
            <input className={inp} value={form.mineralization} onChange={(e) => setForm({ ...form, mineralization: e.target.value })} />
          </Field>
          <Field label="Estructura">
            <input className={inp} value={form.structure} onChange={(e) => setForm({ ...form, structure: e.target.value })} />
          </Field>
          <Field label="RQD %">
            <input type="number" step="0.1" className={inp} value={form.rqd_pct} onChange={(e) => setForm({ ...form, rqd_pct: e.target.value })} />
          </Field>
          <Field label="Recovery %">
            <input type="number" step="0.1" className={inp} value={form.recovery_pct} onChange={(e) => setForm({ ...form, recovery_pct: e.target.value })} />
          </Field>
          <Field label="Veta %">
            <input type="number" step="0.1" className={inp} value={form.vein_pct} onChange={(e) => setForm({ ...form, vein_pct: e.target.value })} />
          </Field>
          <Field label="Sulfuros %">
            <input type="number" step="0.1" className={inp} value={form.sulfide_pct} onChange={(e) => setForm({ ...form, sulfide_pct: e.target.value })} />
          </Field>
          <Field label="Au (g/t)">
            <input type="number" step="0.001" className={inp} value={form.au_gpt} onChange={(e) => setForm({ ...form, au_gpt: e.target.value })} />
          </Field>
          <Field label="Cu (%)">
            <input type="number" step="0.001" className={inp} value={form.cu_pct} onChange={(e) => setForm({ ...form, cu_pct: e.target.value })} />
          </Field>
          <Field label="Ag (g/t)">
            <input type="number" step="0.01" className={inp} value={form.ag_gpt} onChange={(e) => setForm({ ...form, ag_gpt: e.target.value })} />
          </Field>
          <div className="col-span-3">
            <Field label="Notas">
              <textarea rows={2} className={inp} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </Field>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-3 py-1.5 text-sm rounded border border-border hover:bg-accent">Cancelar</button>
          <button onClick={onSave} disabled={saving} className="px-3 py-1.5 text-sm rounded bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50">
            {saving ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10px] uppercase tracking-wider text-text-secondary mb-1">
        {label}{required && <span className="text-destructive ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}
