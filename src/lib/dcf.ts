// Motor de flujo de caja descontado (DCF) para simulación de proyectos mineros.
// Extraído del simulador de la landing para poder testearlo y reutilizarlo.
//
// Supuestos del modelo (ilustrativo, ver /metodologia):
//  - Throughput fijo ANNUAL_THROUGHPUT t/año → vida de mina = ceil(tonelaje / throughput)
//  - Flujo anual constante = EBITDA total / vida de mina
//  - Sin impuestos, regalías ni G&A

export type Commodity = "Au" | "Cu" | "Li";

export interface SimInputs {
  commodity: Commodity;
  price: number;
  ore_t: number;
  grade: number;
  recovery: number; // %
  mining_cost: number; // USD/t
  processing_cost: number; // USD/t
  capex: number; // USD
  discount_rate: number; // %
}

export interface SimOutputs {
  gross_revenue: number;
  total_opex: number;
  ebitda: number;
  ebitda_margin: number;
  npv: number;
  irr: number | null;
  payback: number | null;
  mine_life: number;
  cashflows: number[];
}

export const ANNUAL_THROUGHPUT = 1_000_000; // t/año

export const GRAMS_PER_TROY_OZ = 31.1035;
export const LBS_PER_TONNE = 2204.62;
/** Factor Li metálico → carbonato de litio equivalente (Li₂CO₃). */
export const LI_TO_LCE = 5.323;

/**
 * Ingreso bruto por commodity.
 *  - Au: grade en g/t, price en USD/oz troy
 *  - Cu: grade en % Cu, price en USD/lb
 *  - Li: grade en % Li, price en USD/t de Li₂CO₃
 */
export function grossRevenue(
  commodity: Commodity,
  price: number,
  ore_t: number,
  grade: number,
  recovery: number,
): number {
  const rec = recovery / 100;
  if (commodity === "Au") return ore_t * (grade / GRAMS_PER_TROY_OZ) * rec * price;
  if (commodity === "Cu") return ore_t * (grade / 100) * rec * LBS_PER_TONNE * price;
  return ore_t * (grade / 100) * rec * LI_TO_LCE * price;
}

/** VPN de un flujo anual constante durante mine_life años, a tasa r. */
export function npvAt(annual_cf: number, capex: number, mine_life: number, r: number): number {
  let v = -capex;
  for (let t = 1; t <= mine_life; t++) v += annual_cf / Math.pow(1 + r, t);
  return v;
}

/** TIR por bisección en [0, 5] (cap 500%). null si el proyecto nunca paga. */
export function solveIRR(annual_cf: number, capex: number, mine_life: number): number | null {
  if (annual_cf <= 0) return null;
  if (npvAt(annual_cf, capex, mine_life, 0) <= 0) return null;
  if (npvAt(annual_cf, capex, mine_life, 5) >= 0) return 5;
  let lo = 0,
    hi = 5;
  for (let i = 0; i < 64; i++) {
    const mid = (lo + hi) / 2;
    if (npvAt(annual_cf, capex, mine_life, mid) > 0) lo = mid;
    else hi = mid;
    if (hi - lo < 1e-7) break;
  }
  return (lo + hi) / 2;
}

export function simulate(inp: SimInputs): SimOutputs {
  const mine_life = Math.max(1, Math.ceil(inp.ore_t / ANNUAL_THROUGHPUT));
  const rev = grossRevenue(inp.commodity, inp.price, inp.ore_t, inp.grade, inp.recovery);
  const opex = (inp.mining_cost + inp.processing_cost) * inp.ore_t;
  const ebitda = rev - opex;
  const annual_cf = ebitda / mine_life;
  const npv = npvAt(annual_cf, inp.capex, mine_life, inp.discount_rate / 100);
  const irr = solveIRR(annual_cf, inp.capex, mine_life);
  const payback = annual_cf > 0 ? inp.capex / annual_cf : null;
  const cashflows = [-inp.capex, ...Array.from({ length: mine_life }, () => annual_cf)];
  return {
    gross_revenue: rev,
    total_opex: opex,
    ebitda,
    ebitda_margin: rev > 0 ? (ebitda / rev) * 100 : 0,
    npv,
    irr,
    payback,
    mine_life,
    cashflows,
  };
}
