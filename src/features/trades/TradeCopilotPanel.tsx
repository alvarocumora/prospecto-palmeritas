import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Sparkles, AlertTriangle, RefreshCw, Wand2, CheckCircle2, Loader2 } from "lucide-react";
import {
  getTradeCopilotBrief,
  suggestTradeTerms,
  applyTradeTerms,
  type TradeCopilotBrief,
  type TradeTermsSuggestion,
} from "@/lib/tradeCopilot.functions";

// Copiloto del Trade Desk: resume el estado real y sugiere el próximo paso.
// Todo el contenido proviene de la BD (RLS del usuario) — el modelo solo lo
// interpreta. Diseño Institutional Modernist: papel hueso + acento cobalto.

type Props = { tradeId: string; hasMissingTerms: boolean };

const URGENCY_STYLE: Record<TradeCopilotBrief["nextAction"]["urgency"], string> = {
  alta: "bg-red-500/10 text-red-700 border-red-500/40",
  media: "bg-amber-500/10 text-amber-700 border-amber-500/40",
  baja: "bg-emerald-500/10 text-emerald-700 border-emerald-500/40",
};

export function TradeCopilotPanel({ tradeId, hasMissingTerms }: Props) {
  const qc = useQueryClient();
  const briefFn = useServerFn(getTradeCopilotBrief);
  const suggestFn = useServerFn(suggestTradeTerms);
  const applyFn = useServerFn(applyTradeTerms);

  const [brief, setBrief] = useState<TradeCopilotBrief | null>(null);
  const [suggestion, setSuggestion] = useState<TradeTermsSuggestion | null>(null);

  const briefM = useMutation({
    mutationFn: () => briefFn({ data: { tradeId } }),
    onSuccess: (b) => setBrief(b),
    onError: (e: Error) => toast.error(e.message),
  });

  const suggestM = useMutation({
    mutationFn: () => suggestFn({ data: { tradeId } }),
    onSuccess: (s) => {
      setSuggestion(s);
      if (Object.keys(s.suggestions).length === 0) {
        toast.info("El copiloto no encontró términos citables en el pack.");
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const applyM = useMutation({
    mutationFn: (patch: TradeTermsSuggestion["suggestions"]) =>
      applyFn({ data: { tradeId, ...patch } }),
    onSuccess: (r) => {
      toast.success(`Aplicados ${r.applied.length} campo(s) al trade.`);
      setSuggestion(null);
      qc.invalidateQueries({ queryKey: ["trade-tracking", tradeId] });
      qc.invalidateQueries({ queryKey: ["my-trades"] });
      briefM.mutate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <section
      data-theme="im-light"
      className="rounded-md border border-hairline bg-paper text-ink p-4 md:p-5 shadow-sm"
    >
      <header className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-accent-brand" />
          <h2 className="text-[11px] font-mono uppercase tracking-[0.18em] text-ink/80">
            Trade Copilot
          </h2>
        </div>
        <button
          type="button"
          onClick={() => briefM.mutate()}
          disabled={briefM.isPending}
          className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded border border-hairline hover:bg-ink/5 disabled:opacity-50"
        >
          {briefM.isPending ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <RefreshCw className="w-3.5 h-3.5" />
          )}
          {brief ? "Regenerar" : "Analizar trade"}
        </button>
      </header>

      {!brief && !briefM.isPending && (
        <p className="text-xs text-ink/60 italic">
          El copiloto lee documentos, pagos, embarques y eventos del trade para sugerir el próximo
          paso. Sin datos inventados.
        </p>
      )}

      {briefM.isPending && !brief && (
        <div className="space-y-2">
          <div className="h-4 w-2/3 rounded bg-ink/10 animate-pulse" />
          <div className="h-3 w-full rounded bg-ink/10 animate-pulse" />
          <div className="h-3 w-5/6 rounded bg-ink/10 animate-pulse" />
        </div>
      )}

      {brief && (
        <div className="space-y-4">
          {/* Headline + summary */}
          <div>
            <h3 className="text-base font-serif leading-snug">{brief.headline}</h3>
            <p className="text-sm text-ink/75 mt-1 leading-relaxed">{brief.summary}</p>
          </div>

          {/* Next action */}
          <div
            className={`rounded border p-3 ${URGENCY_STYLE[brief.nextAction.urgency]} text-[13px]`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="font-semibold">{brief.nextAction.title}</div>
              <span className="text-[9px] font-mono uppercase tracking-widest px-1.5 py-0.5 rounded bg-white/50">
                {brief.nextAction.urgency}
              </span>
            </div>
            <p className="text-[12px] mt-1 opacity-90">{brief.nextAction.detail}</p>
          </div>

          {/* Risks */}
          {brief.risks.length > 0 && (
            <ul className="text-xs text-ink/70 space-y-1">
              {brief.risks.map((r, i) => (
                <li key={i} className="flex items-start gap-1.5">
                  <AlertTriangle className="w-3 h-3 text-amber-600 mt-[3px] shrink-0" />
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          )}

          {/* Evidence footer */}
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] font-mono uppercase tracking-wider text-ink/50 border-t border-hairline pt-2">
            <span>{brief.evidence.signedDocs}/{brief.evidence.docs} docs firmados</span>
            <span>{brief.evidence.paidPayments}/{brief.evidence.payments} pagos</span>
            <span>{brief.evidence.shipments} embarques</span>
            <span>{brief.evidence.packVersions} versiones pack</span>
            {brief.evidence.daysSinceLastEvent != null && (
              <span>{brief.evidence.daysSinceLastEvent}d último evento</span>
            )}
          </div>
        </div>
      )}

      {/* Backfill panel — solo si faltan términos */}
      {hasMissingTerms && (
        <div className="mt-4 pt-4 border-t border-hairline">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-ink/70">
              Completar términos faltantes
            </div>
            <button
              type="button"
              onClick={() => suggestM.mutate()}
              disabled={suggestM.isPending}
              className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded border border-hairline hover:bg-ink/5 disabled:opacity-50"
            >
              {suggestM.isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Wand2 className="w-3.5 h-3.5" />
              )}
              Sugerir desde LOI
            </button>
          </div>

          {suggestion && (
            <div className="rounded border border-hairline bg-ink/[0.02] p-3">
              {Object.keys(suggestion.suggestions).length === 0 ? (
                <p className="text-xs text-ink/60 italic">
                  Sin evidencia textual en el pack. Ingresa los términos manualmente en el trade.
                </p>
              ) : (
                <>
                  <table className="w-full text-xs mb-2">
                    <tbody>
                      {Object.entries(suggestion.suggestions).map(([k, v]) => (
                        <tr key={k} className="border-b border-hairline last:border-0">
                          <td className="py-1 font-mono text-ink/60">{k}</td>
                          <td className="py-1 text-ink font-medium">{String(v)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="text-[11px] text-ink/60 italic mb-2">{suggestion.rationale}</p>
                  <button
                    type="button"
                    onClick={() => applyM.mutate(suggestion.suggestions)}
                    disabled={applyM.isPending}
                    className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded bg-accent-brand text-white hover:opacity-90 disabled:opacity-50"
                  >
                    {applyM.isPending ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    )}
                    Aplicar al trade
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
