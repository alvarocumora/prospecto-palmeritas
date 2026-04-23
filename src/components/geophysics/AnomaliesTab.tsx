import { useState } from "react";
import {
  Loader2,
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  Target as TargetIcon,
  AlertTriangle,
  Filter,
} from "lucide-react";
import { toast } from "sonner";
import {
  useGeophysicsAnomalies,
  useGeophysicsAnomalyMutations,
  ANOMALY_TYPES,
  ANOMALY_TYPE_LABELS,
  ANOMALY_SEVERITY_META,
  ANOMALY_STATUS_META,
  type GeophysicsAnomaly,
  type AnomalyStatus,
  type AnomalySeverity,
  type AnomalyType,
} from "@/hooks/useGeophysicsAnomalies";
import type { Station } from "@/hooks/useGeophysicsCRUD";
import { PromoteAnomalyDialog } from "./PromoteAnomalyDialog";

type StatusFilter = AnomalyStatus | "all" | "open";

export function AnomaliesTab({
  projectId,
  surveyId,
  stations,
  onChanged,
}: {
  projectId: string;
  surveyId: string;
  stations: Station[];
  onChanged?: () => void;
}) {
  const { data, loading, refresh } = useGeophysicsAnomalies(surveyId);
  const { deleteAnomaly, setStatus } = useGeophysicsAnomalyMutations();
  const [editing, setEditing] = useState<GeophysicsAnomaly | null>(null);
  const [creating, setCreating] = useState(false);
  const [promoting, setPromoting] = useState<GeophysicsAnomaly | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("open");

  const visible = data.filter((a) => {
    if (statusFilter === "all") return true;
    if (statusFilter === "open") return a.status !== "promoted" && a.status !== "dismissed";
    return a.status === statusFilter;
  });

  const counts = {
    detected: data.filter((a) => a.status === "detected").length,
    reviewed: data.filter((a) => a.status === "reviewed").length,
    validated: data.filter((a) => a.status === "validated").length,
    promoted: data.filter((a) => a.status === "promoted").length,
    dismissed: data.filter((a) => a.status === "dismissed").length,
  };

  const onAdvance = async (a: GeophysicsAnomaly) => {
    try {
      const next: AnomalyStatus | null =
        a.status === "detected" ? "reviewed" :
        a.status === "reviewed" ? "validated" : null;
      if (!next) return;
      await setStatus(a.id, next);
      toast.success(next === "validated" ? "Anomalía validada" : "Anomalía revisada");
      refresh();
      onChanged?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    }
  };

  const onDismiss = async (a: GeophysicsAnomaly) => {
    const reason = window.prompt("Motivo del descarte (opcional):") ?? "";
    try {
      await setStatus(a.id, "dismissed", reason || undefined);
      toast.success("Anomalía descartada");
      refresh();
      onChanged?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    }
  };

  return (
    <div>
      <div className="flex flex-wrap justify-between items-center gap-2 mb-3">
        <h2 className="text-xs font-mono uppercase text-muted-foreground">
          Anomalías geofísicas ({data.length})
        </h2>
        <button
          onClick={() => setCreating(true)}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-gold text-bg-primary text-xs font-mono font-semibold hover:bg-gold/90"
        >
          <Plus className="w-3 h-3" /> Registrar anomalía
        </button>
      </div>

      {/* Filter chips */}
      <div className="flex flex-wrap items-center gap-1.5 mb-3 pb-2 border-b border-border">
        <Filter className="w-3 h-3 text-muted-foreground" />
        <Chip active={statusFilter === "open"} onClick={() => setStatusFilter("open")}>
          Activas ({counts.detected + counts.reviewed + counts.validated})
        </Chip>
        <Chip active={statusFilter === "detected"} onClick={() => setStatusFilter("detected")}>
          Detectadas ({counts.detected})
        </Chip>
        <Chip active={statusFilter === "reviewed"} onClick={() => setStatusFilter("reviewed")}>
          Revisadas ({counts.reviewed})
        </Chip>
        <Chip active={statusFilter === "validated"} onClick={() => setStatusFilter("validated")}>
          Validadas ({counts.validated})
        </Chip>
        <Chip active={statusFilter === "promoted"} onClick={() => setStatusFilter("promoted")}>
          Promovidas ({counts.promoted})
        </Chip>
        <Chip active={statusFilter === "dismissed"} onClick={() => setStatusFilter("dismissed")}>
          Descartadas ({counts.dismissed})
        </Chip>
        <Chip active={statusFilter === "all"} onClick={() => setStatusFilter("all")}>
          Todas ({data.length})
        </Chip>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-5 h-5 animate-spin text-gold" />
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded border border-dashed border-border p-12 text-center">
          <AlertTriangle className="w-6 h-6 text-muted-foreground mx-auto mb-2" />
          <p className="text-xs text-muted-foreground">
            {data.length === 0
              ? "Sin anomalías. Registra hallazgos durante el procesamiento."
              : "Sin resultados con el filtro actual."}
          </p>
        </div>
      ) : (
        <div className="rounded border border-border overflow-x-auto">
          <table className="w-full text-xs font-mono">
            <thead className="bg-bg-secondary text-muted-foreground border-b border-border">
              <tr>
                <th className="text-left py-2 px-3">Código</th>
                <th className="text-left py-2 px-3">Tipo</th>
                <th className="text-left py-2 px-3">Severidad</th>
                <th className="text-right py-2 px-3">Conf. %</th>
                <th className="text-right py-2 px-3">Pico</th>
                <th className="text-right py-2 px-3">Prof. (m)</th>
                <th className="text-left py-2 px-3">Estado</th>
                <th className="text-right py-2 px-3 w-48">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((a) => {
                const sev = ANOMALY_SEVERITY_META[a.severity];
                const st = ANOMALY_STATUS_META[a.status];
                const canPromote = a.status === "validated";
                const canAdvance = a.status === "detected" || a.status === "reviewed";
                const canDismiss = a.status !== "promoted" && a.status !== "dismissed";
                return (
                  <tr key={a.id} className="border-b border-border/40 hover:bg-accent/30">
                    <td className="py-2 px-3 text-foreground font-semibold">{a.code}</td>
                    <td className="py-2 px-3 text-gold">{ANOMALY_TYPE_LABELS[a.anomaly_type]}</td>
                    <td className="py-2 px-3">
                      <span className={`inline-block px-1.5 py-0.5 rounded border text-[10px] uppercase ${sev.color}`}>
                        {sev.label}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right">{a.confidence_pct?.toFixed(0) ?? "—"}</td>
                    <td className="py-2 px-3 text-right">
                      {a.peak_value != null ? `${a.peak_value} ${a.peak_unit ?? ""}` : "—"}
                    </td>
                    <td className="py-2 px-3 text-right">{a.estimated_depth_m ?? "—"}</td>
                    <td className="py-2 px-3">
                      <span className={`inline-block px-1.5 py-0.5 rounded border text-[10px] uppercase ${st.color}`}>
                        {st.label}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right">
                      <div className="inline-flex gap-1">
                        {canAdvance && (
                          <button
                            onClick={() => onAdvance(a)}
                            className="p-1 text-muted-foreground hover:text-teal"
                            title={a.status === "detected" ? "Marcar como revisada" : "Validar"}
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {canPromote && (
                          <button
                            onClick={() => setPromoting(a)}
                            className="p-1 text-muted-foreground hover:text-gold"
                            title="Promover a Target"
                          >
                            <TargetIcon className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {canDismiss && (
                          <button
                            onClick={() => onDismiss(a)}
                            className="p-1 text-muted-foreground hover:text-destructive"
                            title="Descartar"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => setEditing(a)}
                          className="p-1 text-muted-foreground hover:text-info"
                          title="Editar"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={async () => {
                            if (!confirm(`¿Eliminar anomalía ${a.code}?`)) return;
                            try {
                              await deleteAnomaly(a.id);
                              toast.success("Eliminada");
                              refresh();
                              onChanged?.();
                            } catch (e) {
                              toast.error(e instanceof Error ? e.message : "Error");
                            }
                          }}
                          className="p-1 text-muted-foreground hover:text-destructive"
                          title="Eliminar"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {(creating || editing) && (
        <AnomalyDialog
          projectId={projectId}
          surveyId={surveyId}
          stations={stations}
          initial={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={() => {
            setCreating(false);
            setEditing(null);
            refresh();
            onChanged?.();
          }}
        />
      )}

      {promoting && (
        <PromoteAnomalyDialog
          anomaly={promoting}
          onClose={() => setPromoting(null)}
          onPromoted={() => {
            setPromoting(null);
            refresh();
            onChanged?.();
          }}
        />
      )}
    </div>
  );
}

/* ---------- Create / Edit dialog ---------- */

function AnomalyDialog({
  projectId,
  surveyId,
  stations,
  initial,
  onClose,
  onSaved,
}: {
  projectId: string;
  surveyId: string;
  stations: Station[];
  initial: GeophysicsAnomaly | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { createAnomaly, updateAnomaly } = useGeophysicsAnomalyMutations();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    code: initial?.code ?? "",
    anomaly_type: (initial?.anomaly_type ?? "magnetic_high") as AnomalyType,
    severity: (initial?.severity ?? "medium") as AnomalySeverity,
    confidence_pct: initial?.confidence_pct?.toString() ?? "",
    lat: initial?.lat?.toString() ?? "",
    lng: initial?.lng?.toString() ?? "",
    peak_value: initial?.peak_value?.toString() ?? "",
    peak_unit: initial?.peak_unit ?? "",
    estimated_depth_m: initial?.estimated_depth_m?.toString() ?? "",
    estimated_area_m2: initial?.estimated_area_m2?.toString() ?? "",
    rationale: initial?.rationale ?? "",
    station_id: initial?.station_id ?? "",
    notes: initial?.notes ?? "",
  });

  const onPickStation = (sid: string) => {
    const s = stations.find((x) => x.id === sid);
    setForm((f) => ({
      ...f,
      station_id: sid,
      lat: s ? s.lat.toString() : f.lat,
      lng: s ? s.lng.toString() : f.lng,
      peak_value: s
        ? (s.mag_nt?.toString() ??
            s.ip_chargeability_mvv?.toString() ??
            s.ip_resistivity_ohmm?.toString() ??
            f.peak_value)
        : f.peak_value,
      peak_unit: s
        ? (s.mag_nt != null ? "nT" : s.ip_chargeability_mvv != null ? "mV/V" : s.ip_resistivity_ohmm != null ? "Ω·m" : f.peak_unit)
        : f.peak_unit,
    }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const conf = form.confidence_pct ? Number(form.confidence_pct) : null;
      if (conf != null && (conf < 0 || conf > 100)) throw new Error("Confianza debe estar entre 0 y 100");
      const payload = {
        code: form.code.trim(),
        anomaly_type: form.anomaly_type,
        severity: form.severity,
        confidence_pct: conf,
        lat: form.lat ? Number(form.lat) : null,
        lng: form.lng ? Number(form.lng) : null,
        peak_value: form.peak_value ? Number(form.peak_value) : null,
        peak_unit: form.peak_unit || null,
        estimated_depth_m: form.estimated_depth_m ? Number(form.estimated_depth_m) : null,
        estimated_area_m2: form.estimated_area_m2 ? Number(form.estimated_area_m2) : null,
        rationale: form.rationale || null,
        station_id: form.station_id || null,
        notes: form.notes || null,
      };
      if (initial) {
        await updateAnomaly(initial.id, payload);
        toast.success("Actualizada");
      } else {
        await createAnomaly(projectId, surveyId, payload);
        toast.success("Anomalía registrada");
      }
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-bg-primary/80 backdrop-blur flex items-center justify-center p-4" onClick={onClose}>
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-lg border border-border bg-background p-5 space-y-3 max-h-[90vh] overflow-y-auto"
      >
        <h2 className="text-base font-mono font-semibold">{initial ? "Editar anomalía" : "Nueva anomalía"}</h2>

        <Field label="Código" required>
          <input
            required
            value={form.code}
            onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
            className="input"
            placeholder="ANOM-001"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Tipo">
            <select
              value={form.anomaly_type}
              onChange={(e) => setForm((f) => ({ ...f, anomaly_type: e.target.value as AnomalyType }))}
              className="input"
            >
              {ANOMALY_TYPES.map((t) => (
                <option key={t} value={t}>
                  {ANOMALY_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Severidad">
            <select
              value={form.severity}
              onChange={(e) => setForm((f) => ({ ...f, severity: e.target.value as AnomalySeverity }))}
              className="input"
            >
              {(["low", "medium", "high", "critical"] as AnomalySeverity[]).map((s) => (
                <option key={s} value={s}>
                  {ANOMALY_SEVERITY_META[s].label}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Estación origen (autocompleta lat/lng)">
          <select
            value={form.station_id}
            onChange={(e) => onPickStation(e.target.value)}
            className="input"
          >
            <option value="">— Sin estación —</option>
            {stations.map((s) => (
              <option key={s.id} value={s.id}>
                {s.station_id} ({s.lat.toFixed(4)}, {s.lng.toFixed(4)})
              </option>
            ))}
          </select>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Latitud">
            <input
              type="number" step="any"
              value={form.lat}
              onChange={(e) => setForm((f) => ({ ...f, lat: e.target.value }))}
              className="input"
            />
          </Field>
          <Field label="Longitud">
            <input
              type="number" step="any"
              value={form.lng}
              onChange={(e) => setForm((f) => ({ ...f, lng: e.target.value }))}
              className="input"
            />
          </Field>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Field label="Pico">
            <input
              type="number" step="any"
              value={form.peak_value}
              onChange={(e) => setForm((f) => ({ ...f, peak_value: e.target.value }))}
              className="input"
            />
          </Field>
          <Field label="Unidad">
            <input
              value={form.peak_unit}
              onChange={(e) => setForm((f) => ({ ...f, peak_unit: e.target.value }))}
              placeholder="nT / mV/V / Ω·m"
              className="input"
            />
          </Field>
          <Field label="Confianza %">
            <input
              type="number" step="1" min="0" max="100"
              value={form.confidence_pct}
              onChange={(e) => setForm((f) => ({ ...f, confidence_pct: e.target.value }))}
              className="input"
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Prof. estimada (m)">
            <input
              type="number" step="1"
              value={form.estimated_depth_m}
              onChange={(e) => setForm((f) => ({ ...f, estimated_depth_m: e.target.value }))}
              className="input"
            />
          </Field>
          <Field label="Área estimada (m²)">
            <input
              type="number" step="1"
              value={form.estimated_area_m2}
              onChange={(e) => setForm((f) => ({ ...f, estimated_area_m2: e.target.value }))}
              className="input"
            />
          </Field>
        </div>

        <Field label="Justificación / racional">
          <textarea
            rows={2}
            value={form.rationale}
            onChange={(e) => setForm((f) => ({ ...f, rationale: e.target.value }))}
            className="input resize-none"
            placeholder="Coincidencia mag-IP, profundidad consistente con vetas conocidas…"
          />
        </Field>

        <Field label="Notas">
          <textarea
            rows={2}
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            className="input resize-none"
          />
        </Field>

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-3 py-1.5 text-xs font-mono rounded border border-border hover:bg-accent">
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving || !form.code.trim()}
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

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
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

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider border transition-colors ${
        active
          ? "border-gold/60 bg-gold/15 text-gold"
          : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/40"
      }`}
    >
      {children}
    </button>
  );
}
