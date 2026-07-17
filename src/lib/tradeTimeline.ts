// Trazabilidad unificada del trade — modelo "Uber de los commodities".
// Convierte estado del trade + embarques + trade_events en UN viaje con pasos
// y un titular de estado ("Tu carga está en tránsito · ETA 12 ago").
// Lógica pura y testeable.

import type { ShipmentStatus } from "@/lib/shipments";

/** Pasos del viaje de una operación de commodities (estilo tracking Uber). */
export const JOURNEY_STEPS = [
  "Acuerdo",
  "Contrato",
  "Pago",
  "Embarque",
  "En tránsito",
  "Entrega",
] as const;

const STAGE_TO_STEP: Record<string, number> = {
  icpo: 0,
  fco: 0,
  spa: 1,
  payment: 2,
  shipping: 3,
  delivered: 5,
  closed: 5,
};

const SHIPMENT_TO_STEP: Record<ShipmentStatus, number> = {
  preparing: 3,
  at_port: 3,
  on_water: 4,
  arrived: 4,
  delivered: 5,
};

/**
 * Paso actual del viaje: lo más avanzado entre la etapa comercial del trade y
 * el estado físico del embarque (la carga puede ir por delante del papeleo).
 */
export function journeyStep(stage: string, shipmentStatus: ShipmentStatus | null): number {
  const fromStage = STAGE_TO_STEP[stage] ?? 0;
  const fromShipment = shipmentStatus != null ? SHIPMENT_TO_STEP[shipmentStatus] : -1;
  return Math.max(fromStage, fromShipment);
}

/** Titular de estado estilo Uber para la cabecera del tracking. */
export function journeyHeadline(
  step: number,
  opts: { vessel?: string | null; etaIso?: string | null; arrived?: boolean } = {},
): string {
  const eta =
    opts.etaIso != null
      ? new Date(opts.etaIso).toLocaleDateString("es-CL", { day: "numeric", month: "short" })
      : null;
  switch (step) {
    case 0:
      return "Negociando el acuerdo comercial";
    case 1:
      return "Contrato (SPA) en preparación y firma";
    case 2:
      return "Pago en proceso";
    case 3:
      return "Preparando el embarque";
    case 4:
      return opts.arrived
        ? "Carga arribada a puerto de destino"
        : `Tu carga está en tránsito${opts.vessel ? ` a bordo de ${opts.vessel}` : ""}${eta ? ` · ETA ${eta}` : ""}`;
    default:
      return "Operación entregada";
  }
}

/** Evento normalizado para el timeline. */
export type TimelineItem = {
  id: string;
  at: string;
  category: "trade" | "document" | "shipment" | "message";
  title: string;
  detail: string | null;
};

const STAGE_LABELS: Record<string, string> = {
  icpo: "ICPO emitida",
  fco: "FCO recibida",
  spa: "SPA en curso",
  payment: "Etapa de pago",
  shipping: "Etapa de embarque",
  delivered: "Entregado",
  closed: "Operación cerrada",
};

export type RawTradeEvent = {
  id: string;
  kind: string;
  detail: string | null;
  doc_type: string | null;
  created_at: string;
};

/** Convierte un trade_event crudo en un ítem legible del timeline. Puro. */
export function normalizeEvent(e: RawTradeEvent): TimelineItem {
  const doc = e.doc_type ? e.doc_type.toUpperCase() : null;
  switch (e.kind) {
    case "created":
      return {
        id: e.id,
        at: e.created_at,
        category: "trade",
        title: "Operación iniciada",
        detail: e.detail,
      };
    case "stage_changed":
      return {
        id: e.id,
        at: e.created_at,
        category: "trade",
        title: STAGE_LABELS[e.detail ?? ""] ?? `Etapa: ${e.detail ?? "—"}`,
        detail: null,
      };
    case "doc_uploaded":
      return {
        id: e.id,
        at: e.created_at,
        category: "document",
        title: `Documento subido${doc ? `: ${doc}` : ""}`,
        detail: e.detail,
      };
    case "doc_signed":
      return {
        id: e.id,
        at: e.created_at,
        category: "document",
        title: `Documento firmado${doc ? `: ${doc}` : ""}`,
        detail: e.detail,
      };
    case "doc_verified":
      return {
        id: e.id,
        at: e.created_at,
        category: "document",
        title: `Documento verificado${doc ? `: ${doc}` : ""}`,
        detail: e.detail,
      };
    case "shipment_created":
      return {
        id: e.id,
        at: e.created_at,
        category: "shipment",
        title: "Embarque creado",
        detail: e.detail,
      };
    case "shipment_status":
      return {
        id: e.id,
        at: e.created_at,
        category: "shipment",
        title: "Embarque actualizado",
        detail: e.detail,
      };
    case "message":
      return {
        id: e.id,
        at: e.created_at,
        category: "message",
        title: "Mensaje",
        detail: e.detail,
      };
    default:
      return {
        id: e.id,
        at: e.created_at,
        category: "trade",
        title: e.kind,
        detail: e.detail,
      };
  }
}
