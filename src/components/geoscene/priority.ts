/**
 * Prioridad de exploración universal para todos los visores GeoScene3D.
 * Normaliza los distintos esquemas de cada proyecto (A/B/C, P1–P3,
 * alta/media/baja) a P1/P2/P3 y calcula superficie de polígonos.
 * Es una clasificación INTERPRETADA para ordenar trabajo de terreno:
 * nunca indica ley, tonelaje ni recurso.
 */
import type { Feature, FeatureCollection, Geometry } from "geojson";

export type ExplorationPriority = "P1" | "P2" | "P3";
export const PRIORITIES: readonly ExplorationPriority[] = ["P1", "P2", "P3"];
export const PRIORITY_LABEL: Record<ExplorationPriority, string> = {
  P1: "Alta",
  P2: "Media",
  P3: "Baja",
};
const KEYS = ["prioridad", "priority", "prioridad_reconocimiento", "tier", "clase"];

export function normalizePriority(
  props: Record<string, unknown> | null | undefined,
): ExplorationPriority | null {
  if (!props) return null;
  for (const k of KEYS) {
    const raw = props[k];
    if (raw == null || raw === "") continue;
    const v = String(raw).trim().toUpperCase();
    if (["A", "P1", "1", "ALTA", "HIGH"].includes(v)) return "P1";
    if (["B", "P2", "2", "MEDIA", "MEDIUM"].includes(v)) return "P2";
    if (["C", "P3", "3", "BAJA", "LOW"].includes(v)) return "P3";
  }
  return null;
}

const R = 6378137;
const rad = (d: number) => (d * Math.PI) / 180;
function ringArea(ring: number[][]): number {
  let a = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[i + 1];
    a += rad(x2 - x1) * (2 + Math.sin(rad(y1)) + Math.sin(rad(y2)));
  }
  return Math.abs((a * R * R) / 2);
}

/** Superficie geodésica aproximada en hectáreas (0 para puntos y líneas). */
export function geometryHectares(g: Geometry | null | undefined): number {
  if (!g) return 0;
  const poly = (rings: number[][][]) =>
    rings.length ? ringArea(rings[0]) - rings.slice(1).reduce((s, r) => s + ringArea(r), 0) : 0;
  if (g.type === "Polygon") return poly(g.coordinates as number[][][]) / 10_000;
  if (g.type === "MultiPolygon")
    return (g.coordinates as number[][][][]).reduce((s, p) => s + poly(p), 0) / 10_000;
  return 0;
}

export type PriorityStats = Record<ExplorationPriority, { count: number; ha: number }>;

export function priorityStats(fc: FeatureCollection | undefined): PriorityStats {
  const s: PriorityStats = { P1: { count: 0, ha: 0 }, P2: { count: 0, ha: 0 }, P3: { count: 0, ha: 0 } };
  for (const f of fc?.features ?? []) {
    const p = normalizePriority(f.properties as Record<string, unknown>);
    if (!p) continue;
    s[p].count++;
    s[p].ha += geometryHectares(f.geometry);
  }
  return s;
}

/** Filtra por prioridades activas; los elementos sin prioridad se conservan. */
export function filterByPriority(
  fc: FeatureCollection,
  active: ReadonlySet<ExplorationPriority>,
): FeatureCollection {
  if (active.size === PRIORITIES.length) return fc;
  return {
    ...fc,
    features: fc.features.filter((f: Feature) => {
      const p = normalizePriority(f.properties as Record<string, unknown>);
      return !p || active.has(p);
    }),
  };
}

/** Programa de muestreo sugerido (malla regular): propuesta, no resultado. */
export function suggestedSamplePoints(ha: number, gridM = 200): number {
  if (ha <= 0) return 0;
  return Math.ceil((ha * 10_000) / (gridM * gridM));
}
