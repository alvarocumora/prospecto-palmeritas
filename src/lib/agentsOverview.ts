// Panel de agentes del vendedor: lógica pura para resumir el estado de un lote
// a partir de las salidas de los agentes de confianza (Know-Your-Mine) y valor
// (Assay-to-Value). El server fn corre los agentes; esto sintetiza el semáforo.

export type LotHealth = "healthy" | "attention" | "risk";

export type MarketVerdict = "en_mercado" | "sobre_mercado" | "bajo_mercado" | "sin_datos";

export type LotHealthInput = {
  trustLevel: "high" | "medium" | "low";
  redFlagCount: number;
  valuationSupported: boolean;
  marketVerdict: MarketVerdict;
};

/**
 * Sintetiza un semáforo por lote combinando confianza + valorización:
 * - risk: hay banderas rojas o la confianza es baja.
 * - attention: confianza media, precio sobre mercado, o sin valorización.
 * - healthy: en verde en ambos ejes.
 */
export function lotHealth(i: LotHealthInput): { health: LotHealth; headline: string } {
  if (i.redFlagCount > 0 || i.trustLevel === "low") {
    const reason =
      i.redFlagCount > 0
        ? `${i.redFlagCount} bandera(s) roja(s) de verificación`
        : "Confianza baja en la verificación";
    return { health: "risk", headline: reason };
  }
  if (i.trustLevel === "medium") {
    return { health: "attention", headline: "Verificación con observaciones por revisar" };
  }
  if (i.marketVerdict === "sobre_mercado") {
    return { health: "attention", headline: "Precio pedido por sobre el valor estimado" };
  }
  if (!i.valuationSupported) {
    return { health: "attention", headline: "Sin valorización automática para este tipo" };
  }
  if (i.marketVerdict === "bajo_mercado") {
    return { health: "healthy", headline: "Verificado y con precio competitivo" };
  }
  return { health: "healthy", headline: "Verificado y en precio de mercado" };
}

/** Clasifica el precio pedido contra el valor estimado (total). */
export function classifyMarket(
  askingTotalUsd: number | null,
  estimatedTotalUsd: number | null,
): { verdict: MarketVerdict; deltaPct: number | null } {
  if (askingTotalUsd == null || estimatedTotalUsd == null || estimatedTotalUsd <= 0)
    return { verdict: "sin_datos", deltaPct: null };
  const deltaPct = (askingTotalUsd - estimatedTotalUsd) / estimatedTotalUsd;
  if (deltaPct > 0.1) return { verdict: "sobre_mercado", deltaPct };
  if (deltaPct < -0.1) return { verdict: "bajo_mercado", deltaPct };
  return { verdict: "en_mercado", deltaPct };
}
