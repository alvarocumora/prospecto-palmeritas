// Economía de ofertas de participación fraccionada (tokenización off-chain).
// Lógica pura y testeable; el server fn recopila oferta + suscripciones y llama
// a estas funciones. Todo referencial: unidades = participaciones, no valores.

export type OfferingLike = {
  total_units: number;
  price_per_unit_usd: number;
  min_units: number;
};

export type SubscriptionLike = {
  investor_user_id: string;
  units: number;
  status: string; // pending | confirmed | rejected | cancelled
};

const ACTIVE = new Set(["pending", "confirmed"]);

export type OfferingStats = {
  totalUnits: number;
  unitsCommitted: number; // pending + confirmed
  unitsConfirmed: number;
  unitsAvailable: number;
  targetRaiseUsd: number;
  committedUsd: number;
  raisedUsd: number; // confirmadas
  pctSubscribed: number; // committed / total
  pctConfirmed: number;
  investorCount: number; // inversionistas con compromiso activo
};

export function offeringStats(o: OfferingLike, subs: SubscriptionLike[]): OfferingStats {
  const active = subs.filter((s) => ACTIVE.has(s.status));
  const confirmed = subs.filter((s) => s.status === "confirmed");
  const unitsCommitted = active.reduce((a, s) => a + s.units, 0);
  const unitsConfirmed = confirmed.reduce((a, s) => a + s.units, 0);
  const price = o.price_per_unit_usd;
  const totalUnits = o.total_units;
  return {
    totalUnits,
    unitsCommitted,
    unitsConfirmed,
    unitsAvailable: Math.max(0, totalUnits - unitsCommitted),
    targetRaiseUsd: totalUnits * price,
    committedUsd: unitsCommitted * price,
    raisedUsd: unitsConfirmed * price,
    pctSubscribed: totalUnits > 0 ? (unitsCommitted / totalUnits) * 100 : 0,
    pctConfirmed: totalUnits > 0 ? (unitsConfirmed / totalUnits) * 100 : 0,
    investorCount: new Set(active.map((s) => s.investor_user_id)).size,
  };
}

/** % de participación de una posición sobre el total emitido. */
export function ownershipPct(units: number, totalUnits: number): number {
  return totalUnits > 0 ? (units / totalUnits) * 100 : 0;
}

export type CapTableEntry = {
  investorUserId: string;
  units: number;
  amountUsd: number;
  pct: number;
  status: "confirmed" | "pending";
};

/** Cap table agregado por inversionista (confirmadas + pendientes activas). */
export function capTable(subs: SubscriptionLike[], o: OfferingLike): CapTableEntry[] {
  const byInvestor = new Map<string, { units: number; anyPending: boolean }>();
  for (const s of subs) {
    if (!ACTIVE.has(s.status)) continue;
    const cur = byInvestor.get(s.investor_user_id) ?? { units: 0, anyPending: false };
    cur.units += s.units;
    if (s.status === "pending") cur.anyPending = true;
    byInvestor.set(s.investor_user_id, cur);
  }
  return Array.from(byInvestor.entries())
    .map(([investorUserId, v]) => ({
      investorUserId,
      units: v.units,
      amountUsd: v.units * o.price_per_unit_usd,
      pct: ownershipPct(v.units, o.total_units),
      status: v.anyPending ? ("pending" as const) : ("confirmed" as const),
    }))
    .sort((a, b) => b.units - a.units);
}

export type SubscriptionValidation = { ok: true } | { ok: false; error: string };

/** Valida un compromiso nuevo contra los mínimos y la disponibilidad. */
export function validateSubscription(
  units: number,
  o: OfferingLike,
  unitsAvailable: number,
): SubscriptionValidation {
  if (!Number.isInteger(units) || units <= 0) return { ok: false, error: "Unidades inválidas." };
  if (units < o.min_units) return { ok: false, error: `El mínimo es ${o.min_units} unidad(es).` };
  if (units > unitsAvailable)
    return { ok: false, error: `Solo quedan ${unitsAvailable} unidad(es) disponibles.` };
  return { ok: true };
}
