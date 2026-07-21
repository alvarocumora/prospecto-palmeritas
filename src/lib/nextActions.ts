// Motor de "próxima mejor acción" (next-best-action) por relación: reglas
// determinísticas que, a partir de los negocios de un socio (trades +
// comisiones), proponen los pasos siguientes priorizados. Es la base sobre la
// que luego se montan agentes de IA reales; hoy es puro y explicable.

import type { HubTrade, PartnerHubSummary } from "@/lib/partnerHub";
import { commissionAmount } from "@/lib/commissions";

export type NextActionPriority = "alta" | "media" | "baja";

export type NextAction = {
  key: string;
  priority: NextActionPriority;
  title: string;
  detail: string;
  /** Trade al que apunta la acción, si aplica (para enlazar). */
  tradeId?: string;
};

export type NextActionCommission = {
  id: string;
  trade_id: string | null;
  status: string;
  deal_value_usd: number | null;
  commission_pct: number | null;
  commission_usd: number | null;
};

const PRIORITY_RANK: Record<NextActionPriority, number> = { alta: 0, media: 1, baja: 2 };

/** Sugerencia del siguiente documento/acción según la etapa del trade. */
const STAGE_NEXT: Record<string, string> = {
  icpo: "formaliza la intención con la ICPO y solicita la FCO",
  fco: "avanza a contrato: envía el SPA para firma",
  spa: "coordina el instrumento de pago (SBLC / DLC)",
  payment: "confirma el pago y prepara el embarque",
  shipping: "haz seguimiento del embarque y los documentos de exportación",
  delivered: "cierra la operación y liquida comisiones",
};

const MS_PER_DAY = 86_400_000;
const daysSince = (iso: string, now: Date): number => {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return 0;
  return Math.max(0, Math.floor((now.getTime() - t) / MS_PER_DAY));
};

const usd0 = (n: number | null): string =>
  n != null ? `US$ ${Math.round(n).toLocaleString("es-CL")}` : "—";

const isActive = (t: HubTrade) => t.status !== "cancelled" && t.stage !== "closed";

/**
 * Calcula las próximas acciones para un socio. Ordenadas por prioridad y luego
 * por antigüedad del trade (lo más estancado primero). Puro.
 */
export function computeNextActions(input: {
  trades: HubTrade[];
  commissions: NextActionCommission[];
  summary: PartnerHubSummary;
  now: Date;
}): NextAction[] {
  const { trades, commissions, summary, now } = input;
  const actions: NextAction[] = [];

  // 1. Comisiones por cobrar → prioridad alta.
  for (const c of commissions) {
    if (c.status === "por_cobrar") {
      const amt = commissionAmount({
        dealValueUsd: c.deal_value_usd,
        commissionPct: c.commission_pct,
        commissionUsd: c.commission_usd,
      });
      actions.push({
        key: `commission-collect-${c.id}`,
        priority: "alta",
        title: `Cobrar comisión ${usd0(amt)}`,
        detail: "La comisión está por cobrar. Emite el cobro o registra el pago recibido.",
        tradeId: c.trade_id ?? undefined,
      });
    }
  }

  // 2. Trades activos: sugerir el siguiente paso según etapa; estancados suben.
  for (const t of trades) {
    if (!isActive(t)) continue;
    const stale = daysSince(t.created_at, now) >= 14;
    const hint = STAGE_NEXT[t.stage] ?? "avanza la operación al siguiente estado";
    actions.push({
      key: `trade-advance-${t.id}`,
      priority: stale ? "alta" : "media",
      title: `${t.reference ?? "Trade"} — ${stale ? "estancado, " : ""}avanzar etapa`,
      detail: `${t.commodity ?? "Operación"}${t.total_value_usd != null ? ` · ${usd0(t.total_value_usd)}` : ""}: ${hint}.`,
      tradeId: t.id,
    });
  }

  // 3. Deals cerrados con comisión pendiente de liquidar.
  const closedTradeIds = new Set(
    trades.filter((t) => t.stage === "closed" || t.status === "closed").map((t) => t.id),
  );
  for (const c of commissions) {
    if (c.status === "pendiente" && c.trade_id && closedTradeIds.has(c.trade_id)) {
      actions.push({
        key: `commission-settle-${c.id}`,
        priority: "media",
        title: "Liquidar comisión de deal cerrado",
        detail: "La operación se cerró; mueve la comisión a por cobrar o liquídala.",
        tradeId: c.trade_id ?? undefined,
      });
    }
  }

  // 4. Relación sin actividad.
  if (summary.tradeCount === 0) {
    actions.push({
      key: "relationship-start",
      priority: "baja",
      title: "Iniciar el primer negocio",
      detail:
        "Aún no hay operaciones con este contacto. Vincúlalo a un trade o envíale onboarding.",
    });
  } else if (summary.activeCount === 0) {
    actions.push({
      key: "relationship-reactivate",
      priority: "baja",
      title: "Reactivar la relación",
      detail: "No hay operaciones activas. Propón una nueva compra, cotización o requerimiento.",
    });
  }

  return actions.sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]);
}
