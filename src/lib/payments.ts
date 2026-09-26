// Capa financiera del trade (lógica pura): cronograma de pagos de una
// operación y su resumen (programado / cobrado / por cobrar / vencido).
// El estado "vencido" se deriva de la fecha; no se persiste.

export const PAYMENT_KINDS = [
  "anticipo",
  "contra_embarque",
  "contra_entrega",
  "balance",
  "comision",
  "otro",
] as const;
export type PaymentKind = (typeof PAYMENT_KINDS)[number];

export const PAYMENT_KIND_LABELS: Record<PaymentKind, string> = {
  anticipo: "Anticipo",
  contra_embarque: "Contra embarque",
  contra_entrega: "Contra entrega",
  balance: "Balance final",
  comision: "Comisión",
  otro: "Otro",
};

// Estado persistido: programado | pagado | cancelado. "vencido" se calcula.
export const PAYMENT_STATUSES = ["programado", "pagado", "cancelado"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export type EffectivePaymentStatus = "programado" | "pagado" | "cancelado" | "vencido";

export const PAYMENT_STATUS_LABELS: Record<EffectivePaymentStatus, string> = {
  programado: "Programado",
  pagado: "Pagado",
  cancelado: "Cancelado",
  vencido: "Vencido",
};

export type PaymentLike = {
  status: string;
  amount_usd: number | null;
  due_date: string | null;
  paid_at: string | null;
};

/** Estado efectivo: un pago programado con fecha vencida cuenta como "vencido". */
export function effectivePaymentStatus(p: PaymentLike, now: Date): EffectivePaymentStatus {
  if (p.status === "pagado") return "pagado";
  if (p.status === "cancelado") return "cancelado";
  if (p.due_date && new Date(p.due_date) < now) return "vencido";
  return "programado";
}

export type PaymentsSummary = {
  /** Total comprometido (no cancelado). */
  scheduledUsd: number;
  /** Cobrado (status pagado). */
  paidUsd: number;
  /** Por cobrar = programado no pagado (incluye vencidos). */
  outstandingUsd: number;
  /** Vencido = programado con fecha pasada. */
  overdueUsd: number;
  /** Próximo pago programado (menor due_date pendiente). */
  nextDue: { amountUsd: number; dueDate: string } | null;
  /** % cobrado sobre lo comprometido (0–100). */
  progressPct: number;
};

/** Un pago solo cuenta en el resumen si tiene monto positivo. Registros con
 *  monto nulo o ≤ 0 son inválidos y se ignoran para no inflar el progreso. */
export function isValidPaymentAmount(amount: number | null | undefined): amount is number {
  return typeof amount === "number" && isFinite(amount) && amount > 0;
}

export function summarizePayments(rows: PaymentLike[], now: Date): PaymentsSummary {
  let scheduledUsd = 0;
  let paidUsd = 0;
  let overdueUsd = 0;
  let nextDue: { amountUsd: number; dueDate: string } | null = null;

  for (const p of rows) {
    const st = effectivePaymentStatus(p, now);
    if (st === "cancelado") continue;
    if (!isValidPaymentAmount(p.amount_usd)) continue; // inválido: no infla el progreso
    const amount = p.amount_usd;
    scheduledUsd += amount;
    if (st === "pagado") {
      paidUsd += amount;
      continue;
    }
    // programado o vencido → pendiente de cobro
    if (st === "vencido") overdueUsd += amount;
    if (p.due_date) {
      if (!nextDue || p.due_date < nextDue.dueDate) {
        nextDue = { amountUsd: amount, dueDate: p.due_date };
      }
    }
  }

  const outstandingUsd = Math.max(0, scheduledUsd - paidUsd);
  const progressPct = scheduledUsd > 0 ? Math.round((paidUsd / scheduledUsd) * 100) : 0;
  return { scheduledUsd, paidUsd, outstandingUsd, overdueUsd, nextDue, progressPct };
}
