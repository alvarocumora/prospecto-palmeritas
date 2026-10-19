import type { PublicRound } from "@/lib/wallet.functions";

const usd = (n: number) => `USD ${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

/** Barra de financiamiento colectivo: liquidado (sólido) + comprometido (tenue). */
export function RoundProgress({ round, compact }: { round: PublicRound; compact?: boolean }) {
  const settledPct = Math.min(100, (round.settled / round.target) * 100);
  const committedPct = Math.min(100, (round.committed / round.target) * 100);
  const sharesLeft = Math.max(0, round.shares - Math.floor(round.committed / round.sharePrice));
  return (
    <div className={compact ? "mt-3" : "mt-4"}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-serif text-xl">{usd(round.committed)}</span>
        <span className="font-mono text-[11px] text-content-muted">
          de {usd(round.target)} · {committedPct.toFixed(1)} %
        </span>
      </div>
      <div
        className="mt-2 h-2 w-full bg-hairline relative overflow-hidden"
        role="progressbar"
        aria-valuenow={Math.round(committedPct)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="absolute inset-y-0 left-0 bg-accent-brand/35"
          style={{ width: `${committedPct}%` }}
        />
        <div
          className="absolute inset-y-0 left-0 bg-accent-brand"
          style={{ width: `${settledPct}%` }}
        />
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2 text-[11px] text-content-muted">
        <span>{round.investors} tickets</span>
        <span>{sharesLeft.toLocaleString("es-CL")} acciones libres</span>
        <span className="text-right">{round.open ? "Ronda abierta" : "Apertura próxima"}</span>
      </div>
    </div>
  );
}
