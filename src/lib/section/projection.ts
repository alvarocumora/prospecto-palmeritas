import type { DrillHole, DrillCoreLog } from "@/hooks/useDrilling";

/** UTM 19S → lat/lng (mirror of drillCollarsLayer). */
function utmToLatLng(easting: number, northing: number, zone = 19, south = true): [number, number] {
  const a = 6378137.0,
    f = 1 / 298.257223563,
    k0 = 0.9996;
  const e2 = f * (2 - f),
    ep2 = e2 / (1 - e2);
  const x = easting - 500000.0;
  const y = south ? northing - 10000000.0 : northing;
  const M = y / k0;
  const mu = M / (a * (1 - e2 / 4 - (3 * e2 * e2) / 64 - (5 * e2 * e2 * e2) / 256));
  const e1 = (1 - Math.sqrt(1 - e2)) / (1 + Math.sqrt(1 - e2));
  const J1 = (3 * e1) / 2 - (27 * e1 ** 3) / 32;
  const J2 = (21 * e1 ** 2) / 16 - (55 * e1 ** 4) / 32;
  const J3 = (151 * e1 ** 3) / 96;
  const J4 = (1097 * e1 ** 4) / 512;
  const fp =
    mu +
    J1 * Math.sin(2 * mu) +
    J2 * Math.sin(4 * mu) +
    J3 * Math.sin(6 * mu) +
    J4 * Math.sin(8 * mu);
  const sinFp = Math.sin(fp),
    cosFp = Math.cos(fp),
    tanFp = Math.tan(fp);
  const C1 = ep2 * cosFp * cosFp;
  const T1 = tanFp * tanFp;
  const R1 = (a * (1 - e2)) / Math.pow(1 - e2 * sinFp * sinFp, 1.5);
  const N1 = a / Math.sqrt(1 - e2 * sinFp * sinFp);
  const D = x / (N1 * k0);
  const Q1 = (N1 * tanFp) / R1;
  const Q2 = (D * D) / 2;
  const Q3 = ((5 + 3 * T1 + 10 * C1 - 4 * C1 * C1 - 9 * ep2) * Math.pow(D, 4)) / 24;
  const Q4 =
    ((61 + 90 * T1 + 298 * C1 + 45 * T1 * T1 - 252 * ep2 - 3 * C1 * C1) * Math.pow(D, 6)) / 720;
  const lat = fp - Q1 * (Q2 - Q3 + Q4);
  const Q5 = D;
  const Q6 = ((1 + 2 * T1 + C1) * Math.pow(D, 3)) / 6;
  const Q7 = ((5 - 2 * C1 + 28 * T1 - 3 * C1 * C1 + 8 * ep2 + 24 * T1 * T1) * Math.pow(D, 5)) / 120;
  const lon = (Q5 - Q6 + Q7) / cosFp;
  const lonOrigin = ((zone - 1) * 6 - 180 + 3) * (Math.PI / 180);
  return [lat * (180 / Math.PI), (lonOrigin + lon) * (180 / Math.PI)];
}

export function holeLatLng(h: DrillHole): [number, number] | null {
  if (h.easting == null || h.northing == null) return null;
  const e = Number(h.easting),
    n = Number(h.northing);
  if (!Number.isFinite(e) || !Number.isFinite(n)) return null;
  if (Math.abs(e) <= 180 && Math.abs(n) <= 90) return [n, e];
  return utmToLatLng(e, n, 19, true);
}

/** Approx meters per degree at given latitude. */
function metersPerDegree(lat: number): { mLng: number; mLat: number } {
  const latRad = (lat * Math.PI) / 180;
  return {
    mLat: 111132.92 - 559.82 * Math.cos(2 * latRad) + 1.175 * Math.cos(4 * latRad),
    mLng: 111412.84 * Math.cos(latRad) - 93.5 * Math.cos(3 * latRad),
  };
}

export type SectionLine = {
  start: [number, number]; // lat, lng
  end: [number, number];
  lengthM: number;
  bearingDeg: number;
};

export function buildSectionLine(start: [number, number], end: [number, number]): SectionLine {
  const midLat = (start[0] + end[0]) / 2;
  const { mLng, mLat } = metersPerDegree(midLat);
  const dx = (end[1] - start[1]) * mLng;
  const dy = (end[0] - start[0]) * mLat;
  const lengthM = Math.sqrt(dx * dx + dy * dy);
  const bearingDeg = ((Math.atan2(dx, dy) * 180) / Math.PI + 360) % 360;
  return { start, end, lengthM, bearingDeg };
}

export type ProjectedHole = {
  hole: DrillHole;
  /** distance along section line (m) from start */
  alongM: number;
  /** perpendicular distance to line (m), absolute value */
  offsetM: number;
  /** signed offset (+ right of section direction, − left) */
  signedOffsetM: number;
  /** projected horizontal length of hole on section, m */
  projectedLengthM: number;
  /** intercepts along the hole, with depth ranges + grades */
  logs: DrillCoreLog[];
};

/**
 * Project drill holes onto a section line. Returns holes within ±maxOffsetM of the line
 * and within the line's along-axis extent.
 */
export function projectHolesToSection(
  holes: DrillHole[],
  logsByHole: Record<string, DrillCoreLog[]>,
  line: SectionLine,
  maxOffsetM = 50,
): ProjectedHole[] {
  const midLat = (line.start[0] + line.end[0]) / 2;
  const { mLng, mLat } = metersPerDegree(midLat);
  const ax = (line.end[1] - line.start[1]) * mLng;
  const ay = (line.end[0] - line.start[0]) * mLat;
  const len2 = ax * ax + ay * ay;
  if (len2 === 0) return [];

  const result: ProjectedHole[] = [];
  for (const h of holes) {
    const ll = holeLatLng(h);
    if (!ll) continue;
    const px = (ll[1] - line.start[1]) * mLng;
    const py = (ll[0] - line.start[0]) * mLat;
    const t = (px * ax + py * ay) / len2;
    const along = t * line.lengthM;
    if (along < -10 || along > line.lengthM + 10) continue;
    // Perpendicular signed offset using 2D cross product
    const cross = (ax * py - ay * px) / line.lengthM;
    const offset = Math.abs(cross);
    if (offset > maxOffsetM) continue;

    // Hole projected on section: hole horizontal projection = depth * cos(dip) (dip negative below horizon)
    const dip = h.dip ?? -90;
    const az = h.azimuth ?? 0;
    const depth = h.actual_depth ?? h.planned_depth ?? 0;
    const dipRad = (Math.abs(dip) * Math.PI) / 180;
    const azRad = (az * Math.PI) / 180;
    const sectionBearingRad = (line.bearingDeg * Math.PI) / 180;
    const angleDiff = azRad - sectionBearingRad;
    // horizontal hole length component along section direction
    const horiz = depth * Math.cos(dipRad);
    const projectedLengthM = Math.abs(horiz * Math.cos(angleDiff));

    result.push({
      hole: h,
      alongM: along,
      offsetM: offset,
      signedOffsetM: cross,
      projectedLengthM,
      logs: logsByHole[h.id] ?? [],
    });
  }
  return result.sort((a, b) => a.alongM - b.alongM);
}

/** Au color ramp for log intervals. */
export function auGradeColor(au: number | null | undefined): string {
  if (au == null) return "#3a322c";
  if (au >= 5) return "#dc2626";
  if (au >= 1) return "#f97316";
  if (au >= 0.3) return "#facc15";
  if (au >= 0.1) return "#bef264";
  return "#475569";
}

const LITHO_COLORS: Record<string, string> = {
  andesita: "#7f8a99",
  brecha: "#c084fc",
  cuarzo: "#fafafa",
  diorita: "#9ca3af",
  granito: "#fde68a",
  riolita: "#fca5a5",
  sedimentaria: "#d6d3d1",
  toba: "#fbcfe8",
  veta: "#facc15",
};

export function lithoColor(litho: string | null | undefined): string {
  if (!litho) return "#3a322c";
  const k = litho.toLowerCase().split(/[\s,]/)[0];
  return LITHO_COLORS[k] ?? "#52525b";
}
