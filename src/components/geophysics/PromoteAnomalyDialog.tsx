import { useState } from "react";
import { Loader2, Target as TargetIcon } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";
import {
  useGeophysicsAnomalyMutations,
  ANOMALY_TYPE_LABELS,
  type GeophysicsAnomaly,
} from "@/hooks/useGeophysicsAnomalies";

const TARGET_TYPES = ["vein", "disseminated", "skarn", "porphyry", "epithermal", "iocg", "vms", "placer", "other"] as const;
const PRIORITIES = ["low", "medium", "high", "critical"] as const;

/** Suggest a likely deposit type from the anomaly type — user can override. */
function suggestTargetType(a: GeophysicsAnomaly): string {
  switch (a.anomaly_type) {
    case "ip_high":
    case "csamt_conductor":
      return "disseminated";
    case "magnetic_high":
      return "iocg";
    case "magnetic_low":
      return "epithermal";
    case "resistivity_low":
      return "vein";
    case "gravity_high":
      return "skarn";
    case "radiometric_high":
      return "vein";
    default:
      return "other";
  }
}

function suggestPriority(a: GeophysicsAnomaly): string {
  if (a.severity === "critical") return "critical";
  if (a.severity === "high") return "high";
  if (a.severity === "medium") return "medium";
  return "low";
}

export function PromoteAnomalyDialog({
  anomaly,
  onClose,
  onPromoted,
}: {
  anomaly: GeophysicsAnomaly;
  onClose: () => void;
  onPromoted: () => void;
}) {
  const { promoteToTarget } = useGeophysicsAnomalyMutations();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    code: `T-${anomaly.code}`,
    name: `Target geofísico ${anomaly.code}`,
    target_type: suggestTargetType(anomaly),
    priority: suggestPriority(anomaly),
    commodity: "",
    target_zone: "",
    rationale: anomaly.rationale ?? `Anomalía ${ANOMALY_TYPE_LABELS[anomaly.anomaly_type]} validada en survey geofísico.`,
    planned_meters: "",
    estimated_cost_usd: "",
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { targetId } = await promoteToTarget(anomaly, {
        code: form.code.trim(),
        name: form.name.trim(),
        target_type: form.target_type,
        priority: form.priority,
        commodity: form.commodity || null,
        target_zone: form.target_zone || null,
        rationale: form.rationale || null,
        planned_meters: form.planned_meters ? Number(form.planned_meters) : null,
        estimated_cost_usd: form.estimated_cost_usd ? Number(form.estimated_cost_usd) : null,
      });
      toast.success("Anomalía promovida a target", {
        action: {
          label: "Ver target",
          onClick: () => navigate({ to: "/dashboard/targets" }),
        },
      });
      onPromoted();
      // Best-effort log so future selectors can find it
      console.info("[geophysics] promoted anomaly", anomaly.id, "→ target", targetId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al promover");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-bg-primary/80 backdrop-blur flex items-center justify-center p-4" onClick={onClose}>
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-lg border border-gold/40 bg-background p-5 space-y-3 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center gap-2">
          <TargetIcon className="w-4 h-4 text-gold" />
          <h2 className="text-base font-mono font-semibold">Promover a Exploration Target</h2>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Crea un target en estado <span className="text-gold">validated</span> con la evidencia geofísica
          (anomalía <span className="text-foreground font-semibold">{anomaly.code}</span>,{" "}
          {ANOMALY_TYPE_LABELS[anomaly.anomaly_type]}, conf. {anomaly.confidence_pct ?? "—"}%).
        </p>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Código" required>
            <input
              required
              value={form.code}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
              className="input"
            />
          </Field>
          <Field label="Prioridad">
            <select
              value={form.priority}
              onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}
              className="input"
            >
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Nombre" required>
          <input
            required
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className="input"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Tipo de yacimiento">
            <select
              value={form.target_type}
              onChange={(e) => setForm((f) => ({ ...f, target_type: e.target.value }))}
              className="input"
            >
              {TARGET_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </Field>
          <Field label="Commodity">
            <input
              value={form.commodity}
              onChange={(e) => setForm((f) => ({ ...f, commodity: e.target.value }))}
              placeholder="Au, Cu, Ag…"
              className="input"
            />
          </Field>
        </div>

        <Field label="Zona / sector">
          <input
            value={form.target_zone}
            onChange={(e) => setForm((f) => ({ ...f, target_zone: e.target.value }))}
            className="input"
          />
        </Field>

        <Field label="Justificación">
          <textarea
            rows={3}
            value={form.rationale}
            onChange={(e) => setForm((f) => ({ ...f, rationale: e.target.value }))}
            className="input resize-none"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Metros planeados">
            <input
              type="number" step="1"
              value={form.planned_meters}
              onChange={(e) => setForm((f) => ({ ...f, planned_meters: e.target.value }))}
              className="input"
            />
          </Field>
          <Field label="Costo estimado USD">
            <input
              type="number" step="1"
              value={form.estimated_cost_usd}
              onChange={(e) => setForm((f) => ({ ...f, estimated_cost_usd: e.target.value }))}
              className="input"
            />
          </Field>
        </div>

        <div className="rounded border border-border bg-bg-secondary p-2 text-[10px] font-mono text-muted-foreground">
          Coordenadas heredadas: {anomaly.lat?.toFixed(5) ?? "—"}, {anomaly.lng?.toFixed(5) ?? "—"} ·
          {" "}Conf. {anomaly.confidence_pct ?? "—"}% · Severidad {anomaly.severity}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-3 py-1.5 text-xs font-mono rounded border border-border hover:bg-accent">
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving || !form.code.trim() || !form.name.trim()}
            className="px-3 py-1.5 text-xs font-mono rounded bg-gold text-bg-primary font-semibold hover:bg-gold/90 disabled:opacity-50 inline-flex items-center gap-1.5"
          >
            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <TargetIcon className="w-3 h-3" />}
            Promover a Target
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
