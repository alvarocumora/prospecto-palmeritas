// Lógica pura del tracking de embarques (trade_shipments). Testeable sin IO.

export const SHIPMENT_STATUSES = [
  "preparing",
  "at_port",
  "on_water",
  "arrived",
  "delivered",
] as const;

export type ShipmentStatus = (typeof SHIPMENT_STATUSES)[number];

export const SHIPMENT_STATUS_LABELS: Record<ShipmentStatus, string> = {
  preparing: "Preparación",
  at_port: "En puerto",
  on_water: "En tránsito",
  arrived: "Arribado",
  delivered: "Entregado",
};

export function shipmentStatusIndex(status: ShipmentStatus): number {
  return SHIPMENT_STATUSES.indexOf(status);
}

/** Siguiente estado del embarque, o null si ya está entregado. */
export function nextShipmentStatus(status: ShipmentStatus): ShipmentStatus | null {
  const i = shipmentStatusIndex(status);
  return i >= 0 && i < SHIPMENT_STATUSES.length - 1 ? SHIPMENT_STATUSES[i + 1] : null;
}

/** ¿La transición pedida es el avance válido (solo un paso hacia adelante)? */
export function canAdvanceShipment(current: ShipmentStatus, next: ShipmentStatus): boolean {
  return nextShipmentStatus(current) === next;
}

/** Atrasado: pasó la ETA y aún no arriba. */
export function isShipmentDelayed(
  status: ShipmentStatus,
  etaIso: string | null,
  now: Date,
): boolean {
  if (!etaIso) return false;
  if (status === "arrived" || status === "delivered") return false;
  return new Date(etaIso).getTime() < now.getTime();
}
