/**
 * Cholqui logistics engineering model.
 *
 * Published market values are benchmarks, not Cholqui-specific supplier quotes.
 * The 130 km one-way distance remains a planning distance until the mine access
 * and destination gate are routed and verified for heavy trucks.
 */

export type LogisticsInputs = {
  tonnesPerMonth: number;
  oneWayKm: number;
  payloadTonnes: number;
  operatingDays: number;
  cyclesPerTruckDay: number;
  dieselClpL: number;
  loadedEfficiencyKmL: number;
  emptyEfficiencyKmL: number;
  monthlyTruckRentalClp: number;
  thirdPartyClpKm: number;
};

export const CHOLQUI_LOGISTICS_BENCHMARK: LogisticsInputs = {
  tonnesPerMonth: 15_000,
  oneWayKm: 130,
  payloadTonnes: 28,
  operatingDays: 26,
  cyclesPerTruckDay: 1.5,
  dieselClpL: 1_392,
  loadedEfficiencyKmL: 2.6,
  emptyEfficiencyKmL: 2.8,
  monthlyTruckRentalClp: 6_500_000,
  thirdPartyClpKm: 3_000,
};

export const LOGISTICS_MARKET_REFERENCES = {
  diesel: {
    valueClpL: 1_392,
    date: "2026-09-25",
    status: "PUBLISHED_MARKET_REFERENCE",
    source: "PrecioCombustible / CNE-derived RM average",
  },
  truckRental20m3: {
    valueClpMonth: 6_500_000,
    status: "PUBLISHED_FROM_PRICE",
    source: "Tank Rent — 20 m3 8x4 mining configuration, minimum 30 days",
  },
  thirdPartyTruck14m3: {
    valueClpKm: 3_000,
    status: "PUBLIC_AWARD_REFERENCE",
    source: "Mercado Público 2026 — Camión tolva 14 m3, convenio de suministro",
  },
  distance: {
    valueKmOneWay: 130,
    status: "PLANNING_ASSUMPTION",
    source:
      "Legacy Cholqui assumption. Public regional routes make the order of magnitude plausible, but the heavy-truck road route from mine gate to destination remains PENDING_DD.",
  },
} as const;

function positive(name: string, value: number): void {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`INVALID_${name}`);
}

export type LogisticsResult = {
  tonnesPerMonth: number;
  tripsPerMonth: number;
  loadedTripsPerDay: number;
  trucksRequired: number;
  cycleKm: number;
  fleetKmPerMonth: number;
  dieselLitresPerTrip: number;
  dieselLitresPerMonth: number;
  dieselCostClpMonth: number;
  rentalCostClpMonth: number;
  rentalPlusDieselClpMonth: number;
  rentalPlusDieselClpT: number;
  thirdPartyClpTrip: number;
  thirdPartyClpMonth: number;
  thirdPartyClpT: number;
};

export function calculateLogistics(input: LogisticsInputs): LogisticsResult {
  positive("TONNES", input.tonnesPerMonth);
  positive("DISTANCE", input.oneWayKm);
  positive("PAYLOAD", input.payloadTonnes);
  positive("OPERATING_DAYS", input.operatingDays);
  positive("CYCLES_PER_DAY", input.cyclesPerTruckDay);
  positive("DIESEL_PRICE", input.dieselClpL);
  positive("LOADED_EFFICIENCY", input.loadedEfficiencyKmL);
  positive("EMPTY_EFFICIENCY", input.emptyEfficiencyKmL);
  positive("RENTAL", input.monthlyTruckRentalClp);
  positive("THIRD_PARTY_RATE", input.thirdPartyClpKm);

  const tripsPerMonth = input.tonnesPerMonth / input.payloadTonnes;
  const loadedTripsPerDay = tripsPerMonth / input.operatingDays;
  const trucksRequired = Math.ceil(loadedTripsPerDay / input.cyclesPerTruckDay);
  const cycleKm = input.oneWayKm * 2;
  const fleetKmPerMonth = tripsPerMonth * cycleKm;
  const dieselLitresPerTrip =
    input.oneWayKm / input.loadedEfficiencyKmL + input.oneWayKm / input.emptyEfficiencyKmL;
  const dieselLitresPerMonth = tripsPerMonth * dieselLitresPerTrip;
  const dieselCostClpMonth = dieselLitresPerMonth * input.dieselClpL;
  const rentalCostClpMonth = trucksRequired * input.monthlyTruckRentalClp;
  const rentalPlusDieselClpMonth = rentalCostClpMonth + dieselCostClpMonth;
  const thirdPartyClpTrip = cycleKm * input.thirdPartyClpKm;
  const thirdPartyClpMonth = tripsPerMonth * thirdPartyClpTrip;

  return {
    tonnesPerMonth: input.tonnesPerMonth,
    tripsPerMonth,
    loadedTripsPerDay,
    trucksRequired,
    cycleKm,
    fleetKmPerMonth,
    dieselLitresPerTrip,
    dieselLitresPerMonth,
    dieselCostClpMonth,
    rentalCostClpMonth,
    rentalPlusDieselClpMonth,
    rentalPlusDieselClpT: rentalPlusDieselClpMonth / input.tonnesPerMonth,
    thirdPartyClpTrip,
    thirdPartyClpMonth,
    thirdPartyClpT: thirdPartyClpMonth / input.tonnesPerMonth,
  };
}

export function logisticsScale(
  tonnes: readonly number[] = [1_000, 5_000, 10_000, 15_000],
  base: LogisticsInputs = CHOLQUI_LOGISTICS_BENCHMARK,
): LogisticsResult[] {
  return tonnes.map((tonnesPerMonth) => calculateLogistics({ ...base, tonnesPerMonth }));
}
