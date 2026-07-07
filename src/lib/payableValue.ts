// Agente "Assay-to-Value": modelo de valor pagable de un lote de commodity.
//
// Traduce el ensaye (ley, humedad, elementos penalizables) + precio en vivo en
// el pago NETO estimado por tonelada, descontando cargos de tratamiento (TC) y
// refinación (RC) y los castigos por impurezas (arsénico, antimonio, etc. — el
// dolor de los concentrados chilenos enargíticos). Lógica pura y testeable; el
// server fn arma los precios y compara contra el precio pedido.

export const LB_PER_TONNE = 2204.6226;
export const G_PER_TROY_OZ = 31.1035;

export type PriceInputs = {
  cuUsdT: number | null; // cobre LME/BML, USD por tonelada métrica
  auUsdOz: number | null; // oro, USD por onza troy
  agUsdOz: number | null; // plata, USD por onza troy
};

/** Elemento penalizable: libre hasta `thresholdPct`, luego castigo por tramo. */
export type PenaltyElement = {
  code: string;
  label: string;
  thresholdPct: number;
  usdPerDmtPerStep: number;
  stepPct: number;
};

// Tabla de castigos referencial (benchmark concentrado de Cu). Parametrizable.
export const DEFAULT_PENALTIES: PenaltyElement[] = [
  { code: "AS", label: "Arsénico", thresholdPct: 0.2, usdPerDmtPerStep: 2.5, stepPct: 0.1 },
  { code: "SB", label: "Antimonio", thresholdPct: 0.1, usdPerDmtPerStep: 2.0, stepPct: 0.1 },
  { code: "BI", label: "Bismuto", thresholdPct: 0.02, usdPerDmtPerStep: 1.5, stepPct: 0.01 },
  { code: "HG", label: "Mercurio", thresholdPct: 0.001, usdPerDmtPerStep: 3.0, stepPct: 0.0005 },
  { code: "PB", label: "Plomo", thresholdPct: 3.0, usdPerDmtPerStep: 1.0, stepPct: 1.0 },
];

export type ConcentrateTerms = {
  payablePct: number; // % del metal contenido que se paga
  deductionUnits: number; // deducción fija en unidades (%) sobre la ley
  tcUsdPerDmt: number; // treatment charge, USD por tonelada seca de concentrado
  rcUsdPerLb: number; // refining charge, USD por libra de Cu pagable
  penalties: PenaltyElement[];
};

// Benchmark Cu concentrado 2024-25 (referencial).
export const DEFAULT_CU_TERMS: ConcentrateTerms = {
  payablePct: 96.5,
  deductionUnits: 1.0,
  tcUsdPerDmt: 80,
  rcUsdPerLb: 0.08,
  penalties: DEFAULT_PENALTIES,
};

export type PayableInput = {
  commodity: string; // commodity_kind
  gradePct: number | null; // ley (%) — o pureza (%) en doré/bullion
  moisturePct: number | null;
  tonnage: number | null; // toneladas húmedas disponibles
  deleterious: Record<string, number>; // código de elemento → %
  prices: PriceInputs;
  terms?: ConcentrateTerms;
};

export type PenaltyLine = { code: string; label: string; pct: number; usdT: number };

export type PayableResult = {
  supported: boolean;
  basis: string;
  payableLabel: string | null;
  grossUsdT: number;
  tcUsdT: number;
  rcUsdT: number;
  penaltiesUsdT: number;
  penaltyLines: PenaltyLine[];
  netUsdDmt: number; // pago neto por tonelada SECA de concentrado
  netUsdWmt: number | null; // por tonelada húmeda (ajustada por humedad)
  netTotalUsd: number | null; // × tonelaje seco
  band: { low: number; high: number }; // banda ±10% sobre netUsdDmt
  notes: string[];
};

const BAND_PCT = 0.1;

function penaltyFor(el: PenaltyElement, pct: number): number {
  if (pct <= el.thresholdPct) return 0;
  const steps = Math.ceil((pct - el.thresholdPct) / el.stepPct);
  return steps * el.usdPerDmtPerStep;
}

function unsupported(basis: string, note: string): PayableResult {
  return {
    supported: false,
    basis,
    payableLabel: null,
    grossUsdT: 0,
    tcUsdT: 0,
    rcUsdT: 0,
    penaltiesUsdT: 0,
    penaltyLines: [],
    netUsdDmt: 0,
    netUsdWmt: null,
    netTotalUsd: null,
    band: { low: 0, high: 0 },
    notes: [note],
  };
}

function finalize(
  netUsdDmt: number,
  extras: Omit<PayableResult, "netUsdDmt" | "netUsdWmt" | "netTotalUsd" | "band" | "supported">,
  input: PayableInput,
): PayableResult {
  const moisture = input.moisturePct ?? 0;
  const dryFactor = Math.max(0, 1 - moisture / 100);
  const netUsdWmt = input.moisturePct != null ? netUsdDmt * dryFactor : null;
  const dryTonnes = input.tonnage != null ? input.tonnage * dryFactor : null;
  const netTotalUsd = dryTonnes != null ? netUsdDmt * dryTonnes : null;
  return {
    supported: true,
    ...extras,
    netUsdDmt,
    netUsdWmt,
    netTotalUsd,
    band: { low: netUsdDmt * (1 - BAND_PCT), high: netUsdDmt * (1 + BAND_PCT) },
  };
}

/** Concentrado de cobre: pago neto = Cu pagable × LME − TC − RC − castigos. */
function computeCuConcentrate(input: PayableInput): PayableResult {
  const terms = input.terms ?? DEFAULT_CU_TERMS;
  const notes: string[] = [];
  if (input.prices.cuUsdT == null) return unsupported("USD/dmt", "Precio del cobre no disponible.");
  if (input.gradePct == null || input.gradePct <= 0)
    return unsupported("USD/dmt", "Sin ley de cobre para valorizar.");

  const grade = input.gradePct;
  // Cu pagable (%) = ley − deducción, limitado por el % pagable de la ley.
  const afterDeduction = Math.max(0, grade - terms.deductionUnits);
  const payablePctOfConc = Math.min(afterDeduction, grade * (terms.payablePct / 100));
  const payableCuT = payablePctOfConc / 100; // t de Cu por dmt de concentrado
  const payableCuLb = payableCuT * LB_PER_TONNE;

  const grossUsdT = payableCuT * input.prices.cuUsdT;
  const tcUsdT = terms.tcUsdPerDmt;
  const rcUsdT = payableCuLb * terms.rcUsdPerLb;

  const penaltyLines: PenaltyLine[] = [];
  let penaltiesUsdT = 0;
  for (const el of terms.penalties) {
    const pct = input.deleterious[el.code] ?? input.deleterious[el.label?.toUpperCase()] ?? 0;
    if (pct > 0) {
      const usdT = penaltyFor(el, pct);
      if (usdT > 0) {
        penaltyLines.push({ code: el.code, label: el.label, pct, usdT });
        penaltiesUsdT += usdT;
      }
    }
  }
  if (Object.keys(input.deleterious).length === 0)
    notes.push("El vendedor no declaró impurezas: los castigos pueden estar subestimados.");

  const netUsdDmt = grossUsdT - tcUsdT - rcUsdT - penaltiesUsdT;
  notes.push("Términos TC/RC y castigos referenciales (benchmark); validar contra contrato.");

  return finalize(
    netUsdDmt,
    {
      basis: "USD por tonelada seca de concentrado (dmt)",
      payableLabel: `${payablePctOfConc.toFixed(2)}% Cu pagable`,
      grossUsdT,
      tcUsdT,
      rcUsdT,
      penaltiesUsdT,
      penaltyLines,
      notes,
    },
    input,
  );
}

/** Cátodo de cobre: casi LME, sólo % pagable alto y sin TC/RC de fundición. */
function computeCuCathode(input: PayableInput): PayableResult {
  if (input.prices.cuUsdT == null) return unsupported("USD/t", "Precio del cobre no disponible.");
  const purity = input.gradePct ?? 99.95;
  const payableCuT = Math.min(1, purity / 100);
  const grossUsdT = payableCuT * input.prices.cuUsdT;
  return finalize(
    grossUsdT,
    {
      basis: "USD por tonelada de cátodo",
      payableLabel: `${purity.toFixed(2)}% Cu`,
      grossUsdT,
      tcUsdT: 0,
      rcUsdT: 0,
      penaltiesUsdT: 0,
      penaltyLines: [],
      notes: ["Cátodo grado A: valor cercano al LME más un premio comercial no incluido."],
    },
    input,
  );
}

/** Doré / bullion precioso: onzas pagables × precio − cargo de refinación. */
function computePrecious(input: PayableInput, metal: "au" | "ag"): PayableResult {
  const priceOz = metal === "au" ? input.prices.auUsdOz : input.prices.agUsdOz;
  const label = metal === "au" ? "Oro" : "Plata";
  if (priceOz == null)
    return unsupported("USD/t", `Precio de ${label.toLowerCase()} no disponible.`);
  const purity = input.gradePct;
  if (purity == null || purity <= 0) return unsupported("USD/t", `Sin ley/pureza de ${label}.`);

  const payablePct = metal === "au" ? 99.9 : 99.5;
  const refiningUsdOz = metal === "au" ? 6 : 0.4;
  // onzas de metal fino por tonelada de material.
  const finoOzPerT = ((purity / 100) * 1_000_000) / G_PER_TROY_OZ;
  const payableOz = finoOzPerT * (payablePct / 100);
  const grossUsdT = payableOz * priceOz;
  const rcUsdT = payableOz * refiningUsdOz;
  const netUsdDmt = grossUsdT - rcUsdT;
  return finalize(
    netUsdDmt,
    {
      basis: "USD por tonelada de material",
      payableLabel: `${payableOz.toFixed(0)} oz ${metal.toUpperCase()} pagables/t`,
      grossUsdT,
      tcUsdT: 0,
      rcUsdT,
      penaltiesUsdT: 0,
      penaltyLines: [],
      notes: ["Cargo de refinación referencial; pureza interpretada desde la ley del lote."],
    },
    input,
  );
}

/** Punto de entrada: enruta por tipo de commodity. */
export function computePayableValue(input: PayableInput): PayableResult {
  switch (input.commodity) {
    case "cu_concentrate":
      return computeCuConcentrate(input);
    case "cu_cathode":
      return computeCuCathode(input);
    case "au_dore":
    case "au_bullion":
      return computePrecious(input, "au");
    case "ag_dore":
      return computePrecious(input, "ag");
    default:
      return unsupported(
        "—",
        "Modelo de valor pagable aún no disponible para este tipo de commodity.",
      );
  }
}

/** Normaliza deleterious_json (objeto {As:0.5} o arreglo [{element,value}]) a {AS:0.5}. */
export function normalizeDeleterious(raw: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  const put = (k: unknown, v: unknown) => {
    const code = typeof k === "string" ? k.trim().toUpperCase() : "";
    const num = typeof v === "number" ? v : typeof v === "string" ? parseFloat(v) : NaN;
    if (code && Number.isFinite(num)) out[code] = num;
  };
  if (Array.isArray(raw)) {
    for (const it of raw) {
      if (it && typeof it === "object") {
        const o = it as Record<string, unknown>;
        put(o.code ?? o.element ?? o.symbol ?? o.name, o.value ?? o.pct ?? o.percent);
      }
    }
  } else if (raw && typeof raw === "object") {
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) put(k, v);
  }
  return out;
}
