import raw from "@/data/geo/tilama/geochem_core.json";

/** Muestra del CSV CORE del paquete GeoAI Tilama (UTM WGS84 19S, EPSG:32719). */
export type TilamaSample = {
  Muestra: string;
  Este_UTM: number;
  Norte_UTM: number;
  Cu_ppm: number | null;
  Mo_ppm: number | null;
  Pb_ppm: number | null;
  Zn_ppm: number | null;
  Ag_ppm: number | null;
  As_ppm: number | null;
  Au_ppb: number | null;
  Fe_pct: number | null;
  Observaciones: string | null;
};

export const TILAMA_SAMPLES = raw as TilamaSample[];
export const TILAMA_SOURCE =
  "Paquete GeoAI Tilama · CSV CORE (190 muestras superficiales, 2022) · ensayes puntuales, no recurso";

/** Cu > 50.000 ppm (5 %) exige re-ensaye y revisión del tipo de muestra. */
export const CU_REASSAY_PPM = 50_000;

export function qaFlags(s: TilamaSample): string[] {
  const flags: string[] = [];
  if ((s.Cu_ppm ?? 0) > CU_REASSAY_PPM) flags.push("RE-ENSAYE / VALIDAR TIPO DE MUESTRA");
  if (s.Fe_pct != null) flags.push("Fe: unidad/escala no verificada");
  return flags;
}

export function cuThresholdCounts(samples: TilamaSample[] = TILAMA_SAMPLES) {
  const pct = samples.map((s) => (s.Cu_ppm ?? 0) / 10_000);
  return [0.5, 1, 2, 5].map((t) => ({ threshold: t, count: pct.filter((v) => v > t).length }));
}

export function topBy(
  key: "Cu_ppm" | "Mo_ppm" | "Ag_ppm" | "As_ppm",
  n = 10,
  samples: TilamaSample[] = TILAMA_SAMPLES,
) {
  return [...samples]
    .filter((s) => s[key] != null)
    .sort((a, b) => (b[key] as number) - (a[key] as number))
    .slice(0, n);
}

export function median(values: number[]): number | null {
  const v = values.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return null;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

/** Propiedades multielemento para enriquecer un punto de muestreo por código. */
const byCode = new Map(TILAMA_SAMPLES.map((s) => [s.Muestra.trim().toUpperCase(), s]));
export function multiElementProps(code: unknown): Record<string, string | number | null> | null {
  const s = byCode.get(String(code ?? "").trim().toUpperCase());
  if (!s) return null;
  const flags = qaFlags(s);
  return {
    mo_ppm: s.Mo_ppm,
    as_ppm: s.As_ppm,
    pb_ppm: s.Pb_ppm,
    zn_ppm: s.Zn_ppm,
    au_ppb: s.Au_ppb,
    observaciones: s.Observaciones,
    qa_qc: flags.length ? flags.join(" · ") : null,
  };
}
