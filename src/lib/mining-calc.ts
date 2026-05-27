// Cubicación simple para vetas y fases de plan minero (Los Verdes).
// Geometrías en WGS84 lng/lat. Áreas/longitudes proyectadas equirectangular
// al paralelo del centroide — suficiente para escala distrital (km).
export type LngLat = [number, number];

const R = 6378137;
const OZ_PER_GRAM = 1 / 31.1035;
const LB_PER_TONNE = 2204.6226;

export function polygonAreaM2(ring: LngLat[]): number {
  if (!ring || ring.length < 3) return 0;
  let lat0 = 0;
  for (const [, lat] of ring) lat0 += lat;
  lat0 /= ring.length;
  const cosLat = Math.cos((lat0 * Math.PI) / 180);
  const toX = (lng: number) => ((lng * Math.PI) / 180) * R * cosLat;
  const toY = (lat: number) => ((lat * Math.PI) / 180) * R;
  let a = 0;
  for (let i = 0; i < ring.length; i++) {
    const [lng1, lat1] = ring[i];
    const [lng2, lat2] = ring[(i + 1) % ring.length];
    a += toX(lng1) * toY(lat2) - toX(lng2) * toY(lat1);
  }
  return Math.abs(a / 2);
}

export function lineLengthM(line: LngLat[]): number {
  if (!line || line.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < line.length; i++) {
    const [lng1, lat1] = line[i - 1];
    const [lng2, lat2] = line[i];
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
    total += R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
  return total;
}

export type Prices = {
  cu_usd_lb?: number;
  au_usd_oz?: number;
  ag_usd_oz?: number;
};
export type Grade = {
  cu_pct?: number;
  au_gpt?: number;
  ag_gpt?: number;
};

export type Cubication = {
  tonnes: number;
  containedMetal: { cu_t?: number; au_oz?: number; ag_oz?: number };
  revenueUsd: number;
};

function applyGrade(tonnes: number, grade: Grade, recovery: number, prices: Prices): Cubication {
  const metal: Cubication["containedMetal"] = {};
  let revenue = 0;
  const cu = Number(grade.cu_pct ?? 0);
  const au = Number(grade.au_gpt ?? 0);
  const ag = Number(grade.ag_gpt ?? 0);
  if (cu > 0) {
    const cuT = tonnes * (cu / 100) * recovery;
    metal.cu_t = cuT;
    if (prices.cu_usd_lb) revenue += cuT * LB_PER_TONNE * prices.cu_usd_lb;
  }
  if (au > 0) {
    const auOz = tonnes * au * OZ_PER_GRAM * recovery;
    metal.au_oz = auOz;
    if (prices.au_usd_oz) revenue += auOz * prices.au_usd_oz;
  }
  if (ag > 0) {
    const agOz = tonnes * ag * OZ_PER_GRAM * recovery;
    metal.ag_oz = agOz;
    if (prices.ag_usd_oz) revenue += agOz * prices.ag_usd_oz;
  }
  return { tonnes, containedMetal: metal, revenueUsd: revenue };
}

export function cubicateVein(opts: {
  length_m: number;
  thickness_m: number;
  depth_top_m: number;
  depth_bottom_m: number;
  dip_deg: number;
  density_tm3: number;
  grade: Grade;
  prices?: Prices;
  recovery_pct?: number;
}): Cubication {
  const verticalThk = Math.max(0, opts.depth_bottom_m - opts.depth_top_m);
  const dipRad = (Math.max(1, Math.min(89.9, opts.dip_deg || 90)) * Math.PI) / 180;
  const dipLength = verticalThk / Math.sin(dipRad);
  const volume = opts.length_m * opts.thickness_m * dipLength;
  const tonnes = volume * opts.density_tm3;
  const rec = (opts.recovery_pct ?? 85) / 100;
  return applyGrade(tonnes, opts.grade, rec, opts.prices ?? {});
}

export type PhaseCubication = Cubication & {
  areaM2: number;
  capexUsd: number;
  opexUsd: number;
  cashflowUsd: number;
  npvUsd: number;
};

export function cubicatePhase(opts: {
  polygon: LngLat[];
  avg_thickness_m: number;
  density_tm3: number;
  grade: Grade;
  recovery_pct: number;
  capex_usd: number;
  opex_usd_t: number;
  prices: Prices;
  start_year: number;
  duration_years: number;
  discount_rate?: number;
}): PhaseCubication {
  const areaM2 = polygonAreaM2(opts.polygon);
  const volume = areaM2 * opts.avg_thickness_m;
  const tonnes = volume * opts.density_tm3;
  const cub = applyGrade(tonnes, opts.grade, opts.recovery_pct / 100, opts.prices);
  const opex = opts.opex_usd_t * tonnes;
  const cashflow = cub.revenueUsd - opex - opts.capex_usd;
  const yearMid = opts.start_year + opts.duration_years / 2;
  const r = opts.discount_rate ?? 0.08;
  const npv = cashflow / Math.pow(1 + r, yearMid);
  return {
    ...cub,
    areaM2,
    capexUsd: opts.capex_usd,
    opexUsd: opex,
    cashflowUsd: cashflow,
    npvUsd: npv,
  };
}
