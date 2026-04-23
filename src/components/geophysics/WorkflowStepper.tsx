import { Check, Loader2, MapPin, Radio, Activity, Target as TargetIcon, Lock } from "lucide-react";
import type { ReactNode } from "react";

export type WorkflowPhase = "planned" | "field" | "processing" | "completed";

export const PHASE_ORDER: WorkflowPhase[] = ["planned", "field", "processing", "completed"];

export const PHASE_META: Record<WorkflowPhase, { label: string; icon: ReactNode; description: string }> = {
  planned: {
    label: "Planificada",
    icon: <Activity className="w-3.5 h-3.5" />,
    description: "Define líneas, espaciamiento y objetivos antes de salir a terreno.",
  },
  field: {
    label: "Terreno",
    icon: <MapPin className="w-3.5 h-3.5" />,
    description: "Captura de estaciones en campo. Importa CSV o agrega manualmente.",
  },
  processing: {
    label: "Procesando",
    icon: <Radio className="w-3.5 h-3.5" />,
    description: "Identifica y valida anomalías a partir de los datos adquiridos.",
  },
  completed: {
    label: "Completada",
    icon: <TargetIcon className="w-3.5 h-3.5" />,
    description: "Anomalías validadas promovidas a exploration targets.",
  },
};

/** Map between DB survey.status (legacy values) and workflow phase */
export function phaseFromStatus(status: string): WorkflowPhase {
  switch (status) {
    case "field":
    case "in_progress":
      return "field";
    case "processing":
      return "processing";
    case "completed":
      return "completed";
    case "cancelled":
    case "planned":
    default:
      return "planned";
  }
}

export function statusFromPhase(phase: WorkflowPhase): string {
  // Persist canonical workflow values
  return phase;
}

export function nextPhase(phase: WorkflowPhase): WorkflowPhase | null {
  const i = PHASE_ORDER.indexOf(phase);
  if (i < 0 || i >= PHASE_ORDER.length - 1) return null;
  return PHASE_ORDER[i + 1];
}

export function prevPhase(phase: WorkflowPhase): WorkflowPhase | null {
  const i = PHASE_ORDER.indexOf(phase);
  if (i <= 0) return null;
  return PHASE_ORDER[i - 1];
}

export type PhaseProgress = {
  /** 0..1 completion of the current phase */
  pct: number;
  /** short descriptor like "12 / 25 estaciones" */
  detail: string;
  /** is the phase considered complete enough to advance? */
  canAdvance: boolean;
};

export function WorkflowStepper({
  phase,
  progress,
  busy,
  onAdvance,
  onRevert,
  onJumpTo,
}: {
  phase: WorkflowPhase;
  progress: PhaseProgress;
  busy?: boolean;
  onAdvance: () => void;
  onRevert: () => void;
  onJumpTo: (phase: WorkflowPhase) => void;
}) {
  const idx = PHASE_ORDER.indexOf(phase);
  const next = nextPhase(phase);
  const prev = prevPhase(phase);

  return (
    <div className="rounded border border-border bg-bg-secondary p-4">
      {/* Stepper bar */}
      <div className="flex items-center gap-1 mb-4">
        {PHASE_ORDER.map((p, i) => {
          const meta = PHASE_META[p];
          const isPast = i < idx;
          const isCurrent = i === idx;
          const isFuture = i > idx;
          return (
            <div key={p} className="flex items-center flex-1 last:flex-initial">
              <button
                type="button"
                onClick={() => onJumpTo(p)}
                disabled={isFuture}
                className={`flex items-center gap-2 px-2 py-1.5 rounded transition-colors ${
                  isCurrent
                    ? "bg-gold/15 border border-gold/40"
                    : isPast
                      ? "border border-teal/30 bg-teal/10 hover:bg-teal/15"
                      : "border border-border opacity-50 cursor-not-allowed"
                }`}
                title={meta.description}
              >
                <span
                  className={`flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-mono font-bold ${
                    isCurrent
                      ? "bg-gold text-bg-primary"
                      : isPast
                        ? "bg-teal text-bg-primary"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  {isPast ? <Check className="w-3 h-3" /> : isFuture ? <Lock className="w-2.5 h-2.5" /> : i + 1}
                </span>
                <span
                  className={`text-[10px] font-mono uppercase tracking-wider ${
                    isCurrent ? "text-gold" : isPast ? "text-teal" : "text-muted-foreground"
                  }`}
                >
                  {meta.label}
                </span>
              </button>
              {i < PHASE_ORDER.length - 1 && (
                <div className={`flex-1 h-px mx-1 ${i < idx ? "bg-teal/40" : "bg-border"}`} />
              )}
            </div>
          );
        })}
      </div>

      {/* Current phase detail + progress */}
      <div className="grid md:grid-cols-[1fr_auto] gap-3 items-center">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="text-gold">{PHASE_META[phase].icon}</span>
            <span className="text-foreground font-semibold">{PHASE_META[phase].label}</span>
            <span className="text-muted-foreground">· {progress.detail}</span>
          </div>
          <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full transition-all ${progress.canAdvance ? "bg-teal" : "bg-gold"}`}
              style={{ width: `${Math.max(2, Math.min(100, Math.round(progress.pct * 100)))}%` }}
            />
          </div>
          <p className="text-[10px] text-muted-foreground mt-1.5">{PHASE_META[phase].description}</p>
        </div>

        <div className="flex items-center gap-2">
          {prev && (
            <button
              type="button"
              onClick={onRevert}
              disabled={busy}
              className="px-2.5 py-1.5 rounded border border-border text-[11px] font-mono hover:bg-accent disabled:opacity-50"
              title={`Volver a ${PHASE_META[prev].label.toLowerCase()}`}
            >
              ← {PHASE_META[prev].label}
            </button>
          )}
          {next ? (
            <button
              type="button"
              onClick={onAdvance}
              disabled={busy || !progress.canAdvance}
              className="px-3 py-1.5 rounded bg-gold text-bg-primary text-[11px] font-mono font-semibold hover:bg-gold/90 disabled:opacity-40 inline-flex items-center gap-1.5"
              title={
                progress.canAdvance
                  ? `Avanzar a ${PHASE_META[next].label}`
                  : "La fase actual no tiene progreso suficiente"
              }
            >
              {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
              {PHASE_META[next].label} →
            </button>
          ) : (
            <span className="px-3 py-1.5 rounded bg-teal/15 border border-teal/30 text-teal text-[11px] font-mono inline-flex items-center gap-1.5">
              <Check className="w-3 h-3" /> Cerrada
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
