/**
 * CHOLQUI COMMERCIAL MODEL v2
 *
 * Separates documented facts, planning assumptions and commercial quotes.
 * A destination is not decision-grade until product acceptance, road distance,
 * freight quote and settlement terms have been verified.
 */
import {
  CHOLQUI_CONCEPTUAL,
  CHOLQUI_ENAMI,
  CHOLQUI_PLAN_TONNES,
} from "./cholqui";
import { buildRamp, DEFAULT_PLAN, tariffForGrade } from "./minePlan";

export type VerificationStatus = "VERIFIED" | "PENDING_DD";
export type ProductFit = "OXIDE_CONFIRMED" | "PRODUCT_ACCEPTANCE_REQUIRED";

export type CommercialDestination = {
  id: "cemin-catemu" | "enami-rancagua";
  operator: "CEMIN" | "ENAMI";
  facility: string;
  location: string;
  productFit: ProductFit;
  productEvidence: string;
  productEvidenceStatus: VerificationStatus;
  roadDistanceKm: number | null;
  distanceStatus: VerificationStatus;
  freightQuoteClpT: number | null;
  freightQuoteStatus: VerificationStatus;
  settlementQuoteClpT: number | null;
  settlementQuoteStatus: VerificationStatus;
  source: string;
};

export const CHOLQUI_COMMERCIAL_DESTINATIONS: readonly CommercialDestination[] = [
  {
    id: "cemin-catemu",
    operator: "CEMIN",
    facility: "Planta Catemu / Agencia de Compra",
    location: "El Rulo S/N, Catemu, Región de Valparaíso",
    productFit: "OXIDE_CONFIRMED",
    productEvidence:
      "CEMIN declara que la Agencia de Compra de Catemu es poder comprador de minerales de óxido de la zona central.",
    productEvidenceStatus: "VERIFIED",
    roadDistanceKm: null,
    distanceStatus: "PENDING_DD",
    freightQuoteClpT: null,
    freightQuoteStatus: "PENDING_DD",
    settlementQuoteClpT: null,
    settlementQuoteStatus: "PENDING_DD",
    source:
      "CEMIN, Agencia de Compra / noticias corporativas 2024-2026. Requiere cotización comercial vigente para Cholqui.",
  },
  {
    id: "enami-rancagua",
    operator: "ENAMI",
    facility: "Poder de Compra Rancagua",
    location: "Chancón, Rinconada La Chica, Rancagua, Región de O'Higgins",
    productFit: "PRODUCT_ACCEPTANCE_REQUIRED",
    productEvidence:
      "La existencia del poder de compra está documentada; la aceptación vigente del óxido Cu soluble de Cholqui debe confirmarse.",
    productEvidenceStatus: "PENDING_DD",
    roadDistanceKm: null,
    distanceStatus: "PENDING_DD",
    freightQuoteClpT: null,
    freightQuoteStatus: "PENDING_DD",
    settlementQuoteClpT: null,
    settlementQuoteStatus: "PENDING_DD",
    source:
      "ENAMI. Confirmar producto, empadronamiento, capacidad, tarifa y condiciones antes de modelar venta.",
  },
];

export const LEGACY_FREIGHT_ASSUMPTION = {
  distanceKm: 130,
  clpPerTkm: 90,
  clpPerT: 11_700,
  status: "PLANNING_ASSUMPTION",
  note: "Supuesto histórico del modelo; no corresponde a una distancia vial ni cotización de transportista verificadas.",
} as const;

export const FREIGHT_SENSITIVITY = [
  { label: "Bajo", clpPerTkm: 60 },
  { label: "Base histórico", clpPerTkm: 90 },
  { label: "Alto", clpPerTkm: 120 },
] as const;

export function freightCostClpT(distanceKm: number, clpPerTkm: number): number {
  if (!Number.isFinite(distanceKm) || distanceKm < 0) throw new Error("INVALID_DISTANCE_KM");
  if (!Number.isFinite(clpPerTkm) || clpPerTkm < 0) throw new Error("INVALID_FREIGHT_RATE");
  return distanceKm * clpPerTkm;
}

export type ProductionPlanAudit = {
  declaredTonnes: number;
  mathematicalRampTonnes: number;
  deltaTonnes: number;
  deltaPct: number;
  conceptualTonnes: number;
  declaredVsConceptual: number;
  consistent: boolean;
};

export function auditDeclaredProductionPlan(): ProductionPlanAudit {
  const mathematicalRampTonnes = buildRamp(DEFAULT_PLAN).reduce((sum, tonnes) => sum + tonnes, 0);
  const deltaTonnes = mathematicalRampTonnes - CHOLQUI_PLAN_TONNES;
  return {
    declaredTonnes: CHOLQUI_PLAN_TONNES,
    mathematicalRampTonnes,
    deltaTonnes,
    deltaPct: (deltaTonnes / CHOLQUI_PLAN_TONNES) * 100,
    conceptualTonnes: CHOLQUI_CONCEPTUAL.tonnes,
    declaredVsConceptual: CHOLQUI_PLAN_TONNES / CHOLQUI_CONCEPTUAL.tonnes,
    consistent: deltaTonnes === 0,
  };
}

/**
 * Reconciles a monthly ramp against an explicit tonnage cap.
 * This is a scenario tool, not evidence that the capped tonnes exist.
 */
export function capRampToTonnes(rates: readonly number[], tonnesCap: number): number[] {
  if (!Number.isFinite(tonnesCap) || tonnesCap < 0) throw new Error("INVALID_TONNAGE_CAP");
  let remaining = tonnesCap;
  return rates.map((rate) => {
    if (remaining <= 0) return 0;
    const tonnes = Math.min(rate, remaining);
    remaining -= tonnes;
    return tonnes;
  });
}

export type CommercialValidation = {
  inventoryValidated: boolean;
  metallurgyValidated: boolean;
  productAcceptanceValidated: boolean;
  roadDistanceValidated: boolean;
  freightQuoteValidated: boolean;
  settlementQuoteValidated: boolean;
};

export function isDecisionGradeCommercialCase(v: CommercialValidation): boolean {
  return Object.values(v).every(Boolean);
}

export type NetbackInput = {
  gradePct: number;
  settlementClpT?: number;
  freightClpT: number;
  acidAdjustmentClpT?: number;
  moistureAdjustmentClpT?: number;
  penaltiesClpT?: number;
  otherCommercialCostsClpT?: number;
};

export type NetbackResult = {
  grossSettlementClpT: number;
  deductionsClpT: number;
  mineNetbackClpT: number;
};

export function commercialNetback(input: NetbackInput): NetbackResult {
  const grossSettlementClpT = input.settlementClpT ?? tariffForGrade(input.gradePct);
  const deductions = [
    input.freightClpT,
    input.acidAdjustmentClpT ?? 0,
    input.moistureAdjustmentClpT ?? 0,
    input.penaltiesClpT ?? 0,
    input.otherCommercialCostsClpT ?? 0,
  ];
  if ([grossSettlementClpT, ...deductions].some((n) => !Number.isFinite(n) || n < 0)) {
    throw new Error("INVALID_NETBACK_INPUT");
  }
  const deductionsClpT = deductions.reduce((sum, value) => sum + value, 0);
  return {
    grossSettlementClpT,
    deductionsClpT,
    mineNetbackClpT: grossSettlementClpT - deductionsClpT,
  };
}

export function enamiReferenceSettlementClpT(gradePct: number): number {
  return (
    CHOLQUI_ENAMI.baseTariffClpTms -
    (CHOLQUI_ENAMI.baseGradePct - gradePct) * CHOLQUI_ENAMI.scaleClpPerPct
  );
}
