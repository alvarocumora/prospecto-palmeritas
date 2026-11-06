// Rampa de color por ley para muestras de geoquímica (estándar tipo Leapfrog):
// clasifica cada punto por Cu % o Mo ppm en vez de un color fijo por evidencia,
// para que un cutoff de ley revele dónde se concentra la mineralización.
export type GradeCommodity = "cu_pct" | "mo_ppm";

export type GradeBreak = {
  min: number;
  label: string;
  color: readonly [number, number, number];
};

const NO_DATA_COLOR: readonly [number, number, number] = [100, 116, 139];

export const CU_PCT_BREAKS: readonly GradeBreak[] = [
  { min: 0, label: "< 0,2% Cu", color: [148, 163, 184] },
  { min: 0.2, label: "0,2–0,5% Cu", color: [34, 197, 94] },
  { min: 0.5, label: "0,5–1,0% Cu", color: [234, 179, 8] },
  { min: 1.0, label: "> 1,0% Cu", color: [220, 38, 38] },
];

export const MO_PPM_BREAKS: readonly GradeBreak[] = [
  { min: 0, label: "< 50 ppm Mo", color: [148, 163, 184] },
  { min: 50, label: "50–150 ppm Mo", color: [34, 197, 94] },
  { min: 150, label: "150–500 ppm Mo", color: [234, 179, 8] },
  { min: 500, label: "> 500 ppm Mo", color: [220, 38, 38] },
];

export const GRADE_COMMODITY_LABEL: Record<GradeCommodity, string> = {
  cu_pct: "Cu %",
  mo_ppm: "Mo ppm",
};

/** Corte de referencia (slider) por defecto para cada commodity. */
export const GRADE_CUTOFF_DEFAULT: Record<GradeCommodity, { max: number; step: number }> = {
  cu_pct: { max: 2, step: 0.05 },
  mo_ppm: { max: 1000, step: 10 },
};

export function gradeBreaksFor(commodity: GradeCommodity): readonly GradeBreak[] {
  return commodity === "cu_pct" ? CU_PCT_BREAKS : MO_PPM_BREAKS;
}

export function gradeValue(
  properties: Record<string, unknown> | null | undefined,
  commodity: GradeCommodity,
): number | null {
  const raw = properties?.[commodity];
  return typeof raw === "number" && Number.isFinite(raw) ? raw : null;
}

export function gradeColorFor(
  value: number | null,
  commodity: GradeCommodity,
): readonly [number, number, number] {
  if (value == null) return NO_DATA_COLOR;
  const breaks = gradeBreaksFor(commodity);
  let color = breaks[0].color;
  for (const b of breaks) if (value >= b.min) color = b.color;
  return color;
}

export type GradeLegendEntry = {
  label: string;
  color: readonly [number, number, number];
  count: number;
};

/** Distribución por tramo de ley, sobre el total de muestras (no sobre el cutoff aplicado). */
export function gradeLegendCounts(
  features: readonly { properties?: Record<string, unknown> | null }[],
  commodity: GradeCommodity,
): GradeLegendEntry[] {
  const breaks = gradeBreaksFor(commodity);
  const counts = breaks.map(() => 0);
  let noData = 0;
  for (const f of features) {
    const v = gradeValue(f.properties, commodity);
    if (v == null) {
      noData++;
      continue;
    }
    let idx = 0;
    for (let i = 0; i < breaks.length; i++) if (v >= breaks[i].min) idx = i;
    counts[idx]++;
  }
  return [
    ...breaks.map((b, i) => ({ label: b.label, color: b.color, count: counts[i] })),
    ...(noData ? [{ label: "Sin dato", color: NO_DATA_COLOR, count: noData }] : []),
  ];
}
