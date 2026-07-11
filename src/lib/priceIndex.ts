// Índice de Precios Geocapitals — agregación propietaria de precios reales del
// marketplace (transacciones + demanda) por commodity. Es la semilla de un dato
// que nadie más puede construir: el precio efectivo al que se transan los
// commodities en la plataforma, no el precio de bolsa. Lógica pura y testeable;
// el server fn (priceIndex.functions.ts) recopila los puntos y ancla el cobre a
// la BML.

export type PricePointKind = "trade_closed" | "trade_active" | "inquiry";

export type PricePoint = {
  commodity: string; // clave commodity_kind (cu_concentrate, au_dore, …)
  usdPerT: number;
  kind: PricePointKind;
};

export type ConfidenceLevel = "high" | "medium" | "low";

export type CommodityIndexEntry = {
  commodity: string;
  benchmarkUsdT: number; // mediana ponderada
  sampleCount: number;
  tradeCount: number; // transacciones (trade_closed + trade_active)
  low: number;
  high: number;
  confidence: ConfidenceLevel;
};

// Peso por tipo de señal: una transacción cerrada vale más que una activa, y
// mucho más que una intención de compra (consulta).
const WEIGHT: Record<PricePointKind, number> = {
  trade_closed: 4,
  trade_active: 2,
  inquiry: 1,
};

/** Mediana ponderada de una lista de {valor, peso}. */
export function weightedMedian(items: Array<{ v: number; w: number }>): number {
  const sorted = [...items].sort((a, b) => a.v - b.v);
  const total = sorted.reduce((s, x) => s + x.w, 0);
  if (total <= 0) return sorted.length ? sorted[Math.floor(sorted.length / 2)].v : 0;
  let cum = 0;
  for (const x of sorted) {
    cum += x.w;
    if (cum >= total / 2) return x.v;
  }
  return sorted[sorted.length - 1].v;
}

function confidenceFor(tradeClosed: number, sampleCount: number): ConfidenceLevel {
  if (tradeClosed >= 5) return "high";
  if (tradeClosed >= 2 || sampleCount >= 6) return "medium";
  return "low";
}

/**
 * Construye el índice por commodity a partir de los puntos de precio.
 * Descarta puntos sin precio positivo. Ordena por número de muestras desc.
 */
export function buildPriceIndex(points: PricePoint[]): CommodityIndexEntry[] {
  const groups = new Map<string, PricePoint[]>();
  for (const p of points) {
    if (!Number.isFinite(p.usdPerT) || p.usdPerT <= 0) continue;
    const arr = groups.get(p.commodity);
    if (arr) arr.push(p);
    else groups.set(p.commodity, [p]);
  }

  const entries: CommodityIndexEntry[] = [];
  for (const [commodity, pts] of groups) {
    const values = pts.map((p) => p.usdPerT);
    const benchmark = weightedMedian(pts.map((p) => ({ v: p.usdPerT, w: WEIGHT[p.kind] })));
    const tradeClosed = pts.filter((p) => p.kind === "trade_closed").length;
    const tradeCount = pts.filter((p) => p.kind !== "inquiry").length;
    entries.push({
      commodity,
      benchmarkUsdT: Math.round(benchmark),
      sampleCount: pts.length,
      tradeCount,
      low: Math.round(Math.min(...values)),
      high: Math.round(Math.max(...values)),
      confidence: confidenceFor(tradeClosed, pts.length),
    });
  }

  return entries.sort((a, b) => b.sampleCount - a.sampleCount);
}

/** Premium/descuento del índice vs. un precio ancla (ej. cobre BML), en %. */
export function premiumVsAnchor(benchmarkUsdT: number, anchorUsdT: number | null): number | null {
  if (!anchorUsdT || anchorUsdT <= 0) return null;
  return ((benchmarkUsdT - anchorUsdT) / anchorUsdT) * 100;
}
