/**
 * Zonas de prioridad de reconocimiento (halos) de Nahuelbuta REE.
 * Une la geometría de los paños Arcillas con el ranking geomorfológico
 * reproducible (reports/nahuelbuta/2026-10-27/ranking_by_pano.csv).
 * Es INTERPRETACIÓN: prioriza terreno para muestreo; no indica ley ni TREO.
 */
import type { Feature, FeatureCollection } from "geojson";

export type PanoRank = {
  pano: string;
  mesetaPct: number;
  slopeLt5Pct: number;
  slopeMeanDeg: number;
  lineamentDensity: number;
  observabilityPct: number;
  priority: "A" | "B" | "C";
  confidence: string;
  limits: string;
};

export function parseRanking(csv: string): PanoRank[] {
  const [head, ...rows] = csv.trim().split(/\r?\n/);
  const cols = head.split(",");
  const i = (k: string) => cols.indexOf(k);
  return rows.map((r) => {
    const c = r.split(",");
    return {
      pano: c[i("pano")],
      mesetaPct: Number(c[i("meseta_pct_heredado")]),
      slopeLt5Pct: Number(c[i("slope_lt5_pct_recalc")]),
      slopeMeanDeg: Number(c[i("slope_mean_deg")]),
      lineamentDensity: Number(c[i("densidad_lineamientos_km_km2")]),
      observabilityPct: Number(c[i("observabilidad_mejor_pct")]),
      priority: c[i("prioridad_reconocimiento")] as PanoRank["priority"],
      confidence: c[i("confianza")],
      limits: c[i("factores_limitantes")],
    };
  });
}

/** Comentario técnico determinístico a partir de las métricas del paño. */
export function panoComment(r: PanoRank): string {
  const parts: string[] = [];
  if (r.slopeLt5Pct >= 15)
    parts.push(
      `${r.slopeLt5Pct.toFixed(1)} % del paño con pendiente <5°: superficie apta para retención de saprolito`,
    );
  else parts.push(`solo ${r.slopeLt5Pct.toFixed(1)} % con pendiente <5°: relieve más erosivo`);
  if (r.lineamentDensity >= 17)
    parts.push(
      `densidad de trazas alta (${r.lineamentDensity.toFixed(1)} km/km²), posible fracturamiento a verificar`,
    );
  parts.push(
    r.observabilityPct >= 15
      ? `observabilidad óptica ${r.observabilityPct.toFixed(1)} %: permite índices de arcillas`
      : `observabilidad óptica ${r.observabilityPct.toFixed(2)} %: satélite no concluyente por dosel`,
  );
  return parts.join("; ") + ".";
}

export function buildPriorityZones(
  panos: FeatureCollection,
  ranking: PanoRank[],
): FeatureCollection {
  const byName = new Map(ranking.map((r) => [r.pano, r]));
  const features: Feature[] = [];
  for (const f of panos.features) {
    const name = String((f.properties as Record<string, unknown> | null)?.pano ?? "");
    const r = byName.get(name);
    if (!r) continue;
    features.push({
      type: "Feature",
      geometry: f.geometry,
      properties: {
        nombre: `${name} · prioridad ${r.priority}`,
        prioridad: r.priority,
        meseta_pct: r.mesetaPct,
        pendiente_lt5_pct: r.slopeLt5Pct,
        densidad_trazas_km_km2: r.lineamentDensity,
        observabilidad_pct: r.observabilityPct,
        confianza: r.confidence,
        comentario: panoComment(r),
        advertencia: "Prioridad de reconocimiento geomorfológico; no mide REE ni TREO.",
      },
    });
  }
  return { type: "FeatureCollection", features };
}

export function summarizeZones(ranking: PanoRank[]) {
  const by = (p: PanoRank["priority"]) =>
    ranking.filter((r) => r.priority === p).map((r) => r.pano);
  return { A: by("A"), B: by("B"), C: by("C") };
}
