// Herramientas de análisis del visor global: filtro espectral por percentil,
// paleta de visualización de unidades, medición y red estereográfica.
// Todo es cálculo sobre datos existentes; no se crean observaciones nuevas.
import type { FeatureCollection } from "geojson";
import { featureIntensity, mineralClass } from "./spectralStyle";
import type { StructurePlane } from "./structuralPlanes";

export type SpectralTop = "all" | "p90" | "p95";

/** Mantiene solo el percentil superior de intensidad por mineral; óxidos opcionales. */
export function filterSpectral(fc: FeatureCollection, top: SpectralTop, includeOxides: boolean): FeatureCollection {
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
    const values = list.map((f) => featureIntensity(f.properties)).filter((v): v is number => v != null).sort((a, b) => a - b);
    // Sin intensidad no hay percentil que calcular: se conserva tal cual.
    if (!values.length) { out.push(...list); continue; }
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
  [196, 160, 110], [150, 178, 120], [190, 120, 120], [130, 150, 190], [200, 180, 90],
  [160, 130, 180], [120, 170, 160], [210, 140, 90], [150, 150, 150], [180, 200, 140],
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
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLng / 2) ** 2;
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
