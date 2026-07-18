// Cartera de cobranza (AR/AP aging) cross-trade: toma los pagos pendientes de
// TODOS mis trades y los agrupa por antigüedad de vencimiento y por contraparte.
// "Por cobrar" = pagos de trades donde soy vendedor; "por pagar" = donde soy
// comprador. Lógica pura y testeable; el server fn resuelve la contraparte y
// esta capa clasifica y agrega. No persiste el estado "vencido": se deriva.

export type ReceivableDirection = "por_cobrar" | "por_pagar";

/** Tramos de antigüedad estándar de una cartera (aging). */
export const AGING_BUCKETS = ["current", "d1_30", "d31_60", "d61_90", "d90_plus"] as const;
export type AgingBucket = (typeof AGING_BUCKETS)[number];

export const AGING_BUCKET_LABELS: Record<AgingBucket, string> = {
  current: "Por vencer",
  d1_30: "1–30 días",
  d31_60: "31–60 días",
  d61_90: "61–90 días",
  d90_plus: "+90 días",
};

const emptyBuckets = (): Record<AgingBucket, number> => ({
  current: 0,
  d1_30: 0,
  d31_60: 0,
  d61_90: 0,
  d90_plus: 0,
});

const MS_PER_DAY = 86_400_000;

/** Días de mora respecto al vencimiento (0 si no vencido o sin fecha). */
export function daysOverdue(dueDate: string | null, now: Date): number {
  if (!dueDate) return 0;
  const due = new Date(dueDate).getTime();
  if (!Number.isFinite(due)) return 0;
  const diff = now.getTime() - due;
  if (diff <= 0) return 0;
  return Math.floor(diff / MS_PER_DAY);
}

/** Tramo de antigüedad de un pendiente según su mora. */
export function agingBucket(dueDate: string | null, now: Date): AgingBucket {
  const d = daysOverdue(dueDate, now);
  if (d <= 0) return "current";
  if (d <= 30) return "d1_30";
  if (d <= 60) return "d31_60";
  if (d <= 90) return "d61_90";
  return "d90_plus";
}

/** Pendiente ya resuelto por el server fn (contraparte y monto válido). */
export type ReceivableInput = {
  id: string;
  tradeId: string;
  tradeLabel: string;
  direction: ReceivableDirection;
  counterpartyKey: string;
  counterpartyLabel: string;
  kind: string;
  label: string | null;
  amountUsd: number;
  currency: string;
  dueDate: string | null;
};

export type ReceivableItem = ReceivableInput & {
  daysOverdue: number;
  bucket: AgingBucket;
  overdue: boolean;
};

/** Clasifica un pendiente: calcula mora y tramo. Puro. */
export function classifyReceivable(input: ReceivableInput, now: Date): ReceivableItem {
  const d = daysOverdue(input.dueDate, now);
  return { ...input, daysOverdue: d, bucket: agingBucket(input.dueDate, now), overdue: d > 0 };
}

export type SideSummary = {
  outstandingUsd: number;
  overdueUsd: number;
  count: number;
  overdueCount: number;
  buckets: Record<AgingBucket, number>;
  /** Próximo vencimiento (el pendiente aún no vencido con fecha más cercana). */
  nextDue: { amountUsd: number; dueDate: string; label: string } | null;
};

/** Resumen de una cara de la cartera (por cobrar o por pagar). Puro. */
export function summarizeSide(items: ReceivableItem[]): SideSummary {
  const buckets = emptyBuckets();
  let outstandingUsd = 0;
  let overdueUsd = 0;
  let overdueCount = 0;
  let nextDue: SideSummary["nextDue"] = null;

  for (const it of items) {
    outstandingUsd += it.amountUsd;
    buckets[it.bucket] += it.amountUsd;
    if (it.overdue) {
      overdueUsd += it.amountUsd;
      overdueCount += 1;
    } else if (it.dueDate) {
      // Próximo a vencer: menor fecha futura.
      if (!nextDue || it.dueDate < nextDue.dueDate) {
        nextDue = {
          amountUsd: it.amountUsd,
          dueDate: it.dueDate,
          label: it.counterpartyLabel,
        };
      }
    }
  }

  return {
    outstandingUsd,
    overdueUsd,
    count: items.length,
    overdueCount,
    buckets,
    nextDue,
  };
}

export type CounterpartyAging = {
  counterpartyKey: string;
  counterpartyLabel: string;
  outstandingUsd: number;
  overdueUsd: number;
  count: number;
  /** Tramo más grave con saldo (para ordenar/resaltar). */
  worstBucket: AgingBucket;
};

const BUCKET_SEVERITY: Record<AgingBucket, number> = {
  current: 0,
  d1_30: 1,
  d31_60: 2,
  d61_90: 3,
  d90_plus: 4,
};

/**
 * Agrega la cartera por contraparte, ordenada por gravedad (vencido primero) y
 * luego por saldo. Útil para "¿quién me debe más y hace cuánto?".
 */
export function agingByCounterparty(items: ReceivableItem[]): CounterpartyAging[] {
  const map = new Map<string, CounterpartyAging>();
  for (const it of items) {
    let row = map.get(it.counterpartyKey);
    if (!row) {
      row = {
        counterpartyKey: it.counterpartyKey,
        counterpartyLabel: it.counterpartyLabel,
        outstandingUsd: 0,
        overdueUsd: 0,
        count: 0,
        worstBucket: "current",
      };
      map.set(it.counterpartyKey, row);
    }
    row.outstandingUsd += it.amountUsd;
    row.count += 1;
    if (it.overdue) row.overdueUsd += it.amountUsd;
    if (BUCKET_SEVERITY[it.bucket] > BUCKET_SEVERITY[row.worstBucket]) row.worstBucket = it.bucket;
  }
  return [...map.values()].sort((a, b) => {
    if (BUCKET_SEVERITY[b.worstBucket] !== BUCKET_SEVERITY[a.worstBucket]) {
      return BUCKET_SEVERITY[b.worstBucket] - BUCKET_SEVERITY[a.worstBucket];
    }
    return b.outstandingUsd - a.outstandingUsd;
  });
}
