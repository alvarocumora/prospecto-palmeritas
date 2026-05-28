// Modelo económico simplificado para venta de mineral chancable a plantas ENAMI.
// Tarifario pequeña minería referencial 2025 (público ENAMI) — los valores son
// parametrizables y deben validarse contra contrato vigente antes de operar.

export type EnamiPlant = {
  code: string;
  name: string;
  city: string;
  region: string;
  distance_km: number;          // distancia camino desde Tilama / Los Verdes 5
  maquila_usd_t: number;         // tarifa de tratamiento (USD por tonelada seca de mineral)
  refining_usd_t_fino: number;   // costo de refinación (USD por tonelada de Cu fino)
  payable_pct: number;           // % pagable del Cu fino
  notes: string;
};

export const ENAMI_PLANTS: EnamiPlant[] = [
  {
    code: "MATTA",
    name: "Planta Manuel A. Matta",
    city: "Cabildo",
    region: "Valparaíso",
    distance_km: 135,
    maquila_usd_t: 92,
    refining_usd_t_fino: 850,
    payable_pct: 96.5,
    notes: "Capacidad ~1.500 t/d. Ruta D-605 → Ruta 5 Sur. Mejor logística desde Tilama.",
  },
  {
    code: "DELTA",
    name: "Planta Delta",
    city: "Ovalle",
    region: "Coquimbo",
    distance_km: 155,
    maquila_usd_t: 95,
    refining_usd_t_fino: 870,
    payable_pct: 96.5,
    notes: "Capacidad ~1.800 t/d. Ruta 5 Norte. Misma región administrativa.",
  },
  {
    code: "VALLENAR",
    name: "Planta Vallenar",
    city: "Vallenar",
    region: "Atacama",
    distance_km: 370,
    maquila_usd_t: 90,
    refining_usd_t_fino: 830,
    payable_pct: 96.5,
    notes: "Capacidad ~2.500 t/d. Mayor capacidad pero distancia penaliza opex.",
  },
];

export const ECON_DEFAULTS = {
  lme_cu_usd_t: 9200,            // ~4.17 USD/lb
  truck_rate_usd_t_km: 0.18,     // camión 30 t, ruta pavimentada Coquimbo
  drilling_usd_t: 1.8,           // perforación tronadura
  blasting_usd_t: 1.4,           // explosivo + accesorios (factor 0.35 kg/t)
  loading_usd_t: 1.6,            // carguío cargador frontal 3 m³
  crushing_usd_t: 4.5,           // chancado primario móvil mandíbula
  internal_haul_usd_t: 1.2,      // transporte mina-acopio
  admin_usd_t: 2.0,              // overhead administración / supervisión
  contingency_pct: 0.15,         // 15 % contingencia sobre opex directo
  density_tm3: 2.7,
  cutoff_cu_pct: 0.8,
  recovery_pct: 85,
  discount_rate: 0.08,
};

export type FrenteEconomics = {
  frenteCode: string;
  frenteName: string;
  tonnesPerMonth: number;
  avgGradeCuPct: number;
  monthsActive: number;
};

export type EnamiSettlement = {
  plant: EnamiPlant;
  tonnes: number;
  gradeCuPct: number;
  cuFinoTon: number;             // tCu fino pagable
  lmeRevenueUsd: number;         // valor bruto Cu fino (LME × tCu pagable)
  maquilaUsd: number;            // costo maquila
  refiningUsd: number;           // costo refinación
  transportUsd: number;          // costo transporte camión
  miningOpexUsd: number;         // opex mina + chancado
  netToProducerUsd: number;      // pago neto al productor
  marginUsdPerTon: number;       // USD/t mineral chancable
  payableRatio: number;          // 0..1 — fracción del bruto que llega al productor
};

export function miningOpexPerTon(): number {
  const d = ECON_DEFAULTS;
  const direct =
    d.drilling_usd_t + d.blasting_usd_t + d.loading_usd_t + d.crushing_usd_t +
    d.internal_haul_usd_t + d.admin_usd_t;
  return direct * (1 + d.contingency_pct);
}

export function transportCost(tons: number, distance_km: number): number {
  return tons * distance_km * ECON_DEFAULTS.truck_rate_usd_t_km;
}

export function settleAtPlant(
  tonnes: number,
  gradeCuPct: number,
  plant: EnamiPlant,
  lme_usd_t = ECON_DEFAULTS.lme_cu_usd_t,
): EnamiSettlement {
  const recoveryFraction = ECON_DEFAULTS.recovery_pct / 100;
  const payableFraction = plant.payable_pct / 100;
  const cuFinoRecovered = tonnes * (gradeCuPct / 100) * recoveryFraction;
  const cuFinoPayable = cuFinoRecovered * payableFraction;

  const lmeRevenue = cuFinoPayable * lme_usd_t;
  const maquila = tonnes * plant.maquila_usd_t;
  const refining = cuFinoPayable * plant.refining_usd_t_fino;
  const transport = transportCost(tonnes, plant.distance_km);
  const miningOpex = tonnes * miningOpexPerTon();

  const netToProducer = lmeRevenue - maquila - refining - transport - miningOpex;
  const margin = tonnes > 0 ? netToProducer / tonnes : 0;
  const payableRatio = lmeRevenue > 0 ? netToProducer / lmeRevenue : 0;

  return {
    plant,
    tonnes,
    gradeCuPct,
    cuFinoTon: cuFinoPayable,
    lmeRevenueUsd: lmeRevenue,
    maquilaUsd: maquila,
    refiningUsd: refining,
    transportUsd: transport,
    miningOpexUsd: miningOpex,
    netToProducerUsd: netToProducer,
    marginUsdPerTon: margin,
    payableRatio,
  };
}

export function compareEnamiPlants(
  tonnes: number,
  gradeCuPct: number,
  lme_usd_t = ECON_DEFAULTS.lme_cu_usd_t,
): EnamiSettlement[] {
  return ENAMI_PLANTS.map((p) => settleAtPlant(tonnes, gradeCuPct, p, lme_usd_t))
    .sort((a, b) => b.netToProducerUsd - a.netToProducerUsd);
}

export type FrenteCubicacion = {
  tonnes: number;
  cuFinoTon: number;
  inSituValueUsd: number;
  monthsAt5kt: number;            // duración estimada @ 5.000 t/mes
};

export function cubicacionFrente(
  area_m2: number,
  thickness_m: number,
  gradeCuPct: number,
): FrenteCubicacion {
  const d = ECON_DEFAULTS;
  const tonnes = area_m2 * thickness_m * d.density_tm3;
  const cuFino = tonnes * (gradeCuPct / 100);
  const inSituValue = cuFino * d.lme_cu_usd_t;
  return {
    tonnes,
    cuFinoTon: cuFino,
    inSituValueUsd: inSituValue,
    monthsAt5kt: tonnes / 5000,
  };
}

export function npv(cashflowsMonthly: number[], annualRate = ECON_DEFAULTS.discount_rate): number {
  const monthlyRate = Math.pow(1 + annualRate, 1 / 12) - 1;
  return cashflowsMonthly.reduce(
    (acc, cf, i) => acc + cf / Math.pow(1 + monthlyRate, i + 1),
    0,
  );
}

export function irr(cashflowsMonthly: number[]): number | null {
  // Newton-Raphson simple sobre tasa mensual
  let rate = 0.01;
  for (let i = 0; i < 80; i++) {
    let npvVal = 0;
    let deriv = 0;
    for (let t = 0; t < cashflowsMonthly.length; t++) {
      const cf = cashflowsMonthly[t];
      const denom = Math.pow(1 + rate, t);
      npvVal += cf / denom;
      if (t > 0) deriv -= (t * cf) / (denom * (1 + rate));
    }
    if (Math.abs(deriv) < 1e-9) return null;
    const next = rate - npvVal / deriv;
    if (!Number.isFinite(next)) return null;
    if (Math.abs(next - rate) < 1e-6) {
      rate = next;
      return Math.pow(1 + rate, 12) - 1;
    }
    rate = next;
  }
  return null;
}
