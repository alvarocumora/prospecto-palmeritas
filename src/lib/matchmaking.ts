// Agente de matchmaking comprador↔lote.
//
// Deriva el "mandato" de un comprador desde su intención histórica (las
// commodity_inquiries que envió) y puntúa qué tan bien calza cada lote
// publicado. Lógica pura y testeable; el server fn arma los datos.

export type InquiryIntent = {
  commodity: string; // commodity_kind del lote consultado
  targetVolumeT: number | null;
  targetPriceUsdT: number | null;
};

export type BuyerRequirement = {
  commodities: string[]; // commodities de interés (por frecuencia)
  targetVolumeT: number | null; // volumen típico buscado (mediana)
  targetPriceUsdT: number | null; // precio objetivo típico (mediana)
};

export type LotForMatch = {
  id: string;
  commodity: string;
  tonnageAvailableT: number | null;
  askingPriceUsd: number | null;
  premiumDiscountUsdT: number | null;
};

export type MatchResult = {
  lotId: string;
  score: number; // 0..100
  reasons: string[];
};

function median(nums: number[]): number | null {
  const xs = nums.filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  if (xs.length === 0) return null;
  const mid = Math.floor(xs.length / 2);
  return xs.length % 2 ? xs[mid] : (xs[mid - 1] + xs[mid]) / 2;
}

/** Familia de commodity (para match parcial): "cu", "au", "ag", "zn"... */
export function commodityFamily(kind: string): string {
  const k = kind.toLowerCase();
  const m = k.match(/^(cu|au|ag|zn|pb|mo|sn|li|fe|co|ni)/);
  return m ? m[1] : k;
}

/** Deriva el mandato del comprador desde sus consultas. */
export function deriveRequirement(intents: InquiryIntent[]): BuyerRequirement {
  const freq = new Map<string, number>();
  for (const it of intents) freq.set(it.commodity, (freq.get(it.commodity) ?? 0) + 1);
  const commodities = [...freq.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c);
  return {
    commodities,
    targetVolumeT: median(
      intents.map((i) => i.targetVolumeT).filter((n): n is number => n != null),
    ),
    targetPriceUsdT: median(
      intents.map((i) => i.targetPriceUsdT).filter((n): n is number => n != null),
    ),
  };
}

/**
 * Puntúa un lote contra el mandato del comprador (0..100).
 * Ponderación: commodity 50 · volumen 30 · precio 20. Neutral cuando falta dato.
 */
export function matchScore(req: BuyerRequirement, lot: LotForMatch): MatchResult {
  const reasons: string[] = [];
  let score = 0;

  // Commodity (50)
  if (req.commodities.length === 0) {
    score += 25; // sin señal: neutral
  } else if (req.commodities.includes(lot.commodity)) {
    score += 50;
    reasons.push("Mismo commodity que buscas");
  } else if (req.commodities.some((c) => commodityFamily(c) === commodityFamily(lot.commodity))) {
    score += 30;
    reasons.push("Commodity de la misma familia");
  }

  // Volumen (30): el lote cubre el volumen objetivo
  if (req.targetVolumeT != null && lot.tonnageAvailableT != null && req.targetVolumeT > 0) {
    const ratio = lot.tonnageAvailableT / req.targetVolumeT;
    if (ratio >= 1) {
      score += 30;
      reasons.push("Cubre tu volumen objetivo");
    } else {
      score += Math.round(30 * ratio);
      reasons.push(`Cubre ~${Math.round(ratio * 100)}% de tu volumen`);
    }
  } else {
    score += 15; // neutral
  }

  // Precio (20): precio del lote cerca del objetivo del comprador
  const lotPriceUsdT = lotUnitPrice(lot);
  if (req.targetPriceUsdT != null && lotPriceUsdT != null && req.targetPriceUsdT > 0) {
    const delta = Math.abs(lotPriceUsdT - req.targetPriceUsdT) / req.targetPriceUsdT;
    if (delta <= 0.1) {
      score += 20;
      reasons.push("Precio en tu rango");
    } else if (delta <= 0.25) {
      score += 12;
      reasons.push("Precio cercano a tu objetivo");
    } else if (lotPriceUsdT < req.targetPriceUsdT) {
      score += 14;
      reasons.push("Más barato que tu objetivo");
    }
  } else {
    score += 10; // neutral
  }

  return { lotId: lot.id, score: Math.max(0, Math.min(100, Math.round(score))), reasons };
}

/** Precio unitario aproximado del lote (USD/t) para comparar con el objetivo. */
function lotUnitPrice(lot: LotForMatch): number | null {
  if (lot.askingPriceUsd != null && lot.tonnageAvailableT && lot.tonnageAvailableT > 0)
    return lot.askingPriceUsd / lot.tonnageAvailableT;
  if (lot.premiumDiscountUsdT != null) return lot.premiumDiscountUsdT;
  return null;
}

/** Ordena los lotes por score descendente y filtra los muy bajos. */
export function rankLots(req: BuyerRequirement, lots: LotForMatch[], minScore = 40): MatchResult[] {
  return lots
    .map((l) => matchScore(req, l))
    .filter((m) => m.score >= minScore)
    .sort((a, b) => b.score - a.score);
}
