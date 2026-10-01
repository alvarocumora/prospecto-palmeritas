// Motor de valuación de proyectos mineros — 4 metodologías industry-standard
// Todas las funciones son puras y ejecutables tanto en cliente como en server.

export type Stage =
  | "greenfield"
  | "early_stage"
  | "drilling"
  | "advanced_exploration"
  | "resource_definition"
  | "pea"
  | "pfs"
  | "fs"
  | "permitting"
  | "construction"
  | "production";

export type Commodity =
  "copper" | "gold" | "silver" | "lithium" | "iron" | "zinc" | "molybdenum" | string;

/* ————————————————————————————————————————
   1) COSTO / REEMPLAZO — US$/ha por etapa
   Fuente: benchmarks públicos SERNAGEOMIN (remates + patentes),
   S&P Capital IQ ranges 2020–2024, TSX-V option agreements.
———————————————————————————————————————— */
export const REPLACEMENT_COST_USD_PER_HA: Record<
  Stage,
  { low: number; mid: number; high: number }
> = {
  greenfield: { low: 50, mid: 100, high: 250 },
  early_stage: { low: 300, mid: 600, high: 1200 },
  drilling: { low: 2000, mid: 4000, high: 8000 },
  advanced_exploration: { low: 5000, mid: 10000, high: 20000 },
  resource_definition: { low: 12000, mid: 25000, high: 50000 },
  pea: { low: 20000, mid: 40000, high: 80000 },
  pfs: { low: 40000, mid: 80000, high: 150000 },
  fs: { low: 80000, mid: 150000, high: 300000 },
  permitting: { low: 120000, mid: 200000, high: 400000 },
  construction: { low: 200000, mid: 350000, high: 600000 },
  production: { low: 400000, mid: 600000, high: 1000000 },
};

export function replacementCostValuation(input: { area_ha: number | null; stage: Stage | string }) {
  const stageKey =
    (input.stage as Stage) in REPLACEMENT_COST_USD_PER_HA ? (input.stage as Stage) : "early_stage";
  const bench = REPLACEMENT_COST_USD_PER_HA[stageKey];
  const area = Math.max(input.area_ha ?? 0, 0);
  if (!area) return null;
  return {
    method: "replacement_cost" as const,
    low: Math.round(bench.low * area),
    mid: Math.round(bench.mid * area),
    high: Math.round(bench.high * area),
    inputs: { area_ha: area, stage: stageKey, benchmark_usd_per_ha: bench },
    rationale: `${area.toLocaleString("es-CL")} ha × US$/ha por etapa "${stageKey}" (rango ${bench.low.toLocaleString()}–${bench.high.toLocaleString()} US$/ha, benchmark público SERNAGEOMIN + TSX-V option agreements).`,
  };
}

/* ————————————————————————————————————————
   2) COMPARABLES DE MERCADO
   Mediana de US$/ha en la tabla market_comparables filtrada.
———————————————————————————————————————— */
export type MarketComp = {
  id: string;
  source: string;
  project_name: string;
  country: string;
  commodity: string;
  stage: string;
  area_ha: number | null;
  price_usd: number;
  price_per_ha_usd: number | null;
  deal_date: string | null;
  source_url: string | null;
};

function percentile(sortedValues: number[], p: number): number {
  if (!sortedValues.length) return 0;
  const idx = Math.min(
    sortedValues.length - 1,
    Math.max(0, Math.floor((sortedValues.length - 1) * p)),
  );
  return sortedValues[idx];
}

export function marketCompsValuation(input: {
  area_ha: number | null;
  commodity: string;
  stage: string;
  country: string;
  comps: MarketComp[];
}) {
  const area = Math.max(input.area_ha ?? 0, 0);
  if (!area) return null;

  const scored = input.comps
    .map((c) => {
      const perHa =
        c.price_per_ha_usd ?? (c.area_ha && c.area_ha > 0 ? c.price_usd / c.area_ha : null);
      if (!perHa || perHa <= 0) return null;
      let score = 0;
      if (c.commodity === input.commodity) score += 3;
      if (c.stage === input.stage) score += 2;
      if (c.country === input.country) score += 1;
      return { comp: c, perHa, score };
    })
    .filter((x): x is { comp: MarketComp; perHa: number; score: number } => x !== null)
    .sort((a, b) => b.score - a.score);

  // Priorizamos commodity+etapa exactos; si hay <3 relajamos filtro
  let relevant = scored.filter((s) => s.score >= 5);
  if (relevant.length < 3) relevant = scored.filter((s) => s.score >= 3);
  if (relevant.length < 3) relevant = scored.slice(0, 10);
  if (!relevant.length) return null;

  const values = relevant.map((r) => r.perHa).sort((a, b) => a - b);
  const p25 = percentile(values, 0.25);
  const p50 = percentile(values, 0.5);
  const p75 = percentile(values, 0.75);

  return {
    method: "market_comps" as const,
    low: Math.round(p25 * area),
    mid: Math.round(p50 * area),
    high: Math.round(p75 * area),
    inputs: {
      area_ha: area,
      p25_usd_per_ha: Math.round(p25),
      p50_usd_per_ha: Math.round(p50),
      p75_usd_per_ha: Math.round(p75),
      comps_used: relevant.slice(0, 8).map((r) => ({
        id: r.comp.id,
        source: r.comp.source,
        source_url: r.comp.source_url,
        project_name: r.comp.project_name,
        commodity: r.comp.commodity,
        stage: r.comp.stage,
        country: r.comp.country,
        price_per_ha_usd: Math.round(r.perHa),
        deal_date: r.comp.deal_date,
        score: r.score,
      })),
      total_matched: relevant.length,
    },
    rationale: `Mediana de US$/ha en ${relevant.length} comparables públicos priorizando commodity=${input.commodity}, etapa=${input.stage}, país=${input.country}. Rango P25–P75: ${Math.round(p25).toLocaleString()}–${Math.round(p75).toLocaleString()} US$/ha.`,
  };
}

/* ————————————————————————————————————————
   3) IN-SITU METAL VALUE — recurso × spot × factor de descuento
   Factores estándar industria (Lassonde curve derivados):
   - Inferred: 0.5–2%   → usamos 1%
   - Indicated: 2–5%    → usamos 3%
   - Measured: 5–10%    → usamos 6%
   - Reserves P&P: 10%
———————————————————————————————————————— */
export const INSITU_FACTORS = {
  inferred: 0.01,
  indicated: 0.03,
  measured: 0.06,
  reserves: 0.1,
} as const;

// Precios spot referenciales (defaults; actualizar via precios_metales si existe)
export const SPOT_PRICES_USD = {
  copper: { per_tonne: 9500 },
  gold: { per_oz: 2600 },
  silver: { per_oz: 30 },
  lithium: { per_tonne: 15000 }, // Li2CO3
  iron: { per_tonne: 100 },
  zinc: { per_tonne: 2800 },
  molybdenum: { per_tonne: 42000 },
} as const;

const OZ_PER_TONNE = 32150.7;

export function insituValuation(input: {
  commodity: string;
  resource_tonnes: number | null;
  grade: number | null; // % para base metals, g/t para preciosos
  grade_unit?: string | null;
  confidence: keyof typeof INSITU_FACTORS | string;
  spot_override?: number | null;
}) {
  const tonnes = input.resource_tonnes ?? 0;
  const grade = input.grade ?? 0;
  if (!tonnes || !grade) return null;

  const commodity = input.commodity.toLowerCase();
  let containedValueUsd = 0;
  let spotUsed = 0;
  let unit = "";

  if (commodity === "gold" || commodity === "silver") {
    // grade en g/t → oz totales
    const gramsPerTonne = grade;
    const totalOz = (((tonnes * gramsPerTonne) / OZ_PER_TONNE) * OZ_PER_TONNE) / 31.1035; // grams to oz
    const spot =
      input.spot_override ??
      (commodity === "gold" ? SPOT_PRICES_USD.gold.per_oz : SPOT_PRICES_USD.silver.per_oz);
    containedValueUsd = totalOz * spot;
    spotUsed = spot;
    unit = "oz";
  } else {
    // grade en % → tonnes contenidos
    const containedTonnes = (tonnes * grade) / 100;
    const spot =
      input.spot_override ??
      (SPOT_PRICES_USD as Record<string, { per_tonne?: number }>)[commodity]?.per_tonne ??
      0;
    containedValueUsd = containedTonnes * spot;
    spotUsed = spot;
    unit = "t";
  }

  if (!containedValueUsd) return null;

  const confKey =
    (input.confidence as keyof typeof INSITU_FACTORS) in INSITU_FACTORS
      ? (input.confidence as keyof typeof INSITU_FACTORS)
      : "inferred";
  const factor = INSITU_FACTORS[confKey];
  const mid = containedValueUsd * factor;

  return {
    method: "insitu_value" as const,
    low: Math.round(mid * 0.6),
    mid: Math.round(mid),
    high: Math.round(mid * 1.6),
    inputs: {
      tonnes,
      grade,
      grade_unit:
        input.grade_unit ?? (commodity === "gold" || commodity === "silver" ? "g/t" : "%"),
      contained_value_usd: Math.round(containedValueUsd),
      spot_price_usd: spotUsed,
      spot_unit: `US$/${unit}`,
      confidence: confKey,
      applied_factor_pct: factor * 100,
    },
    rationale: `${tonnes.toLocaleString("es-CL")} t × ${grade} ${
      commodity === "gold" || commodity === "silver" ? "g/t" : "%"
    } × spot ${spotUsed.toLocaleString()} US$/${unit} × factor ${(factor * 100).toFixed(1)}% (${confKey}) = US$${Math.round(mid).toLocaleString()}.`,
  };
}

/* ————————————————————————————————————————
   4) DCF / NPV — trae escenario económico existente
———————————————————————————————————————— */
export function dcfValuation(input: {
  npv_usd?: number | null;
  irr_pct?: number | null;
  scenario_name?: string | null;
}) {
  const npv = input.npv_usd ?? 0;
  if (!npv || npv <= 0) return null;
  return {
    method: "dcf" as const,
    low: Math.round(npv * 0.6),
    mid: Math.round(npv),
    high: Math.round(npv * 1.3),
    inputs: {
      npv_usd: Math.round(npv),
      irr_pct: input.irr_pct ?? null,
      scenario_name: input.scenario_name ?? null,
    },
    rationale: `NPV cargado desde escenario económico "${input.scenario_name ?? "base"}": US$${Math.round(npv).toLocaleString()} (IRR ${input.irr_pct ?? "n/d"}%). Rango low/high = 60%/130% del NPV base.`,
  };
}

/* ————————————————————————————————————————
   Consolidación — combina las metodologías disponibles
———————————————————————————————————————— */
export type MethodResult = NonNullable<ReturnType<typeof replacementCostValuation>>;

export type ValuationBundle = {
  currency: "USD";
  methods: Array<
    | NonNullable<ReturnType<typeof replacementCostValuation>>
    | NonNullable<ReturnType<typeof marketCompsValuation>>
    | NonNullable<ReturnType<typeof insituValuation>>
    | NonNullable<ReturnType<typeof dcfValuation>>
  >;
  consolidated: { low: number; mid: number; high: number } | null;
  gap_vs_asking: {
    asking_usd: number | null;
    delta_mid_usd: number | null;
    delta_pct: number | null;
    verdict: "under" | "fair" | "over" | "unknown";
  };
};

export function consolidateMethods(
  methods: ValuationBundle["methods"],
  asking_price_usd: number | null,
): ValuationBundle {
  if (!methods.length) {
    return {
      currency: "USD",
      methods: [],
      consolidated: null,
      gap_vs_asking: {
        asking_usd: asking_price_usd,
        delta_mid_usd: null,
        delta_pct: null,
        verdict: "unknown",
      },
    };
  }
  // Ponderación: DCF>Comps>InSitu>Replacement cuando existen
  const weight: Record<string, number> = {
    dcf: 4,
    market_comps: 3,
    insitu_value: 2,
    replacement_cost: 1,
  };
  const totalW = methods.reduce((s, m) => s + (weight[m.method] ?? 1), 0);
  const wsum = (key: "low" | "mid" | "high") =>
    Math.round(methods.reduce((s, m) => s + m[key] * (weight[m.method] ?? 1), 0) / totalW);

  const consolidated = { low: wsum("low"), mid: wsum("mid"), high: wsum("high") };

  let verdict: ValuationBundle["gap_vs_asking"]["verdict"] = "unknown";
  let delta_mid_usd: number | null = null;
  let delta_pct: number | null = null;
  if (asking_price_usd && asking_price_usd > 0) {
    delta_mid_usd = consolidated.mid - asking_price_usd;
    delta_pct = (delta_mid_usd / asking_price_usd) * 100;
    if (delta_pct > 25) verdict = "under";
    else if (delta_pct < -25) verdict = "over";
    else verdict = "fair";
  }

  return {
    currency: "USD",
    methods,
    consolidated,
    gap_vs_asking: { asking_usd: asking_price_usd, delta_mid_usd, delta_pct, verdict },
  };
}
