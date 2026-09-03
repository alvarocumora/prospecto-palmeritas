/**
 * PLAN MINERO ESCALABLE — PROYECTO CHOLQUI.
 *
 * Funciones puras de ingeniería preliminar: rampa de producción, dimensionamiento
 * de flota, costos unitarios y flujo de venta a ENAMI. NO es una nueva fuente de
 * datos: las tarifas, el capex inicial y el plan declarado se leen de
 * `./cholqui` (fuente única). Aquí sólo se calcula.
 *
 * Rótulos obligatorios en pantalla y PDF:
 *  - Meseta 15.000 t/mes = "plan declarado".
 *  - Meseta 20.000 t/mes = "hipótesis de ampliación, sujeta al marco regulatorio
 *    y a permisos — por validar".
 *  - Costos unitarios y flota = "estimación de ingeniería preliminar", no
 *    cotizaciones cerradas.
 */
import { CHOLQUI_ENAMI, CHOLQUI_INITIAL_CAPEX_CLP } from "./cholqui";

export type EquipmentSpec = {
  key: string;
  label: string;
  /** Capacidad nominal por unidad, t de mineral por mes. */
  capacityTMonth: number;
  /** Disponibilidad mecánica práctica (0–1). La capacidad efectiva es capacidad × disponibilidad. */
  availability: number;
  /** Arriendo mensual con operador, CLP por unidad en producción. */
  monthlyClp: number;
  /** Equipo crítico: su falla detiene la cadena y exige unidad stand-by. */
  critical: boolean;
  /** Ritmo (t/mes) desde el cual se incorpora una unidad de respaldo. */
  standbyFromRate: number;
  /** Arriendo mensual de la unidad stand-by (tarifa reducida por no operar a plena carga). */
  standbyMonthlyClp: number;
  note: string;
};

/** Flota de arriendo con operador — estimación de ingeniería preliminar. */
export const FLEET_SPECS: EquipmentSpec[] = [
  {
    key: "perforadora",
    label: "Perforadora track drill",
    capacityTMonth: 12_000,
    availability: 0.8,
    monthlyClp: 9_500_000,
    critical: true,
    standbyFromRate: 5_000,
    standbyMonthlyClp: 4_300_000,
    note: "Malla de tronadura en bancos de 5 m",
  },
  {
    key: "excavadora",
    label: "Excavadora 30 t",
    capacityTMonth: 15_000,
    availability: 0.85,
    monthlyClp: 11_000_000,
    critical: true,
    standbyFromRate: 3_000,
    standbyMonthlyClp: 5_000_000,
    note: "Arranque y saneo de frentes",
  },
  {
    key: "cargador",
    label: "Cargador frontal 3 m³",
    capacityTMonth: 18_000,
    availability: 0.88,
    monthlyClp: 7_500_000,
    critical: true,
    standbyFromRate: 3_000,
    standbyMonthlyClp: 3_400_000,
    note: "Carguío a camión y alimentación al chancador",
  },
  {
    key: "camion",
    label: "Camión interno 30 t",
    capacityTMonth: 6_000,
    availability: 0.86,
    monthlyClp: 4_200_000,
    critical: false,
    standbyFromRate: 10_000,
    standbyMonthlyClp: 1_900_000,
    note: "Transporte mina–acopio–chancado (ciclo corto)",
  },
  {
    key: "chancador",
    label: "Chancador móvil de mandíbula",
    capacityTMonth: 12_000,
    availability: 0.82,
    monthlyClp: 14_000_000,
    critical: true,
    standbyFromRate: 5_000,
    standbyMonthlyClp: 6_300_000,
    note: "Reducción a granulometría de recepción ENAMI",
  },
  {
    key: "grupo",
    label: "Grupo electrógeno de planta",
    capacityTMonth: 12_000,
    availability: 0.9,
    monthlyClp: 3_600_000,
    critical: true,
    standbyFromRate: 3_000,
    standbyMonthlyClp: 1_600_000,
    note: "Energía del chancado y de la instalación de faena",
  },
  {
    key: "bulldozer",
    label: "Bulldozer D6",
    capacityTMonth: 20_000,
    availability: 0.85,
    monthlyClp: 8_000_000,
    critical: false,
    standbyFromRate: 20_000,
    standbyMonthlyClp: 3_600_000,
    note: "Caminos, botaderos y plataformas",
  },
  {
    key: "motoniveladora",
    label: "Motoniveladora 140 HP",
    capacityTMonth: 15_000,
    availability: 0.85,
    monthlyClp: 6_200_000,
    critical: false,
    standbyFromRate: 20_000,
    standbyMonthlyClp: 2_800_000,
    note: "Mantención de caminos internos y rampa de acceso",
  },
  {
    key: "retro",
    label: "Retroexcavadora de apoyo",
    capacityTMonth: 15_000,
    availability: 0.88,
    monthlyClp: 3_800_000,
    critical: false,
    standbyFromRate: 20_000,
    standbyMonthlyClp: 1_700_000,
    note: "Zanjas, drenajes y apoyo a montaje",
  },
  {
    key: "minicargador",
    label: "Minicargador",
    capacityTMonth: 20_000,
    availability: 0.9,
    monthlyClp: 2_100_000,
    critical: false,
    standbyFromRate: 20_000,
    standbyMonthlyClp: 950_000,
    note: "Limpieza de frentes, acopios y planta de chancado",
  },
  {
    key: "aljibe",
    label: "Camión aljibe",
    capacityTMonth: 20_000,
    availability: 0.88,
    monthlyClp: 3_200_000,
    critical: false,
    standbyFromRate: 20_000,
    standbyMonthlyClp: 1_450_000,
    note: "Supresión de polvo en caminos internos",
  },
  {
    key: "mantencion",
    label: "Camión de mantención y lubricación",
    capacityTMonth: 15_000,
    availability: 0.9,
    monthlyClp: 2_900_000,
    critical: false,
    standbyFromRate: 20_000,
    standbyMonthlyClp: 1_300_000,
    note: "Mantención en terreno para sostener la disponibilidad supuesta",
  },
  {
    key: "camioneta",
    label: "Camioneta de supervisión",
    capacityTMonth: 10_000,
    availability: 0.95,
    monthlyClp: 1_400_000,
    critical: false,
    standbyFromRate: 20_000,
    standbyMonthlyClp: 640_000,
    note: "Supervisión, prevención de riesgos y logística",
  },
];


export type UnitCost = {
  rate: number;
  variableClpT: number;
  fixedClpT: number;
  fleetClpT: number;
  contingencyClpT: number;
  totalClpT: number;
  monthlyCostClp: number;
};

/** Costo unitario y mensual a un ritmo dado. El unitario cae al escalar. */
export function unitCosts(rate: number): UnitCost {
  const t = Math.max(1, rate);
  const fleet = fleetForRate(rate).monthlyClp;
  const fixedClpT = FIXED_CLP_MONTH / t;
  const fleetClpT = fleet / t;
  const base = VARIABLE_CLP_T + fixedClpT + fleetClpT;
  const contingencyClpT = base * (CONTINGENCY_PCT / 100);
  const totalClpT = base + contingencyClpT;
  return {
    rate,
    variableClpT: VARIABLE_CLP_T,
    fixedClpT,
    fleetClpT,
    contingencyClpT,
    totalClpT,
    monthlyCostClp: totalClpT * rate,
  };
}

/** Tarifa ENAMI para una ley de Cu soluble, según la escala de la Circular N°27. */
export function tariffForGrade(gradePct: number): number {
  const { baseTariffClpTms, baseGradePct, scaleClpPerPct } = CHOLQUI_ENAMI;
  return baseTariffClpTms - (baseGradePct - gradePct) * scaleClpPerPct;
}

/** Ritmo mínimo (t/mes) en que el margen operacional deja de ser negativo. */
export function breakevenRate(gradePct: number): number | null {
  const tariff = tariffForGrade(gradePct);
  for (let r = 250; r <= 30_000; r += 50) {
    if (tariff - unitCosts(r).totalClpT >= 0) return r;
  }
  return null;
}

export type MinePlanParams = {
  startRate: number;
  plateau: number;
  rampMonths: number;
  totalMonths: number;
  gradePct: number;
};

export const DEFAULT_PLAN: MinePlanParams = {
  startRate: 1_000,
  plateau: 15_000,
  rampMonths: 12,
  totalMonths: 24,
  gradePct: 1.5,
};

export type MonthRow = {
  month: number;
  rate: number;
  cumulativeT: number;
  revenueClp: number;
  costClp: number;
  marginClp: number;
  cumulativeCashflowClp: number;
  fleetUnits: number;
  fleetClp: number;
};

export type MinePlanResult = {
  params: MinePlanParams;
  tariffClpTms: number;
  months: MonthRow[];
  totalTonnes: number;
  totalRevenueClp: number;
  totalCostClp: number;
  operatingSurplusClp: number;
  netAfterCapexClp: number;
  capexClp: number;
  paybackMonth: number | null;
  breakevenRate: number | null;
  avgUnitCostClpT: number;
  marginClpT: number;
  peakFleetUnits: number;
  peakFleetMonthlyClp: number;
};

/** Rampa lineal desde `startRate` hasta `plateau` en `rampMonths`, luego meseta. */
export function buildRamp(p: MinePlanParams): number[] {
  const out: number[] = [];
  const ramp = Math.max(1, Math.min(p.rampMonths, p.totalMonths));
  for (let m = 1; m <= p.totalMonths; m++) {
    if (m >= ramp) {
      out.push(p.plateau);
    } else {
      const step = (p.plateau - p.startRate) / ramp;
      out.push(Math.round(p.startRate + step * (m - 1)));
    }
  }
  return out;
}

/** Proyección completa de producción, costos, venta a ENAMI y flujo acumulado. */
export function projectCashflow(input: Partial<MinePlanParams> = {}): MinePlanResult {
  const params: MinePlanParams = { ...DEFAULT_PLAN, ...input };
  const tariff = tariffForGrade(params.gradePct);
  const rates = buildRamp(params);
  const capex = CHOLQUI_INITIAL_CAPEX_CLP;

  let cumulativeT = 0;
  let cash = -capex;
  let paybackMonth: number | null = null;
  let peakFleetUnits = 0;
  let peakFleetMonthlyClp = 0;

  const months: MonthRow[] = rates.map((rate, i) => {
    const uc = unitCosts(rate);
    const fleet = fleetForRate(rate);
    const units = fleet.lines.reduce((a, l) => a + l.units, 0);
    peakFleetUnits = Math.max(peakFleetUnits, units);
    peakFleetMonthlyClp = Math.max(peakFleetMonthlyClp, fleet.monthlyClp);

    const revenue = rate * tariff;
    const cost = uc.monthlyCostClp;
    const margin = revenue - cost;
    cumulativeT += rate;
    cash += margin;
    if (paybackMonth === null && cash >= 0) paybackMonth = i + 1;

    return {
      month: i + 1,
      rate,
      cumulativeT,
      revenueClp: revenue,
      costClp: cost,
      marginClp: margin,
      cumulativeCashflowClp: cash,
      fleetUnits: units,
      fleetClp: fleet.monthlyClp,
    };
  });

  const totalRevenue = months.reduce((a, m) => a + m.revenueClp, 0);
  const totalCost = months.reduce((a, m) => a + m.costClp, 0);
  const surplus = totalRevenue - totalCost;

  return {
    params,
    tariffClpTms: tariff,
    months,
    totalTonnes: cumulativeT,
    totalRevenueClp: totalRevenue,
    totalCostClp: totalCost,
    operatingSurplusClp: surplus,
    netAfterCapexClp: surplus - capex,
    capexClp: capex,
    paybackMonth,
    breakevenRate: breakevenRate(params.gradePct),
    avgUnitCostClpT: cumulativeT > 0 ? totalCost / cumulativeT : 0,
    marginClpT: cumulativeT > 0 ? surplus / cumulativeT : 0,
    peakFleetUnits,
    peakFleetMonthlyClp,
  };
}
