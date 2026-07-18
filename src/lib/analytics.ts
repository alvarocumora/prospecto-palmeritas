// Analítica del funnel comercial (lógica pura). Convierte conteos y fechas de
// cada etapa en tasas de conversión, y calcula tiempo de ciclo promedio en días.

export type FunnelCounts = {
  /** Requerimientos de sourcing creados. */
  requests: number;
  /** Propuestas recibidas de proveedores. */
  proposals: number;
  /** Trades abiertos (incluye los convertidos desde sourcing). */
  trades: number;
  /** Trades cerrados (stage = closed). */
  closed: number;
};

export type FunnelStage = {
  key: keyof FunnelCounts;
  label: string;
  count: number;
  /** Conversión respecto a la etapa anterior (0–100). El primero es 100. */
  convFromPrevPct: number;
  /** Conversión respecto al tope del funnel (0–100). */
  convFromTopPct: number;
};

const STAGE_LABELS: Record<keyof FunnelCounts, string> = {
  requests: "Requerimientos",
  proposals: "Propuestas",
  trades: "Operaciones",
  closed: "Cerradas",
};

const ORDER: Array<keyof FunnelCounts> = ["requests", "proposals", "trades", "closed"];

const pct = (num: number, den: number) => (den > 0 ? Math.round((num / den) * 100) : 0);

/** Construye el funnel con conversiones etapa-a-etapa y respecto al tope. */
export function buildFunnel(c: FunnelCounts): FunnelStage[] {
  const top = c[ORDER[0]];
  return ORDER.map((key, i) => {
    const count = c[key];
    const prev = i === 0 ? count : c[ORDER[i - 1]];
    return {
      key,
      label: STAGE_LABELS[key],
      count,
      convFromPrevPct: i === 0 ? 100 : pct(count, prev),
      convFromTopPct: pct(count, top),
    };
  });
}

/** Tasa de cierre global: cerradas / operaciones. */
export function winRatePct(trades: number, closed: number): number {
  return pct(closed, trades);
}

/** Días entre dos ISO timestamps (>= 0). */
export function daysBetween(startIso: string, endIso: string): number {
  const ms = new Date(endIso).getTime() - new Date(startIso).getTime();
  return ms > 0 ? ms / 86_400_000 : 0;
}

/**
 * Tiempo de ciclo promedio (días) de un conjunto de operaciones cerradas,
 * a partir de pares [creación, cierre]. Ignora pares inválidos.
 */
export function avgCycleDays(pairs: Array<{ startIso: string; endIso: string | null }>): number {
  const spans: number[] = [];
  for (const p of pairs) {
    if (!p.endIso) continue;
    const d = daysBetween(p.startIso, p.endIso);
    if (d > 0) spans.push(d);
  }
  if (spans.length === 0) return 0;
  return Math.round(spans.reduce((a, b) => a + b, 0) / spans.length);
}

export type CommodityAgg = { commodity: string; trades: number; valueUsd: number };

/** Agrupa operaciones por commodity, ordenadas por valor. Top N. */
export function topCommodities(
  rows: Array<{ commodity: string | null; total_value_usd: number | null }>,
  topN = 5,
): CommodityAgg[] {
  const map = new Map<string, CommodityAgg>();
  for (const r of rows) {
    const key = (r.commodity ?? "—").trim() || "—";
    const cur = map.get(key) ?? { commodity: key, trades: 0, valueUsd: 0 };
    cur.trades += 1;
    cur.valueUsd += r.total_value_usd ?? 0;
    map.set(key, cur);
  }
  return Array.from(map.values())
    .sort((a, b) => b.valueUsd - a.valueUsd || b.trades - a.trades)
    .slice(0, topN);
}
