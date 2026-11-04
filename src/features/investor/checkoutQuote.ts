import { ROUND } from "./pendingTicket";

export type CheckoutSlug = "cholqui" | "losverdes";
export const PRESETS = [15_000, 30_000, 50_000, 100_000] as const;

/** Monto → acciones enteras y % de la ronda, con validación de mínimo y múltiplo. */
export function checkoutQuote(amount: number) {
  const shares = Number.isFinite(amount) ? Math.floor(amount / ROUND.sharePrice) : 0;
  const pctOfRound = (shares / ROUND.shares) * 100;
  let reason: string | null = null;
  if (!(amount >= ROUND.minTicket)) reason = `El mínimo es USD ${ROUND.minTicket.toLocaleString("en-US")}.`;
  else if (amount > ROUND.target) reason = "El monto supera el tamaño de la ronda.";
  else if (amount % ROUND.sharePrice !== 0) reason = `Usa múltiplos de USD ${ROUND.sharePrice}.`;
  return { shares, pctOfRound, valid: reason === null, reason };
}
