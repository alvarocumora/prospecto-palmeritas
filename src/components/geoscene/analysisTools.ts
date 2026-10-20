// Herramientas de análisis del visor global: filtro espectral por percentil,
// paleta de visualización de unidades, medición y red estereográfica.
// Todo es cálculo sobre datos existentes; no se crean observaciones nuevas.
import type { FeatureCollection } from "geojson";
import { featureIntensity, mineralClass } from "./spectralStyle";
import type { StructurePlane } from "./structuralPlanes";

export type SpectralTop = "all" | "p90" | "p95";

/** Mantiene solo el percentil superior de intensidad por mineral; óxidos opcionales. */
export function filterSpectral(
  fc: FeatureCollection,
  top: SpectralTop,
  includeOxides: boolean,
): FeatureCollection {
  const groups = new Map<string, typeof fc.features>();
  for (const f of fc.features) {
    const p = f.properties ?? {};
    const label = mineralClass(p.nombre ?? p.mineral ?? p.label)?.label ?? "otros";
    if (!includeOxides && label === "Óxidos de hierro") continue;
    const list = groups.get(label) ?? [];
    list.push(f);
    groups.set(label, list);
  }
  if (top === "all") return { ...fc, features: [...groups.values()].flat() };
  const q = top === "p95" ? 0.95 : 0.9;
  const out: typeof fc.features = [];
  for (const list of groups.values()) {
    const values = list
      .map((f) => featureIntensity(f.properties))
      .filter((v): v is number => v != null)
      .sort((a, b) => a - b);
    // Sin intensidad no hay percentil que calcular: se conserva tal cual.
    if (!values.length) {
      out.push(...list);
      continue;
    }
    const cut = values[Math.min(values.length - 1, Math.floor(q * values.length))];
    for (const f of list) {
      const v = featureIntensity(f.properties);
      if (v != null && v >= cut) out.push(f);
    }
  }
  return { ...fc, features: out };
}

/** Color determinístico por código de unidad (paleta de visualización, no la oficial impresa). */
const UNIT_PALETTE: [number, number, number][] = [
  [196, 160, 110],
  [150, 178, 120],
  [190, 120, 120],
  [130, 150, 190],
  [200, 180, 90],
  [160, 130, 180],
  [120, 170, 160],
  [210, 140, 90],
  [150, 150, 150],
  [180, 200, 140],
];
export function unitColor(code: unknown): [number, number, number] {
  const s = String(code ?? "");
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return UNIT_PALETTE[Math.abs(h) % UNIT_PALETTE.length];
}

type LngLat = [number, number];
const R = 6_371_008.8;
const rad = (d: number) => (d * Math.PI) / 180;

export function haversine(a: LngLat, b: LngLat): number {
  const dLat = rad(b[1] - a[1]);
  const dLng = rad(b[0] - a[0]);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function pathLength(points: LngLat[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += haversine(points[i - 1], points[i]);
  return total;
}

/** Área plana (m²) en proyección local equirectangular; adecuada para escala de proyecto. */
export function polygonArea(points: LngLat[]): number {
  if (points.length < 3) return 0;
  const lat0 = rad(points.reduce((s, p) => s + p[1], 0) / points.length);
  const xy = points.map(([lng, lat]) => [R * rad(lng) * Math.cos(lat0), R * rad(lat)]);
  let a = 0;
  for (let i = 0; i < xy.length; i++) {
    const [x1, y1] = xy[i];
    const [x2, y2] = xy[(i + 1) % xy.length];
    a += x1 * y2 - x2 * y1;
  }
  return Math.abs(a) / 2;
}

/** Polo de un plano en red de Schmidt (igual área, hemisferio inferior), radio unitario. */
export function schmidtPole(plane: StructurePlane): { x: number; y: number } {
  const trend = rad((plane.dipDirectionDeg + 180) % 360);
  const plunge = rad(90 - plane.dipDeg);
  const r = Math.SQRT2 * Math.sin((Math.PI / 2 - plunge) / 2);
  return { x: r * Math.sin(trend), y: r * Math.cos(trend) };
}

type Ring = number[][];
function inRing(pt: LngLat, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > pt[1] !== yj > pt[1] && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi)
      inside = !inside;
  }
  return inside;
}
function polygons(g: GeoJSON.Geometry | null): Ring[][] {
  if (!g) return [];
  if (g.type === "Polygon") return [g.coordinates];
  if (g.type === "MultiPolygon") return g.coordinates;
  return [];
}
function lines(g: GeoJSON.Geometry | null): number[][][] {
  if (!g) return [];
  if (g.type === "LineString") return [g.coordinates];
  if (g.type === "MultiLineString") return g.coordinates;
  return [];
}
function segT(a: LngLat, b: LngLat, c: number[], d: number[]): number | null {
  const r = [b[0] - a[0], b[1] - a[1]];
  const s = [d[0] - c[0], d[1] - c[1]];
  const den = r[0] * s[1] - r[1] * s[0];
  if (Math.abs(den) < 1e-15) return null;
  const t = ((c[0] - a[0]) * s[1] - (c[1] - a[1]) * s[0]) / den;
  const u = ((c[0] - a[0]) * r[1] - (c[1] - a[1]) * r[0]) / den;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? t : null;
}

export type SectionUnit = { d0: number; d1: number; code: string; nombre: string };
export type SectionFault = { d: number; nombre: string };

/** Unidades oficiales bajo la traza A–A′ (superficie) y fallas oficiales que la cruzan. */
export function sectionGeology(
  a: LngLat,
  b: LngLat,
  units: FeatureCollection | undefined,
  faults: FeatureCollection | undefined,
  samples = 120,
): { units: SectionUnit[]; faults: SectionFault[] } {
  const len = haversine(a, b);
  const out: SectionUnit[] = [];
  if (units?.features.length) {
    for (let i = 0; i < samples; i++) {
      const t = (i + 0.5) / samples;
      const p: LngLat = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
      const f = units.features.find((u) =>
        polygons(u.geometry).some(
          (poly) => inRing(p, poly[0]) && !poly.slice(1).some((h) => inRing(p, h)),
        ),
      );
      if (!f) continue;
      const code = String(f.properties?.codigo ?? f.properties?.nombre ?? "?");
      const d0 = (len * i) / samples;
      const d1 = (len * (i + 1)) / samples;
      const last = out[out.length - 1];
      if (last && last.code === code && Math.abs(last.d1 - d0) < 1e-6) last.d1 = d1;
      else out.push({ d0, d1, code, nombre: String(f.properties?.nombre ?? code) });
    }
  }
  const fx: SectionFault[] = [];
  for (const f of faults?.features ?? []) {
    for (const line of lines(f.geometry)) {
      for (let i = 1; i < line.length; i++) {
        const t = segT(a, b, line[i - 1], line[i]);
        if (t != null) fx.push({ d: t * len, nombre: String(f.properties?.nombre ?? "Falla") });
      }
    }
  }
  return { units: out, faults: fx.sort((x, y) => x.d - y.d) };
}
