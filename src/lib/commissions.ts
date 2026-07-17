// Lógica pura de comisiones de asociados por deal: cálculo del monto a partir
// de valor del deal y %, y agregación de la liquidación por estado.

export const COMMISSION_STATUSES = ["pendiente", "por_cobrar", "liquidada", "cancelada"] as const;
export type CommissionStatus = (typeof COMMISSION_STATUSES)[number];

export const COMMISSION_STATUS_LABELS: Record<CommissionStatus, string> = {
  pendiente: "Pendiente",
  por_cobrar: "Por cobrar",
  liquidada: "Liquidada",
  cancelada: "Cancelada",
};

/**
 * Monto de comisión: si viene explícito se respeta; si no, se deriva de
 * valor del deal × %. Devuelve null si no hay datos suficientes.
 */
export function commissionAmount(opts: {
  dealValueUsd?: number | null;
  commissionPct?: number | null;
  commissionUsd?: number | null;
}): number | null {
  if (opts.commissionUsd != null && Number.isFinite(opts.commissionUsd)) {
    return Math.max(0, opts.commissionUsd);
  }
  if (
    opts.dealValueUsd != null &&
    opts.commissionPct != null &&
    Number.isFinite(opts.dealValueUsd) &&
    Number.isFinite(opts.commissionPct)
  ) {
    return Math.max(0, (opts.dealValueUsd * opts.commissionPct) / 100);
  }
  return null;
}

export type CommissionLike = {
  status: string;
  commission_usd: number | null;
  commission_pct: number | null;
  deal_value_usd: number | null;
};

export type CommissionTotals = {
  count: number;
  /** Devengado: todo lo que no está cancelado. */
  accruedUsd: number;
  /** Aún no liquidado (pendiente + por cobrar). */
  outstandingUsd: number;
  settledUsd: number;
};

export function commissionTotals(rows: CommissionLike[]): CommissionTotals {
  const t: CommissionTotals = { count: 0, accruedUsd: 0, outstandingUsd: 0, settledUsd: 0 };
  for (const r of rows) {
    if (r.status === "cancelada") continue;
    const amount =
      commissionAmount({
        dealValueUsd: r.deal_value_usd,
        commissionPct: r.commission_pct,
        commissionUsd: r.commission_usd,
      }) ?? 0;
    t.count += 1;
    t.accruedUsd += amount;
    if (r.status === "liquidada") t.settledUsd += amount;
    else t.outstandingUsd += amount;
  }
  return t;
}
