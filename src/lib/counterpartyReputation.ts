// Buró de Reputación de Contrapartes — track record del vendedor en la
// plataforma, complementario al agente Know-Your-Mine (que verifica el ACTIVO;
// esto verifica la CONTRAPARTE). Parte del moat de datos: la reputación se
// construye con el historial real de trades y lotes, algo que ningún actor
// externo puede replicar. Lógica pura y testeable.

export type ReputationTier = "established" | "emerging" | "new" | "watch";
export type ReputationFactorStatus = "pass" | "warn" | "fail" | "info";

export type ReputationFactor = {
  key: string;
  label: string;
  status: ReputationFactorStatus;
  detail: string;
};

export type ReputationSignals = {
  tradesClosed: number;
  tradesActive: number;
  tradesCancelled: number;
  lotsPublished: number;
  lotsVerified: number;
  gmvUsd: number; // suma de total_value_usd de trades cerrados
  avgLotTrust: number | null; // promedio del score KYM de sus lotes (0..100), opcional
};

export type ReputationResult = {
  score: number; // 0..100
  tier: ReputationTier;
  tierLabel: string;
  factors: ReputationFactor[];
};

const TIER_LABEL: Record<ReputationTier, string> = {
  established: "Contraparte establecida",
  emerging: "Contraparte emergente",
  new: "Sin historial suficiente",
  watch: "Requiere precaución",
};

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

/**
 * Calcula la reputación de una contraparte a partir de su historial.
 * Diseño honesto con la escasez: una cuenta nueva es "new" (neutral), no "mala".
 * La tasa alta de cancelaciones es la única señal que degrada a "watch".
 */
export function scoreReputation(s: ReputationSignals): ReputationResult {
  const totalTrades = s.tradesClosed + s.tradesActive + s.tradesCancelled;
  const cancelledRate = totalTrades > 0 ? s.tradesCancelled / totalTrades : 0;
  const verifiedRatio = s.lotsPublished > 0 ? s.lotsVerified / s.lotsPublished : 0;

  const factors: ReputationFactor[] = [];
  let score = 50; // base neutral

  // 1. Track record (transacciones cerradas)
  if (s.tradesClosed >= 5) {
    factors.push({
      key: "track_record",
      label: "Historial de cierres",
      status: "pass",
      detail: `${s.tradesClosed} transacciones cerradas en la plataforma.`,
    });
  } else if (s.tradesClosed >= 1) {
    factors.push({
      key: "track_record",
      label: "Historial de cierres",
      status: "info",
      detail: `${s.tradesClosed} transacción(es) cerrada(s). Historial en construcción.`,
    });
  } else {
    factors.push({
      key: "track_record",
      label: "Historial de cierres",
      status: "info",
      detail: "Sin transacciones cerradas todavía.",
    });
  }
  score += Math.min(30, s.tradesClosed * 6);

  // 2. Fiabilidad (tasa de cancelación)
  if (totalTrades >= 3 && cancelledRate > 0.25) {
    factors.push({
      key: "reliability",
      label: "Fiabilidad",
      status: "fail",
      detail: `${Math.round(cancelledRate * 100)}% de sus operaciones se cancelaron.`,
    });
    score -= 25;
  } else if (totalTrades > 0) {
    factors.push({
      key: "reliability",
      label: "Fiabilidad",
      status: "pass",
      detail: `${Math.round((1 - cancelledRate) * 100)}% de operaciones sin cancelar.`,
    });
  }

  // 3. Verificación de lotes
  if (s.lotsPublished > 0) {
    if (verifiedRatio >= 0.5) {
      factors.push({
        key: "verification",
        label: "Lotes verificados",
        status: "pass",
        detail: `${s.lotsVerified}/${s.lotsPublished} lotes verificados.`,
      });
    } else {
      factors.push({
        key: "verification",
        label: "Lotes verificados",
        status: "warn",
        detail: `Solo ${s.lotsVerified}/${s.lotsPublished} lotes verificados.`,
      });
    }
    score += verifiedRatio * 15;
  }

  // 4. Volumen transado (credibilidad por GMV)
  if (s.gmvUsd >= 1_000_000) {
    factors.push({
      key: "gmv",
      label: "Volumen transado",
      status: "pass",
      detail: `US$ ${(s.gmvUsd / 1_000_000).toFixed(1)}M transados en la plataforma.`,
    });
    score += 10;
  } else if (s.gmvUsd >= 100_000) {
    factors.push({
      key: "gmv",
      label: "Volumen transado",
      status: "info",
      detail: `US$ ${(s.gmvUsd / 1000).toFixed(0)}k transados.`,
    });
    score += 5;
  }

  // 5. Calidad de activos (promedio KYM de sus lotes)
  if (s.avgLotTrust != null) {
    score = 0.75 * score + 0.25 * s.avgLotTrust;
    factors.push({
      key: "asset_quality",
      label: "Calidad de activos (KYM)",
      status: s.avgLotTrust >= 70 ? "pass" : s.avgLotTrust >= 50 ? "warn" : "fail",
      detail: `Confianza promedio de sus lotes: ${Math.round(s.avgLotTrust)}/100.`,
    });
  }

  score = clamp(score);

  // Tier
  let tier: ReputationTier;
  if (totalTrades >= 3 && cancelledRate > 0.25) tier = "watch";
  else if (s.tradesClosed >= 5 && verifiedRatio >= 0.5) tier = "established";
  else if (s.tradesClosed >= 1 || s.lotsVerified >= 1) tier = "emerging";
  else tier = "new";

  return { score, tier, tierLabel: TIER_LABEL[tier], factors };
}
