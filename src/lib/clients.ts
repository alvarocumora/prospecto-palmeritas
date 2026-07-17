// Lógica pura del CRM de negocios: agregación de clientes (contrapartes
// reales de trades) y catálogo de roles de asociados. Testeable sin red.

export type TradeForClients = {
  id: string;
  buyer_user_id: string;
  seller_user_id: string;
  total_value_usd: number | null;
  stage: string;
  status: string;
  created_at: string;
};

export type ClientAggregate = {
  userId: string;
  /** Cuántos trades compartimos. */
  trades: number;
  /** Trades aún en curso (no cerrados ni cancelados). */
  active: number;
  closed: number;
  /** Suma de valor de todos los trades compartidos. */
  totalUsd: number;
  /** true si en la mayoría de los trades el cliente COMPRA (yo vendo). */
  mostlyBuysFromMe: boolean;
  lastActivity: string;
};

/** Agrega las contrapartes de mis trades en una cartera de clientes. */
export function aggregateClients(trades: TradeForClients[], me: string): ClientAggregate[] {
  const map = new Map<string, ClientAggregate & { buysFromMe: number }>();
  for (const t of trades) {
    const other = t.buyer_user_id === me ? t.seller_user_id : t.buyer_user_id;
    if (!other || other === me) continue;
    const cur = map.get(other) ?? {
      userId: other,
      trades: 0,
      active: 0,
      closed: 0,
      totalUsd: 0,
      mostlyBuysFromMe: false,
      buysFromMe: 0,
      lastActivity: t.created_at,
    };
    cur.trades += 1;
    if (t.status !== "cancelled" && t.stage !== "closed") cur.active += 1;
    if (t.stage === "closed") cur.closed += 1;
    cur.totalUsd += t.total_value_usd ?? 0;
    if (t.buyer_user_id === other) cur.buysFromMe += 1;
    if (t.created_at > cur.lastActivity) cur.lastActivity = t.created_at;
    map.set(other, cur);
  }
  return Array.from(map.values())
    .map(({ buysFromMe, ...c }) => ({ ...c, mostlyBuysFromMe: buysFromMe * 2 >= c.trades }))
    .sort((a, b) => b.totalUsd - a.totalUsd || b.lastActivity.localeCompare(a.lastActivity));
}

export const PARTNER_ROLES = [
  "vendedor",
  "gestor",
  "broker",
  "cliente",
  "proveedor",
  "otro",
] as const;
export type PartnerRole = (typeof PARTNER_ROLES)[number];

export const PARTNER_ROLE_LABELS: Record<PartnerRole, string> = {
  vendedor: "Vendedor",
  gestor: "Gestor comercial",
  broker: "Broker",
  cliente: "Cliente",
  proveedor: "Proveedor",
  otro: "Otro",
};

export const PARTNER_STATUSES = ["activo", "prospecto", "inactivo"] as const;
export type PartnerStatus = (typeof PARTNER_STATUSES)[number];

export const PARTNER_STATUS_LABELS: Record<PartnerStatus, string> = {
  activo: "Activo",
  prospecto: "Prospecto",
  inactivo: "Inactivo",
};
