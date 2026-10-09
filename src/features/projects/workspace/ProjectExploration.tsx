import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Activity, Plus, Pencil, Trash2, Loader2, ArrowRight, Radio } from "lucide-react";
import { useProjects } from "@/hooks/useProjects";
import {
  useSurveys,
  useGeophysicsMutations,
  SURVEY_METHODS,
  SURVEY_STATUS,
  type Survey,
} from "@/hooks/useGeophysicsCRUD";
import { toast } from "sonner";

export function GeophysicsModule({ projectId }: { projectId: string }) {
  const { projects } = useProjects();
  const active = projects.find((project) => project.id === projectId);
  const { surveys, loading, error, refresh } = useSurveys(projectId);
  const { deleteSurvey } = useGeophysicsMutations();
  const [editing, setEditing] = useState<Survey | null>(null);
  const [creating, setCreating] = useState(false);

  const totalKm = surveys.reduce((s, x) => s + (x.planned_km ?? 0), 0);
  const totalCost = surveys.reduce((s, x) => s + (x.cost_usd ?? 0), 0);

  if (!active) {
    return (
      <div className="p-4 md:p-8 max-w-3xl mx-auto pb-20 md:pb-8">
        <h1 className="text-2xl font-bold mb-2">Geofísica</h1>
        <div className="rounded border border-dashed border-border p-12 text-center mt-6">
          <Activity className="w-8 h-8 text-gold mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            Selecciona o crea un proyecto para gestionar campañas geofísicas.
          </p>
          <Link
            to="/dashboard/projects"
            className="inline-block mt-4 text-xs font-mono text-gold hover:underline"
          >
            Ir a proyectos →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto pb-20 md:pb-8">
      <header className="flex flex-wrap items-end justify-between gap-3 mb-6">
        <div>
          <div className="text-[10px] uppercase font-mono text-muted-foreground">
            {active.code} · {active.name}
          </div>
          <h1 className="text-2xl font-bold flex items-center gap-2 mt-1">
            <Activity className="w-5 h-5 text-gold" /> Campañas geofísicas
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Planifica adquisición · gestiona líneas y estaciones · vincula al mapa.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded bg-gold text-bg-primary font-mono text-xs font-semibold hover:bg-gold/90"
        >
          <Plus className="w-3.5 h-3.5" /> Nueva campaña
        </button>
      </header>

      {/* Totals */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Stat label="Campañas" value={surveys.length.toString()} />
        <Stat label="Km planeados" value={totalKm.toLocaleString("es-CL")} />
        <Stat label="Costo USD" value={totalCost.toLocaleString("es-CL")} />
        <Stat
          label="Activas"
          value={surveys.filter((s) => s.status === "in_progress").length.toString()}
        />
      </div>

      {error && (
        <div className="p-3 mb-4 rounded border border-destructive/40 bg-destructive/10 text-xs font-mono text-destructive">
          Error: {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-gold" />
        </div>
      ) : surveys.length === 0 ? (
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="w-full rounded border border-dashed border-gold/40 bg-gold/5 hover:bg-gold/10 transition-colors p-12 text-center"
        >
          <Radio className="w-8 h-8 text-gold mx-auto mb-3" />
          <div className="font-mono font-semibold">Crear primera campaña</div>
          <div className="text-xs text-muted-foreground mt-1">
            Magnetometría, IP, CSAMT, gravimetría...
          </div>
        </button>
      ) : (
        <div className="rounded border border-border overflow-hidden">
          <table className="w-full text-xs font-mono">
            <thead className="bg-bg-secondary text-muted-foreground border-b border-border">
              <tr>
                <th className="text-left py-2.5 px-3">Campaña</th>
                <th className="text-left py-2.5 px-3">Método</th>
                <th className="text-right py-2.5 px-3">Km</th>
                <th className="text-right py-2.5 px-3">Espac. (m)</th>
                <th className="text-right py-2.5 px-3">Prof. (m)</th>
                <th className="text-right py-2.5 px-3">USD</th>
                <th className="text-left py-2.5 px-3">Estado</th>
                <th className="text-right py-2.5 px-3 w-32">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {surveys.map((s) => (
                <tr key={s.id} className="border-b border-border/40 hover:bg-accent/30">
                  <td className="py-2.5 px-3 text-foreground font-semibold">
                    <Link
                      to="/dashboard/geophysics/$surveyId"
                      search={{ project: projectId }}
                      params={{ surveyId: s.id }}
                      className="hover:text-gold"
                    >
                      {s.name}
                    </Link>
                  </td>
                  <td className="py-2.5 px-3 text-gold">{s.method}</td>
                  <td className="py-2.5 px-3 text-right">{s.planned_km ?? "—"}</td>
                  <td className="py-2.5 px-3 text-right">{s.station_spacing_m ?? "—"}</td>
                  <td className="py-2.5 px-3 text-right">{s.expected_depth_m ?? "—"}</td>
                  <td className="py-2.5 px-3 text-right">
                    {s.cost_usd?.toLocaleString("es-CL") ?? "—"}
                  </td>
                  <td className="py-2.5 px-3">
                    <StatusBadge status={s.status} />
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <div className="inline-flex items-center gap-1">
                      <Link
                        to="/dashboard/geophysics/$surveyId"
                      search={{ project: projectId }}
                        params={{ surveyId: s.id }}
                        className="p-1.5 text-muted-foreground hover:text-gold"
                        title="Ver detalle"
                      >
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                      <button
                        type="button"
                        onClick={() => setEditing(s)}
                        className="p-1.5 text-muted-foreground hover:text-info"
                        title="Editar"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          if (
                            !confirm(
                              `¿Eliminar "${s.name}"? Se borrarán también líneas y estaciones asociadas.`,
                            )
                          )
                            return;
                          try {
                            await deleteSurvey(s.id);
                            toast.success("Campaña eliminada");
                            refresh();
                          } catch (e) {
                            toast.error(e instanceof Error ? e.message : "Error");
                          }
                        }}
                        className="p-1.5 text-muted-foreground hover:text-destructive"
                        title="Eliminar"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(creating || editing) && (
        <SurveyDialog
          projectId={active.id}
          initial={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={() => {
            setCreating(false);
            setEditing(null);
            refresh();
          }}
        />
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-border bg-bg-secondary p-3">
      <div className="text-[10px] uppercase font-mono text-muted-foreground">{label}</div>
      <div className="text-lg font-mono font-semibold mt-1">{value}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "completed"
      ? "bg-teal/10 text-teal border-teal/30"
      : status === "in_progress"
        ? "bg-gold/10 text-gold border-gold/30"
        : status === "cancelled"
          ? "bg-destructive/10 text-destructive border-destructive/30"
          : "bg-muted text-muted-foreground border-border";
  return (
    <span className={`inline-block px-1.5 py-0.5 rounded border text-[10px] uppercase ${tone}`}>
      {status}
    </span>
  );
}

function SurveyDialog({
  projectId,
  initial,
  onClose,
  onSaved,
}: {
  projectId: string;
  initial: Survey | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { createSurvey, updateSurvey } = useGeophysicsMutations();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: initial?.name ?? "",
    method: initial?.method ?? SURVEY_METHODS[0],
    status: initial?.status ?? "planned",
    planned_km: initial?.planned_km?.toString() ?? "",
    cost_usd: initial?.cost_usd?.toString() ?? "",
    station_spacing_m: initial?.station_spacing_m?.toString() ?? "",
    expected_depth_m: initial?.expected_depth_m?.toString() ?? "",
    notes: initial?.notes ?? "",
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        method: form.method,
        status: form.status,
        planned_km: form.planned_km ? Number(form.planned_km) : null,
        cost_usd: form.cost_usd ? Number(form.cost_usd) : null,
        station_spacing_m: form.station_spacing_m ? Number(form.station_spacing_m) : null,
        expected_depth_m: form.expected_depth_m ? Number(form.expected_depth_m) : null,
        notes: form.notes || null,
      };
      if (initial) {
        await updateSurvey(initial.id, payload);
        toast.success("Campaña actualizada");
      } else {
        await createSurvey(projectId, payload);
        toast.success("Campaña creada");
      }
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-bg-primary/80 backdrop-blur flex items-center justify-center p-4"
      onClick={onClose}
    >
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-lg border border-border bg-background p-5 space-y-3 max-h-[90vh] overflow-y-auto"
      >
        <h2 className="text-base font-mono font-semibold">
          {initial ? "Editar campaña" : "Nueva campaña"}
        </h2>

        <Field label="Nombre" required>
          <input
            required
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className="w-full px-2.5 py-1.5 text-xs font-mono rounded border border-border bg-bg-secondary"
            placeholder="Ej: MAG-2025 sector norte"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Método">
            <select
              value={form.method}
              onChange={(e) => setForm((f) => ({ ...f, method: e.target.value }))}
              className="w-full px-2.5 py-1.5 text-xs font-mono rounded border border-border bg-bg-secondary"
            >
              {SURVEY_METHODS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Estado">
            <select
              value={form.status}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
              className="w-full px-2.5 py-1.5 text-xs font-mono rounded border border-border bg-bg-secondary"
            >
              {SURVEY_STATUS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Km planeados">
            <input
              type="number"
              step="0.1"
              value={form.planned_km}
              onChange={(e) => setForm((f) => ({ ...f, planned_km: e.target.value }))}
              className="w-full px-2.5 py-1.5 text-xs font-mono rounded border border-border bg-bg-secondary"
            />
          </Field>
          <Field label="Costo USD">
            <input
              type="number"
              step="1"
              value={form.cost_usd}
              onChange={(e) => setForm((f) => ({ ...f, cost_usd: e.target.value }))}
              className="w-full px-2.5 py-1.5 text-xs font-mono rounded border border-border bg-bg-secondary"
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Espaciamiento (m)">
            <input
              type="number"
              step="1"
              value={form.station_spacing_m}
              onChange={(e) => setForm((f) => ({ ...f, station_spacing_m: e.target.value }))}
              className="w-full px-2.5 py-1.5 text-xs font-mono rounded border border-border bg-bg-secondary"
            />
          </Field>
          <Field label="Profundidad esp. (m)">
            <input
              type="number"
              step="1"
              value={form.expected_depth_m}
              onChange={(e) => setForm((f) => ({ ...f, expected_depth_m: e.target.value }))}
              className="w-full px-2.5 py-1.5 text-xs font-mono rounded border border-border bg-bg-secondary"
            />
          </Field>
        </div>

        <Field label="Notas">
          <textarea
            rows={3}
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            className="w-full px-2.5 py-1.5 text-xs font-mono rounded border border-border bg-bg-secondary resize-none"
          />
        </Field>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-xs font-mono rounded border border-border hover:bg-accent"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving || !form.name.trim()}
            className="px-3 py-1.5 text-xs font-mono rounded bg-gold text-bg-primary font-semibold hover:bg-gold/90 disabled:opacity-50 inline-flex items-center gap-1.5"
          >
            {saving && <Loader2 className="w-3 h-3 animate-spin" />}
            {initial ? "Guardar" : "Crear"}
          </button>
        </div>
      </form>
    </div>
  );
}

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
    <label className="block">
      <div className="text-[10px] uppercase font-mono text-muted-foreground mb-1">
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </div>
      {children}
    </label>
  );
}
