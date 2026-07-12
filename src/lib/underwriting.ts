// Motor de underwriting — "Anticipo pre-aprobado".
//
// La jugada disruptiva: convertir el stack de verificación (KYM del activo +
// valor pagable + reputación de la contraparte) en una decisión de
// financiamiento. Nadie financia la cola larga de pequeños productores porque
// verificar activo y contraparte a escala es imposible; aquí ya está resuelto,
// así que se puede pre-aprobar un anticipo contra el lote verificado.
//
// Lógica DETERMINISTA y pura (testeable). Los montos son INDICATIVOS, no una
// oferta vinculante de crédito.

export type AdvanceEligibility = "eligible" | "conditional" | "ineligible";
export type FactorStatus = "pass" | "warn" | "fail" | "info";

export type UnderwritingFactor = {
  key: string;
  label: string;
  status: FactorStatus;
  detail: string;
};

export type UnderwritingInputs = {
  assetTrust: number | null; // score KYM 0..100
  hasRedFlags: boolean; // banderas rojas del KYM
  sellerReputation: number | null; // score reputación 0..100
  sellerTier: string; // established | emerging | new | watch
  lotValueUsd: number | null; // valor neto pagable del lote (colateral)
  valuationSupported: boolean; // ¿se pudo calcular el valor pagable?
};

export type UnderwritingResult = {
  eligibility: AdvanceEligibility;
  eligibilityLabel: string;
  riskScore: number; // 0..100 combinado
  advanceRatePct: number; // % del valor del lote ofrecido (0 si no elegible)
  maxAdvanceUsd: number | null;
  indicativeFeePct: number; // costo indicativo del período
  tenorDays: number;
  factors: UnderwritingFactor[];
  conditions: string[];
};

const LABEL: Record<AdvanceEligibility, string> = {
  eligible: "Anticipo pre-aprobado",
  conditional: "Pre-aprobado con condiciones",
  ineligible: "No elegible por ahora",
};

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function combinedRisk(assetTrust: number | null, reputation: number | null): number {
  if (assetTrust != null && reputation != null) return 0.6 * assetTrust + 0.4 * reputation;
  if (assetTrust != null) return assetTrust;
  if (reputation != null) return reputation;
  return 50; // desconocido → neutral
}

/**
 * Evalúa un anticipo pre-aprobado contra un lote. Bloqueadores duros →
 * ineligible; señales suaves (contraparte nueva, confianza media) → conditional
 * con menor tasa de adelanto; caso limpio → eligible.
 */
export function assessAdvance(i: UnderwritingInputs): UnderwritingResult {
  const factors: UnderwritingFactor[] = [];
  const conditions: string[] = [];
  const riskScore = Math.round(combinedRisk(i.assetTrust, i.sellerReputation));

  // Bloqueadores duros
  const blockers: string[] = [];
  if (i.hasRedFlags) blockers.push("El activo tiene banderas rojas en la verificación KYM.");
  if (i.assetTrust != null && i.assetTrust < 45)
    blockers.push("Confianza del activo insuficiente (KYM < 45).");
  if (i.sellerTier === "watch") blockers.push("La contraparte está marcada como riesgosa.");
  if (!i.valuationSupported || !i.lotValueUsd || i.lotValueUsd <= 0)
    blockers.push("No se pudo estimar el valor pagable del lote (colateral).");

  // Factores (evidencia)
  factors.push({
    key: "asset",
    label: "Confianza del activo (KYM)",
    status:
      i.assetTrust == null
        ? "info"
        : i.hasRedFlags || i.assetTrust < 45
          ? "fail"
          : i.assetTrust < 65
            ? "warn"
            : "pass",
    detail:
      i.assetTrust == null
        ? "Sin verificación KYM disponible."
        : `Score KYM ${i.assetTrust}/100${i.hasRedFlags ? " · con banderas rojas" : ""}.`,
  });
  factors.push({
    key: "counterparty",
    label: "Contraparte",
    status:
      i.sellerTier === "watch"
        ? "fail"
        : i.sellerTier === "new"
          ? "warn"
          : i.sellerReputation != null && i.sellerReputation < 55
            ? "warn"
            : "pass",
    detail:
      i.sellerReputation == null
        ? `Reputación ${i.sellerTier}.`
        : `Reputación ${i.sellerReputation}/100 (${i.sellerTier}).`,
  });
  factors.push({
    key: "collateral",
    label: "Colateral (valor pagable)",
    status: i.valuationSupported && i.lotValueUsd ? "pass" : "fail",
    detail:
      i.valuationSupported && i.lotValueUsd
        ? `Valor neto estimado US$ ${Math.round(i.lotValueUsd).toLocaleString("en-US")}.`
        : "Valor pagable no estimable.",
  });

  if (blockers.length > 0) {
    return {
      eligibility: "ineligible",
      eligibilityLabel: LABEL.ineligible,
      riskScore,
      advanceRatePct: 0,
      maxAdvanceUsd: null,
      indicativeFeePct: 0,
      tenorDays: 0,
      factors,
      conditions: blockers,
    };
  }

  // Señales suaves → conditional
  let conditional = false;
  if (i.sellerTier === "new") {
    conditional = true;
    conditions.push("Contraparte sin historial: se requiere validación adicional de identidad.");
  }
  if (i.assetTrust != null && i.assetTrust < 65) {
    conditional = true;
    conditions.push("Confianza del activo media: sujeta a inspección de muestra y título.");
  }
  if (i.sellerReputation != null && i.sellerReputation < 55) {
    conditional = true;
    conditions.push("Reputación de contraparte limitada: se pedirá garantía adicional.");
  }
  if (riskScore < 65) conditional = true;

  const eligibility: AdvanceEligibility = conditional ? "conditional" : "eligible";

  // Tasa de adelanto según riesgo y tramo
  const tierBonus = i.sellerTier === "established" ? 0.03 : 0;
  const rate = conditional
    ? clamp(0.25 + ((riskScore - 50) / 15) * 0.15, 0.25, 0.4)
    : clamp(0.45 + ((riskScore - 65) / 35) * 0.25 + tierBonus, 0.45, 0.7);

  const advanceRatePct = Math.round(rate * 100);
  const maxAdvanceUsd = i.lotValueUsd ? Math.round((advanceRatePct / 100) * i.lotValueUsd) : null;

  return {
    eligibility,
    eligibilityLabel: LABEL[eligibility],
    riskScore,
    advanceRatePct,
    maxAdvanceUsd,
    indicativeFeePct: conditional ? 4.0 : 2.5,
    tenorDays: 90,
    factors,
    conditions,
  };
}
