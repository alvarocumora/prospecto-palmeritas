// Geometría de sondajes: desurvey por mínima curvatura y muestreo por
// profundidad medida (MD). Coordenadas locales: x = este (m), y = norte (m),
// z = elevación (m, crece hacia arriba). Dip negativo = hacia abajo.

export type TrajectoryPoint = { md: number; x: number; y: number; z: number };
export type SurveyShot = { md: number; azimuth: number; dip: number };

const RAD = Math.PI / 180;

function direction(azimuth: number, dip: number): [number, number, number] {
  const a = azimuth * RAD;
  const d = dip * RAD;
  return [Math.cos(d) * Math.sin(a), Math.cos(d) * Math.cos(a), Math.sin(d)];
}

/** Desplazamiento (dx, dy, dz) entre dos estaciones por mínima curvatura. */
export function minCurvatureStep(a: SurveyShot, b: SurveyShot): [number, number, number] {
  const len = b.md - a.md;
  if (len <= 0) return [0, 0, 0];
  const t1 = direction(a.azimuth, a.dip);
  const t2 = direction(b.azimuth, b.dip);
  const dot = Math.max(-1, Math.min(1, t1[0] * t2[0] + t1[1] * t2[1] + t1[2] * t2[2]));
  const dogleg = Math.acos(dot);
  const rf = dogleg < 1e-9 ? 1 : (2 / dogleg) * Math.tan(dogleg / 2);
  const h = (len / 2) * rf;
  return [h * (t1[0] + t2[0]), h * (t1[1] + t2[1]), h * (t1[2] + t2[2])];
}

/** Trayectoria completa desde el collar; con un solo shot se extiende recto hasta totalDepth. */
export function desurvey(
  collar: { x: number; y: number; z: number },
  shots: SurveyShot[],
  totalDepth?: number,
): TrajectoryPoint[] {
  const sorted = [...shots].filter((s) => Number.isFinite(s.md)).sort((p, q) => p.md - q.md);
  if (!sorted.length) return [];
  if (sorted[0].md > 0) sorted.unshift({ ...sorted[0], md: 0 });
  const last = sorted[sorted.length - 1];
  if (totalDepth != null && totalDepth > last.md) sorted.push({ ...last, md: totalDepth });
  const out: TrajectoryPoint[] = [{ md: 0, ...collar }];
  let { x, y, z } = collar;
  for (let i = 1; i < sorted.length; i++) {
    const [dx, dy, dz] = minCurvatureStep(sorted[i - 1], sorted[i]);
    if (sorted[i].md <= sorted[i - 1].md) continue;
    x += dx;
    y += dy;
    z += dz;
    out.push({ md: sorted[i].md, x, y, z });
  }
  return out;
}

/** Posición interpolada a una MD; null si cae fuera del tramo perforado. */
export function pointAtDepth(points: TrajectoryPoint[], md: number): TrajectoryPoint | null {
  if (points.length < 2 || md < points[0].md || md > points[points.length - 1].md) return null;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    if (md <= b.md) {
      const t = b.md === a.md ? 0 : (md - a.md) / (b.md - a.md);
      return { md, x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t };
    }
  }
  return null;
}

/** Tramo de la trayectoria entre dos MD, siguiendo la curvatura. */
export function sliceByDepth(
  points: TrajectoryPoint[],
  from: number,
  to: number,
): TrajectoryPoint[] {
  const start = pointAtDepth(points, from);
  const end = pointAtDepth(points, to);
  if (!start || !end || to <= from) return [];
  return [start, ...points.filter((p) => p.md > from && p.md < to), end];
}

/** Proyección sobre una sección vertical (s a lo largo del rumbo, d perpendicular). */
export function projectToSection(
  p: { x: number; y: number; z: number },
  origin: { x: number; y: number },
  azimuth: number,
): { s: number; d: number; z: number } {
  const sx = Math.sin(azimuth * RAD);
  const sy = Math.cos(azimuth * RAD);
  const dx = p.x - origin.x;
  const dy = p.y - origin.y;
  return { s: dx * sx + dy * sy, d: dx * -sy + dy * sx, z: p.z };
}
