// Cadencia de recordatorios de cobranza (dunning): decide, para un pago
// pendiente, en qué etapa de gestión está y si toca recordar hoy — respetando
// una cadencia para no reenviar de más. Lógica pura y testeable; se apoya en el
// aging de receivables.ts. El envío real y el registro viven en dunning.functions.

import { daysOverdue } from "@/lib/receivables";

export type DunningStage = "scheduled" | "upcoming" | "overdue" | "severe";

export const DUNNING_STAGE_LABELS: Record<DunningStage, string> = {
  scheduled: "Programado",
  upcoming: "Próximo a vencer",
  overdue: "Vencido",
  severe: "Vencido +30d",
};

/** Días antes del vencimiento en que un pago entra en la cola de recordatorios. */
export const UPCOMING_WINDOW_DAYS = 3;
/** Sobre esta mora, la gestión se vuelve "severa" (cadencia más agresiva). */
export const SEVERE_AFTER_DAYS = 30;
/** Cadencia (días entre recordatorios) según gravedad. */
export const OVERDUE_CADENCE_DAYS = 7;
export const SEVERE_CADENCE_DAYS = 4;

/** Días hasta el vencimiento (positivo = futuro), o null si no hay fecha. */
export function daysUntilDue(dueDate: string | null, now: Date): number | null {
  if (!dueDate) return null;
  const t = new Date(dueDate).getTime();
  if (!Number.isFinite(t)) return null;
  return Math.ceil((t - now.getTime()) / 86_400_000);
}

/** Etapa de gestión de cobranza de un pago según su vencimiento. */
export function dunningStage(dueDate: string | null, now: Date): DunningStage {
  const od = daysOverdue(dueDate, now);
  if (od > SEVERE_AFTER_DAYS) return "severe";
  if (od > 0) return "overdue";
  const until = daysUntilDue(dueDate, now);
  if (until != null && until <= UPCOMING_WINDOW_DAYS) return "upcoming";
  return "scheduled";
}

/** Días transcurridos desde el último recordatorio, o null si nunca se envió. */
export function daysSinceReminder(lastReminderAt: string | null, now: Date): number | null {
  if (!lastReminderAt) return null;
  const t = new Date(lastReminderAt).getTime();
  if (!Number.isFinite(t)) return null;
  return Math.floor((now.getTime() - t) / 86_400_000);
}

export type DunningInput = {
  dueDate: string | null;
  lastReminderAt: string | null;
};

/**
 * ¿Toca recordar hoy? Los pagos aún lejos de vencer no se recuerdan; los
 * "próximos a vencer" se recuerdan una sola vez; los vencidos, según cadencia.
 */
export function shouldRemind(input: DunningInput, now: Date): boolean {
  const stage = dunningStage(input.dueDate, now);
  if (stage === "scheduled") return false;
  const since = daysSinceReminder(input.lastReminderAt, now);
  if (stage === "upcoming") return since === null; // aviso único antes de vencer
  const cadence = stage === "severe" ? SEVERE_CADENCE_DAYS : OVERDUE_CADENCE_DAYS;
  return since === null || since >= cadence;
}

const STAGE_RANK: Record<DunningStage, number> = {
  scheduled: 0,
  upcoming: 1,
  overdue: 2,
  severe: 3,
};

/** Prioridad para ordenar la cola (mayor = más urgente). */
export function dunningPriority(dueDate: string | null, now: Date): number {
  const stage = dunningStage(dueDate, now);
  return STAGE_RANK[stage] * 1000 + Math.min(daysOverdue(dueDate, now), 999);
}
