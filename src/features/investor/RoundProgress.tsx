import type { PublicRound } from "@/lib/wallet.functions";
import { money, roundBreakdown } from "./investmentPresentation";

export function RoundProgress({ round, compact }: { round: PublicRound; compact?: boolean }) {
  const b = roundBreakdown(round);
  return (
    <div
      className={
        compact ? "mt-4 border-t border-hairline pt-4" : "mt-5 border-t border-hairline pt-5"
      }
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-xs font-medium text-content-muted">
          Objetivo de ronda · referencial
        </span>
        <span className="font-mono text-sm">{b.valid ? money(round.target) : "Por verificar"}</span>
      </div>
      {b.valid && (
        <div
          className="relative mt-3 h-2.5 overflow-hidden bg-hairline"
          role="progressbar"
          aria-label="Compromisos y colocación declarada, no capital liquidado"
          aria-valuenow={Math.round(b.combinedPct ?? 0)}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="absolute inset-y-0 left-0 bg-accent-brand/25"
            style={{ width: `${b.combinedPct}%` }}
          />
          <div
            className="absolute inset-y-0 left-0 bg-accent-brand"
            style={{ width: `${b.settledPct}%` }}
          />
        </div>
      )}
      {b.valid && (
        <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[11px] leading-relaxed text-content-muted">
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden className="h-2 w-2 shrink-0 bg-accent-brand" />
            Liquidado · {b.settledPct?.toFixed(1)} %
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span
              aria-hidden
              className="h-2 w-2 shrink-0 border border-accent-brand bg-accent-brand/25"
            />
            Comprometido + declarado · {b.combinedPct?.toFixed(1)} %
          </span>
        </div>
      )}
      <dl className="mt-4 space-y-2 text-xs">
        <Row
          label="Capital liquidado · sistema"
          value={b.valid ? money(round.settled) : "Por verificar"}
        />
        <Row
          label="Compromisos · sistema"
          value={b.systemCommitted === null ? "Por verificar" : money(b.systemCommitted)}
        />
        <Row
          label="Colocación externa · declarada por emisora"
          value={b.valid ? money(round.anchor) : "Por verificar"}
        />
      </dl>
      <p className="mt-3 text-[11px] leading-relaxed text-content-muted">
        {round.investors} tickets del sistema · {round.open ? "Ronda abierta" : "Ronda cerrada"}. La
        colocación declarada no acredita pago ni emisión; compromisos y liquidado no se suman entre
        sí.
      </p>
    </div>
  );
}
function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-hairline/60 pb-2 last:border-b-0">
      <dt className="text-content-muted">{label}</dt>
      <dd className="font-mono font-medium tabular-nums">{value}</dd>
    </div>
  );
}
