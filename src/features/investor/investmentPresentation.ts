import type { PublicRound, WalletPosition } from "@/lib/wallet.functions";

/** Presentation only: committed already includes the issuer's external declaration. */
export function roundBreakdown(
  round: Pick<PublicRound, "target" | "committed" | "settled" | "anchor">,
) {
  const valid =
    [round.target, round.committed, round.settled, round.anchor].every(Number.isFinite) &&
    round.target > 0 &&
    round.committed >= 0 &&
    round.settled >= 0 &&
    round.anchor >= 0 &&
    round.committed >= round.anchor;
  const systemCommitted = valid ? round.committed - round.anchor : null;
  return {
    valid,
    systemCommitted,
    settledPct: valid ? Math.min(100, (round.settled / round.target) * 100) : null,
    combinedPct: valid ? Math.min(100, (round.committed / round.target) * 100) : null,
  };
}

/** Never merge currencies or treat non-active ledger rows as confirmed holdings. */
export function confirmedPositionSummary(positions: WalletPosition[]) {
  const confirmed = positions.filter((p) => p.status === "active");
  const capital = new Map<string, number>();
  for (const p of confirmed)
    capital.set(p.currency, (capital.get(p.currency) ?? 0) + p.amount_paid);
  return { positions: confirmed, capital, shares: confirmed.reduce((sum, p) => sum + p.shares, 0) };
}
export const money = (amount: number, currency = "USD") =>
  `${currency} ${amount.toLocaleString("es-CL", { maximumFractionDigits: currency === "USD" ? 2 : 0 })}`;
