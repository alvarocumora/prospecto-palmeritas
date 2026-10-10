export type InvestmentScenario = "conservative" | "base" | "optimistic";
const multiples: Record<InvestmentScenario, number> = { conservative: 1.4, base: 2.2, optimistic: 4 };
export function calculateInvestmentReturn(amount: number, years: number, scenario: InvestmentScenario, stageBonus: number) {
  if (!Number.isFinite(amount) || amount <= 0 || !Number.isFinite(years) || years < 1 || !Number.isFinite(stageBonus) || stageBonus <= -1) throw new Error("Parámetros de simulación no válidos.");
  const multiplier = multiples[scenario] * (1 + stageBonus);
  const final = amount * multiplier;
  const irr = Math.pow(multiplier, 1 / years) - 1;
  return { final, multiplier, irr, gain: final - amount };
}
export function simulationReturnPath(listingId: string, amount: number, years: number, scenario: InvestmentScenario) {
  const search = new URLSearchParams({ simulationAmount: String(amount), simulationYears: String(years), simulationScenario: scenario });
  return "/proyectos/" + encodeURIComponent(listingId) + "?" + search.toString();
}
export function readSimulationSearch(search: Record<string, unknown>, fallbackAmount: number, minAmount: number, maxAmount: number) {
  const amount = Number(search.simulationAmount);
  const years = Number(search.simulationYears);
  const scenario = search.simulationScenario;
  return {
    amount: Number.isFinite(amount) && amount >= minAmount && amount <= maxAmount ? amount : fallbackAmount,
    years: Number.isInteger(years) && years >= 1 && years <= 10 ? years : 5,
    scenario: scenario === "conservative" || scenario === "optimistic" || scenario === "base" ? scenario : "base" as InvestmentScenario,
  };
}
