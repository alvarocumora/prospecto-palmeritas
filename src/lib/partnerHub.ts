// Hub de relación de una contraparte (proveedor/cliente): agrega todos sus
// negocios — trades y comisiones — para responder "¿qué tengo andando con este
// socio?". Un proveedor puede tener varios trades con distintos compradores y
// viceversa; el partner es el nodo. Lógica pura y testeable.

import { commissionTotals, type CommissionLike } from "@/lib/commissions";

export type HubTrade = {
  id: string;
  reference: string | null;
  commodity: string | null;
  quantity_t: number | null;
  total_value_usd: number | null;
  stage: string;
  status: string;
  role: "buyer" | "seller" | "desk";
  created_at: string;
};

export type PartnerHubSummary = {
  tradeCount: number;
  activeCount: number;
  closedCount: number;
  /** Valor total de los trades no cancelados. */
  totalDealUsd: number;
  /** Valor en pipeline (trades activos, no cerrados ni cancelados). */
  pipelineUsd: number;
  /** Comisiones devengadas (no canceladas) asociadas al socio. */
  commissionsAccruedUsd: number;
  commissionsOutstandingUsd: number;
};

const isActive = (t: HubTrade) => t.status !== "cancelled" && t.stage !== "closed";
const isClosed = (t: HubTrade) => t.stage === "closed" || t.status === "closed";

/** Resumen del hub: cuenta y valor de trades + comisiones del socio. Puro. */
export function partnerHubSummary(
  trades: HubTrade[],
  commissions: CommissionLike[],
): PartnerHubSummary {
  let activeCount = 0;
  let closedCount = 0;
  let totalDealUsd = 0;
  let pipelineUsd = 0;
  for (const t of trades) {
    if (t.status === "cancelled") continue;
    totalDealUsd += t.total_value_usd ?? 0;
    if (isClosed(t)) closedCount += 1;
    if (isActive(t)) {
      activeCount += 1;
      pipelineUsd += t.total_value_usd ?? 0;
    }
  }
  const ct = commissionTotals(commissions);
  return {
    tradeCount: trades.length,
    activeCount,
    closedCount,
    totalDealUsd,
    pipelineUsd,
    commissionsAccruedUsd: ct.accruedUsd,
    commissionsOutstandingUsd: ct.outstandingUsd,
  };
}
