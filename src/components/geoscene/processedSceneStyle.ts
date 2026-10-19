import type { FeatureCollection } from "geojson";

/** Índices que entrega el pipeline Sentinel-2 L2A (sentinel2-l2a-indices-v1). */
export const PROCESSED_INDICES = [
  { key: "ironOxideRatio", label: "Óxidos de hierro (B04/B02)" },
  { key: "swirContrast", label: "Contraste SWIR (B11/B12)" },
  { key: "ndmi", label: "Humedad NDMI" },
  { key: "ndvi", label: "Vegetación NDVI" },
] as const;
export type ProcessedIndex = (typeof PROCESSED_INDICES)[number]["key"];

// Rampa perceptual (bajo → alto). deck.gl requiere RGB numérico.
const RAMP: [number, number, number][] = [
  [48, 18, 59],
  [65, 105, 225],
  [32, 178, 170],
  [180, 222, 44],
  [253, 231, 37],
  [220, 60, 30],
];

/** Rango robusto p2–p98 para que valores extremos no aplanen el contraste. */
export function indexRange(data: FeatureCollection | null, key: ProcessedIndex): [number, number] {
  const values = (data?.features ?? [])
    .map((f) => Number(f.properties?.[key]))
    .filter((v) => Number.isFinite(v) && v !== -9999)
    .sort((a, b) => a - b);
  if (!values.length) return [0, 1];
  const at = (p: number) => values[Math.min(values.length - 1, Math.floor(p * values.length))];
  const lo = at(0.02);
  const hi = at(0.98);
  return hi > lo ? [lo, hi] : [lo, lo + 1e-6];
}

export function rampColor(value: number, [lo, hi]: [number, number]): [number, number, number] {
  const t = Math.max(0, Math.min(1, (value - lo) / (hi - lo)));
  const pos = t * (RAMP.length - 1);
  const i = Math.min(RAMP.length - 2, Math.floor(pos));
  const f = pos - i;
  const a = RAMP[i];
  const b = RAMP[i + 1];
  return [0, 1, 2].map((c) => Math.round(a[c] + (b[c] - a[c]) * f)) as [number, number, number];
}

export const RAMP_CSS = `linear-gradient(to right, ${RAMP.map((c) => `rgb(${c.join(",")})`).join(",")})`;
