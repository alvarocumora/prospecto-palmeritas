/**
 * Tilama / Los Verdes — simulación de venta de mineral seco a ENAMI.
 *
 * REUTILIZA la escala histórica documentada para Cholqui (julio 2026).
 * No usa cobre total como ley pagable, no presume reservas ni implica que
 * ENAMI acepte el producto de Tilama o respete esta tarifa en el futuro.
 * No se heredan los costos, tonelajes ni retornos de Cholqui.
 */
import { CHOLQUI_ENAMI, CHOLQUI_SCENARIOS } from "@/features/franco/data/cholqui";
import { tariffForGrade } from "@/features/franco/data/minePlan";

export const TILAMA_ENAMI_REFERENCE = {
  project: "Los Verdes–Tilama",
  tariffSource: CHOLQUI_ENAMI.circular,
  referenceOnly: true,
  commercialStatus: "PENDING_DD",
  copperTotalVsSoluble: "El cobre total de las muestras no equivale al cobre soluble pagable.",
  inventoryStatus:
    "Las 3.000.000–3.746.250 t de antecedentes históricos son potencial conceptual, no recurso ni reserva.",
  royaltyStatus:
    "El 10 % sobre ventas aparece en borradores de arriendo, no como obligación contractual acreditada.",
} as const;

export type TilamaEnamiInput = {
  /** Toneladas métricas secas de un lote hipotético, no inventario acreditado. */
  dryTonnes: number;
  /** Ley total sólo para validación y comparación, nunca se tarifa directamente. */
  cuTotalPct: number;
  /** Hipótesis de ley soluble pagable; se debe verificar mediante análisis. */
  cuSolublePct: number;
  /** Opcionales: requieren entrada explícita del usuario, no se copian de Cholqui. */
  mineCostClpPerT?: number | null;
  freightClpPerT?: number | null;
  adjustmentsClpPerT?: number | null;
  /** 0 o 10% como escenario del arriendo borrador, no como contrato vigente. */
  draftRoyaltyPct?: 0 | 10 | null;
};

export type TilamaEnamiResult = {
  dryTonnes: number;
  copperContainedTonnes: number;
  cuTotalPct: number;
  cuSolublePct: number;
  tariffClpPerT: number;
  grossClp: number;
  deductionsClp: number | null;
  royaltyClp: number | null;
  scenarioNetClp: number | null;
  netbackClpPerT: number | null;
  readiness: "REFERENCE_ONLY";
  missing: string[];
  source: string;
};

function validNonnegative(n: number | null | undefined): boolean {
  return n != null && Number.isFinite(n) && n >= 0;
}

export function calculateTilamaEnami(input: TilamaEnamiInput): TilamaEnamiResult {
  const { dryTonnes, cuTotalPct, cuSolublePct } = input;
  if (!Number.isFinite(dryTonnes) || dryTonnes <= 0 || dryTonnes > 20_000_000) {
    throw new Error("INVALID_DRY_TONNES");
  }
  if (!Number.isFinite(cuTotalPct) || cuTotalPct <= 0 || cuTotalPct > 100) {
    throw new Error("INVALID_TOTAL_COPPER_GRADE");
  }
  if (
    !Number.isFinite(cuSolublePct) ||
    cuSolublePct < 1 ||
    cuSolublePct > 3 ||
    cuSolublePct > cuTotalPct
  ) {
    throw new Error("INVALID_SOLUBLE_COPPER_GRADE");
  }
  for (const n of [input.mineCostClpPerT, input.freightClpPerT, input.adjustmentsClpPerT]) {
    if (n != null && !validNonnegative(n)) throw new Error("INVALID_COMMERCIAL_COST");
  }
  if (
    input.draftRoyaltyPct != null &&
    input.draftRoyaltyPct !== 0 &&
    input.draftRoyaltyPct !== 10
  ) {
    throw new Error("INVALID_DRAFT_ROYALTY");
  }

  // Igualar los puntos exactos publicados por Cholqui evita diferencias de
  // redondeo de un peso entre la tabla documental y la interpolación.
  const documented = CHOLQUI_SCENARIOS.find((s) => s.grade === cuSolublePct);
  const tariffClpPerT = documented?.tariffClpTms ?? Math.round(tariffForGrade(cuSolublePct));
  if (tariffClpPerT <= 0) throw new Error("NO_POSITIVE_REFERENCE_TARIFF");
  const grossClp = dryTonnes * tariffClpPerT;
  const missing: string[] = [];
  if (input.mineCostClpPerT == null) missing.push("Costo de extracción y preparación");
  if (input.freightClpPerT == null) missing.push("Flete verificado");
  if (input.adjustmentsClpPerT == null) missing.push("Ajustes ENAMI y otros costos");
  if (input.draftRoyaltyPct == null) missing.push("Escenario de renta minera");

  const complete = missing.length === 0;
  const deductionsClp = complete
    ? dryTonnes * (input.mineCostClpPerT! + input.freightClpPerT! + input.adjustmentsClpPerT!)
    : null;
  const royaltyClp = complete ? grossClp * (input.draftRoyaltyPct! / 100) : null;
  const scenarioNetClp =
    deductionsClp != null && royaltyClp != null ? grossClp - deductionsClp - royaltyClp : null;

  return {
    dryTonnes,
    copperContainedTonnes: dryTonnes * (cuTotalPct / 100),
    cuTotalPct,
    cuSolublePct,
    tariffClpPerT,
    grossClp,
    deductionsClp,
    royaltyClp,
    scenarioNetClp,
    netbackClpPerT: scenarioNetClp == null ? null : scenarioNetClp / dryTonnes,
    readiness: "REFERENCE_ONLY",
    missing,
    source: TILAMA_ENAMI_REFERENCE.tariffSource,
  };
}
