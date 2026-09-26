import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Check, ChevronRight, CircleDot, History, PauseCircle, XCircle } from "lucide-react";
import {
  advanceDealStage,
  getDealFlow,
  DEAL_STAGES,
  DEAL_STAGE_LABEL,
  DEAL_TERMINAL_STAGES,
  type DealStage,
} from "@/lib/dealFlow.functions";
import { cn } from "@/lib/utils";

const EXIT_STAGES: DealStage[] = ["retirado", "rechazado", "descartado", "expirado"];

/** Traza el avance del deal (interesado → NDA → data room → oferta → DD → cierre). */
export function DealStageTracker({
  listingId,
  onAdvanced,
}: {
  listingId: string;
  onAdvanced?: () => void;
}) {
  const fetchFlow = useServerFn(getDealFlow);
  const advance = useServerFn(advanceDealStage);
  const qc = useQueryClient();
  const [note, setNote] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["deal-flow", listingId],
    queryFn: () => fetchFlow({ data: { listingId } }),
  });

  const mutation = useMutation({
    mutationFn: (stage: DealStage) =>
      advance({ data: { inquiryId: data!.inquiryId, stage, note: note.trim() || undefined } }),
    onSuccess: (_r, stage) => {
      setNote("");
      toast.success(`Deal avanzado a ${DEAL_STAGE_LABEL[stage]}`);
      qc.invalidateQueries({ queryKey: ["deal-flow", listingId] });
      onAdvanced?.();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <div className="p-3 rounded border border-border text-[11px] font-mono text-muted-foreground">
        Cargando estado del deal…
      </div>
    );
  }
  if (!data) return null;

  const currentIndex = DEAL_STAGES.indexOf(data.stage as (typeof DEAL_STAGES)[number]);
  const exited = EXIT_STAGES.includes(data.stage);
  const paused = data.stage === "pausado";
  const offLine = exited || paused;
  const closed = DEAL_TERMINAL_STAGES.includes(data.stage);

  return (
    <section className="p-3 rounded border border-border bg-bg-elevated space-y-3">
      <div className="flex items-center gap-2">
        <CircleDot className="w-4 h-4 text-gold" />
        <h3 className="text-xs font-mono font-semibold">Avance del deal</h3>
        <span
          className={cn(
            "ml-auto px-1.5 py-0.5 rounded text-[10px] font-mono border",
            exited
              ? "border-destructive/40 text-destructive"
              : paused
                ? "border-border text-muted-foreground"
                : "border-gold/40 text-gold bg-gold/10",
          )}
        >
          {DEAL_STAGE_LABEL[data.stage]}
        </span>
      </div>

      {/* Línea de etapas */}
      <ol className="flex flex-wrap items-center gap-1">
        {DEAL_STAGES.map((s, i) => {
          const done = !offLine && i < currentIndex;
          const active = !offLine && i === currentIndex;
          return (
            <li key={s} className="flex items-center gap-1">
              <span
                className={cn(
                  "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono border",
                  active
                    ? "border-gold text-gold bg-gold/10"
                    : done
                      ? "border-border text-foreground"
                      : "border-border text-muted-foreground opacity-60",
                )}
              >
                {done && <Check className="w-3 h-3" />}
                {DEAL_STAGE_LABEL[s]}
              </span>
              {i < DEAL_STAGES.length - 1 && (
                <ChevronRight className="w-3 h-3 text-muted-foreground" />
              )}
            </li>
          );
        })}
      </ol>

      {closed && (
        <p className="text-[10px] font-mono text-muted-foreground">
          Este deal está cerrado ({DEAL_STAGE_LABEL[data.stage]}) y no admite más movimientos.
        </p>
      )}

      {data.nextStages.length > 0 && (
        <div className="space-y-2">
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Nota del avance (opcional)"
            className="w-full px-2 py-1.5 text-[11px] font-mono rounded border border-border bg-background outline-none focus:border-gold"
          />
          <div className="flex flex-wrap gap-2">
            {data.nextStages.map((s) => {
              const isExit = EXIT_STAGES.includes(s);
              const isPause = s === "pausado";
              const isResume = paused && !isExit;
              return (
                <button
                  key={s}
                  type="button"
                  disabled={mutation.isPending}
                  onClick={() => mutation.mutate(s)}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-mono disabled:opacity-50",
                    isExit
                      ? "border border-border text-muted-foreground hover:text-destructive"
                      : isPause
                        ? "border border-border text-muted-foreground hover:text-foreground"
                        : "bg-gold text-bg-primary font-semibold hover:bg-gold/90",
                  )}
                >
                  {isExit ? (
                    <XCircle className="w-3.5 h-3.5" />
                  ) : isPause ? (
                    <PauseCircle className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5" />
                  )}
                  {isExit
                    ? s === "retirado"
                      ? "Retirarme"
                      : "Rechazar"
                    : isPause
                      ? "Pausar"
                      : isResume
                        ? `Retomar en ${DEAL_STAGE_LABEL[s]}`
                        : `Pasar a ${DEAL_STAGE_LABEL[s]}`}
                </button>
              );
            })}
          </div>
          {!data.isOwner && (
            <p className="text-[10px] font-mono text-muted-foreground">
              La apertura del data room, el due diligence, el cierre y el rechazo los confirma el
              titular del proyecto.
            </p>
          )}
        </div>
      )}

      {data.events.length > 0 && (
        <div>
          <div className="flex items-center gap-1 text-[10px] font-mono uppercase text-muted-foreground mb-1">
            <History className="w-3 h-3" /> Bitácora
          </div>
          <ul className="space-y-1">
            {data.events.map((e) => (
              <li key={e.id} className="text-[10px] font-mono text-muted-foreground">
                {new Date(e.created_at).toLocaleString("es-CL")} ·{" "}
                <span className="text-foreground">
                  {e.from_stage ? `${e.from_stage} → ` : ""}
                  {e.to_stage}
                </span>
                {e.note ? ` — ${e.note}` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
