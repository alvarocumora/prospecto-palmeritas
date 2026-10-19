// Paleta analítica para capas satelitales: distingue firmas espectrales por
// mineral/índice sin alterar su procedencia (siguen siendo MODELADAS).
type RGB = [number, number, number];

const MINERAL_PALETTE: Array<[RegExp, RGB, string]> = [
  [/alunit/i, [196, 74, 160], "Alunita"],
  [/caolin|kaolin/i, [236, 196, 92], "Caolinita"],
  [/fe-?oh|clorit|chlorit/i, [62, 150, 110], "Fe-OH / clorita"],
  [/goethit|hematit|óxido|oxido|gossan|iron/i, [196, 92, 48], "Óxidos de hierro"],
  [/s[ií]lice|cuarzo|quartz|silica/i, [92, 136, 214], "Sílice (ASTER TIR)"],
  [/sericit|illit|muscovit/i, [150, 112, 200], "Sericita / illita"],
  [/carbonat|calcit/i, [120, 180, 200], "Carbonatos"],
  [/lineam/i, [40, 40, 40], "Lineamientos"],
];

export const SPECTRAL_LAYER_IDS = new Set([
  "remote_sensing.hyperspectral",
  "remote_sensing.sentinel2_alteration",
  "remote_sensing.sentinel2_processed_indices",
  "remote_sensing.anomaly_intensity",
  "remote_sensing.lineaments",
]);

export function mineralClass(name: unknown): { color: RGB; label: string } | null {
  if (typeof name !== "string") return null;
  for (const [re, color, label] of MINERAL_PALETTE) if (re.test(name)) return { color, label };
  return null;
}

/** Normalised 0..1 intensity from common score properties, or null. */
export function featureIntensity(props: Record<string, unknown> | null | undefined): number | null {
  if (!props) return null;
  for (const key of ["score", "intensity", "intensidad", "abundance", "value", "confidence"]) {
    const v = Number(props[key]);
    if (Number.isFinite(v)) return v > 1 ? Math.min(1, v / 100) : Math.max(0, v);
  }
  return null;
}

export function spectralFill(
  props: Record<string, unknown> | null | undefined,
  fallback: RGB,
): [number, number, number, number] {
  const cls = mineralClass(props?.nombre ?? props?.mineral ?? props?.label ?? props?.index);
  const intensity = featureIntensity(props);
  const c = cls?.color ?? fallback;
  return [c[0], c[1], c[2], Math.round(70 + 150 * (intensity ?? 0.5))];
}

export function legendClasses(data: unknown): Array<{ label: string; color: RGB }> {
  const features = (data as { features?: Array<{ properties?: Record<string, unknown> }> })
    ?.features;
  const out = new Map<string, RGB>();
  for (const f of features ?? []) {
    const p = f.properties;
    const cls = mineralClass(p?.nombre ?? p?.mineral ?? p?.label ?? p?.index);
    if (cls) out.set(cls.label, cls.color);
  }
  return [...out].map(([label, color]) => ({ label, color }));
}
