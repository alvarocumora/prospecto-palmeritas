// Corte transversal A-A' — cálculo puro, compartido por todos los proyectos.
// Perfil de relieve muestreado del terreno realmente renderizado (CAD/DEM) y
// estructuras medidas que cruzan la franja, con manteo aparente en el plano.
import type { FeatureCollection, Position } from "geojson";
import type { ElevationSampler } from "./terrainDrape";
import { planeFromProperties } from "./structuralPlanes";

export type LngLat = [number, number];
const R = 6371008.8;
const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

/** Equirectangular local projection (metres) around an origin; fine below ~20 km. */
export function toLocal(origin: LngLat, p: LngLat): [number, number] {
  const k = Math.cos(rad(origin[1]));
  return [rad(p[0] - origin[0]) * R * k, rad(p[1] - origin[1]) * R];
}

export function sectionAzimuth(a: LngLat, b: LngLat): number {
  const [x, y] = toLocal(a, b);
  return (deg(Math.atan2(x, y)) + 360) % 360;
}

export function sectionLength(a: LngLat, b: LngLat): number {
  const [x, y] = toLocal(a, b);
  return Math.hypot(x, y);
}

export type ProfileSample = { d: number; z: number | null };

/** Samples terrain every `step` metres; null where no source knows the height. */
export function terrainProfile(a: LngLat, b: LngLat, sample: ElevationSampler, maxSamples = 160): ProfileSample[] {
  const len = sectionLength(a, b);
  const n = Math.max(2, Math.min(maxSamples, Math.ceil(len / 10) + 1));
  return Array.from({ length: n }, (_, i) => {
    const t = i / (n - 1);
    const z = sample(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t);
    return { d: len * t, z: z != null && Number.isFinite(z) ? z : null };
  });
}

/** True dip seen in a vertical section: tan(α) = tan(δ)·|cos(azSection − dipDir)|. */
export function apparentDip(dipDeg: number, dipDirectionDeg: number, sectionAzDeg: number): number {
  return deg(Math.atan(Math.tan(rad(dipDeg)) * Math.abs(Math.cos(rad(sectionAzDeg - dipDirectionDeg)))));
}

export type SectionStructure = {
  code: string;
  d: number;
  offset: number;
  dipDeg: number | null;
  apparentDipDeg: number | null;
  /** +1 when the plane dips toward B, −1 toward A. */
  towardB: 1 | -1 | null;
};

function segIntersect(p: [number, number], p2: [number, number], q: [number, number], q2: [number, number]) {
  const r = [p2[0] - p[0], p2[1] - p[1]];
  const s = [q2[0] - q[0], q2[1] - q[1]];
  const den = r[0] * s[1] - r[1] * s[0];
  if (Math.abs(den) < 1e-9) return null;
  const t = ((q[0] - p[0]) * s[1] - (q[1] - p[1]) * s[0]) / den;
  const u = ((q[0] - p[0]) * r[1] - (q[1] - p[1]) * r[0]) / den;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? t : null;
}

/**
 * Structures (LineString traces) crossing the section line, or whose nearest
 * vertex lies within half the corridor. Dip only when measured in the field.
 */
export function structuresInSection(
  a: LngLat,
  b: LngLat,
  structures: FeatureCollection | null | undefined,
  corridorM = 50,
): SectionStructure[] {
  if (!structures) return [];
  const len = sectionLength(a, b);
  if (len < 1) return [];
  const az = sectionAzimuth(a, b);
  const B = toLocal(a, b);
  const ux = B[0] / len;
  const uy = B[1] / len;
  const out: SectionStructure[] = [];
  for (const f of structures.features) {
    if (f.geometry?.type !== "LineString") continue;
    const pts = (f.geometry.coordinates as Position[]).map((c) => toLocal(a, [c[0], c[1]]));
    let hit: { d: number; offset: number } | null = null;
    for (let i = 1; i < pts.length && !hit; i++) {
      const t = segIntersect([0, 0], B, pts[i - 1], pts[i]);
      if (t != null) hit = { d: t * len, offset: 0 };
    }
    if (!hit) {
      for (const p of pts) {
        const along = p[0] * ux + p[1] * uy;
        const off = Math.abs(p[0] * uy - p[1] * ux);
        if (along >= 0 && along <= len && off <= corridorM / 2 && (!hit || off < hit.offset))
          hit = { d: along, offset: off };
      }
    }
    if (!hit) continue;
    const props = (f.properties ?? {}) as Record<string, unknown>;
    const plane = planeFromProperties(props);
    const app = plane ? apparentDip(plane.dipDeg, plane.dipDirectionDeg, az) : null;
    out.push({
      code: String(props.code ?? props.nombre ?? props.name ?? "Estructura"),
      d: hit.d,
      offset: hit.offset,
      dipDeg: plane?.dipDeg ?? null,
      apparentDipDeg: app,
      towardB: plane ? (Math.cos(rad(plane.dipDirectionDeg - az)) >= 0 ? 1 : -1) : null,
    });
  }
  return out.sort((x, y) => x.d - y.d);
}
