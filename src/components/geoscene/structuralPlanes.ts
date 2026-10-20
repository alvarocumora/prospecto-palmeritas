// Structural discs: field strike/dip rendered as oriented planes, the way
// Leapfrog/Micromine show structural measurements. Only features carrying an
// explicit strike AND dip are converted — no orientation is invented.

export interface StructurePlane {
  code: string;
  strikeDeg: number;
  dipDeg: number;
  dipDirectionDeg: number;
}

const QUAD: Record<string, [number, number]> = {
  N: [0, 1],
  S: [0, -1],
  E: [1, 0],
  W: [-1, 0],
  O: [-1, 0],
};

/** Parses "30° SE" / "60-70° NW" / "80°". Range dips use the mean. */
export function parseDip(
  text: string | null | undefined,
): { dip: number; quadrant: string } | null {
  if (!text) return null;
  const m = /(\d{1,2})(?:\s*-\s*(\d{1,2}))?\s*°?\s*([NSEWO]{0,2})/i.exec(text);
  if (!m) return null;
  const a = Number(m[1]);
  const b = m[2] ? Number(m[2]) : a;
  const dip = (a + b) / 2;
  if (!(dip >= 0 && dip <= 90)) return null;
  return { dip, quadrant: (m[3] ?? "").toUpperCase() };
}

/** Right-hand rule by default; the quadrant letters pick the matching side. */
export function dipDirection(strikeDeg: number, quadrant: string): number {
  const right = (strikeDeg + 90) % 360;
  const left = (strikeDeg + 270) % 360;
  if (!quadrant) return right;
  let qx = 0;
  let qy = 0;
  for (const ch of quadrant) {
    const v = QUAD[ch];
    if (v) {
      qx += v[0];
      qy += v[1];
    }
  }
  const dot = (az: number) =>
    Math.sin((az * Math.PI) / 180) * qx + Math.cos((az * Math.PI) / 180) * qy;
  return dot(right) >= dot(left) ? right : left;
}

export function planeFromProperties(
  p: Record<string, unknown> | null | undefined,
): StructurePlane | null {
  if (!p) return null;
  const strike = Number(p.strikeDeg);
  const dip = parseDip(p.dipText as string | null);
  if (!Number.isFinite(strike) || !dip) return null;
  return {
    code: String(p.code ?? ""),
    strikeDeg: strike,
    dipDeg: dip.dip,
    dipDirectionDeg: dipDirection(strike, dip.quadrant),
  };
}

/**
 * Disc ring in absolute coordinates [lng, lat, z]. Basis in local ENU metres:
 * strike s = (sin az, cos az, 0); down-dip d = (sin dd·cos δ, cos dd·cos δ, −sin δ).
 */
export function discRing(
  center: [number, number, number],
  plane: StructurePlane,
  radiusM: number,
  segments = 32,
): [number, number, number][] {
  const az = (plane.strikeDeg * Math.PI) / 180;
  const dd = (plane.dipDirectionDeg * Math.PI) / 180;
  const dip = (plane.dipDeg * Math.PI) / 180;
  const s = [Math.sin(az), Math.cos(az), 0];
  const d = [Math.sin(dd) * Math.cos(dip), Math.cos(dd) * Math.cos(dip), -Math.sin(dip)];
  const mLng = 111_320 * Math.cos((center[1] * Math.PI) / 180);
  const ring: [number, number, number][] = [];
  for (let i = 0; i <= segments; i++) {
    const t = (i / segments) * Math.PI * 2;
    const e = radiusM * (Math.cos(t) * s[0] + Math.sin(t) * d[0]);
    const n = radiusM * (Math.cos(t) * s[1] + Math.sin(t) * d[1]);
    const u = radiusM * (Math.cos(t) * s[2] + Math.sin(t) * d[2]);
    ring.push([center[0] + e / mLng, center[1] + n / 111_320, center[2] + u]);
  }
  return ring;
}
