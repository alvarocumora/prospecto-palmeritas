// Reglas de negocio del registro de solicitudes de anticipo (financiamiento
// contra un lote verificado). Lógica pura y testeable; el server fn
// (advanceRequests.functions.ts) las aplica sobre la base de datos.

import type { AdvanceEligibility } from "@/lib/underwriting";

export type AdvanceStatus =
  | "requested" // el productor solicitó
  | "under_review" // el financista está revisando
  | "approved" // aprobado, pendiente de desembolso
  | "funded" // desembolsado
  | "rejected" // rechazado
  | "cancelled"; // cancelado por el productor

export const ADVANCE_STATUS_LABELS: Record<AdvanceStatus, string> = {
  requested: "Solicitado",
  under_review: "En revisión",
  approved: "Aprobado",
  funded: "Desembolsado",
  rejected: "Rechazado",
  cancelled: "Cancelado",
};

/** Un estado es terminal si no admite más transiciones. */
export function isTerminalStatus(s: AdvanceStatus): boolean {
  return s === "funded" || s === "rejected" || s === "cancelled";
}

/** Solo un lote elegible o condicional puede originar una solicitud. */
export function canRequestAdvance(eligibility: AdvanceEligibility): boolean {
  return eligibility === "eligible" || eligibility === "conditional";
}

/**
 * Valida el monto solicitado contra el anticipo máximo pre-aprobado.
 * Tolera 1 USD de redondeo por encima del tope.
 */
export function validateRequestedAmount(
  requested: number,
  maxAdvanceUsd: number | null,
): { ok: boolean; error?: string } {
  if (!Number.isFinite(requested) || requested <= 0) {
    return { ok: false, error: "El monto solicitado debe ser mayor a cero." };
  }
  if (maxAdvanceUsd == null || maxAdvanceUsd <= 0) {
    return { ok: false, error: "El lote no tiene un anticipo pre-aprobado." };
  }
  if (requested > maxAdvanceUsd + 1) {
    return { ok: false, error: "El monto supera el anticipo máximo pre-aprobado." };
  }
  return { ok: true };
}

/**
 * Transiciones de estado permitidas según el rol.
 * - requester: puede cancelar mientras no sea terminal.
 * - funder (financista/admin): avanza la revisión.
 */
export function nextStatusesFor(
  role: "requester" | "funder",
  current: AdvanceStatus,
): AdvanceStatus[] {
  if (isTerminalStatus(current)) return [];
  if (role === "requester") return ["cancelled"];
  // funder
  switch (current) {
    case "requested":
      return ["under_review", "rejected"];
    case "under_review":
      return ["approved", "rejected"];
    case "approved":
      return ["funded", "rejected"];
    default:
      return [];
  }
}

/** ¿Puede `role` mover la solicitud de `current` a `next`? */
export function canTransition(
  role: "requester" | "funder",
  current: AdvanceStatus,
  next: AdvanceStatus,
): boolean {
  return nextStatusesFor(role, current).includes(next);
}
