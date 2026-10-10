/**
 * Anomalías satelitales de Cholqui + malla de sondajes propuesta.
 *
 * FUENTE: capa real derivada de Sentinel-2 L2A (motor Nivel 0, lecturas STAC
 * reales) publicada en `src/data/geo/cholqui_satellite_candidates.geojson`,
 * en EPSG:4326 (CRS84) — no se reproyecta. Procedencia DERIVADO / INTERPRETADO:
 * no es evidencia verificada en terreno ni identifica mineralización.
 */
import { createServerFn } from "@tanstack/react-start";
import candidatesRaw from "@/data/geo/cholqui_satellite_candidates.geojson?raw";
import drillGridRaw from "@/data/geo/cholqui_drill_grid.geojson?raw";
import {
  parsePublishedDrillGrid,
  distanceM,
  polygonCentroid,
  totalMeters,
  type PublishedCollar,
  type SatelliteAnomaly,
} from "./drillGrid";

const CHOLQUI_CENTER = { lat: -33.8543, lng: -71.043 };

export type AnomalyRing = Array<[number, number]>;

export type CholquiAnomaly = SatelliteAnomaly & {
  /** Anillo exterior del polígono en [lng, lat], para dibujarlo en el mapa. */
  ring: AnomalyRing;
  /** Distancia al centro del distrito, en metros. */
  distanceToCenterM: number;
  /** Realce estadístico sobre el fondo del AOI. */
  zScore: number | null;
  /** Etiqueta de procedencia que viaja con el dato. */
  provenance: string;
};

export type CholquiCoverage = {
  typicalPct: number | null;
  bestCasePct: number | null;
  conclusive: boolean;
  sensor: string;
  scenesUsed: number | null;
  headline: string;
  tenureNote: string;
};

export type CholquiSatelliteTargets = {
  runDate: string;
  coverage: CholquiCoverage;
  anomalies: CholquiAnomaly[];
  collars: PublishedCollar[];
  summary: {
    anomalies: number;
    withinTenure: number;
    outsideTenure: number;
    drillable: number;
    collars: number;
    totalMeters: number;
    maxScore: number | null;
    indexes: Array<{ code: string; count: number }>;
  };
};

type RawFeature = {
  geometry?: { type?: string; coordinates?: unknown } | null;
  properties?: Record<string, unknown> | null;
};

type RawCollection = {
  metadata?: Record<string, unknown> | null;
  features?: RawFeature[];
};

const collection = JSON.parse(candidatesRaw) as RawCollection;

function str(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function numOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readCoverage(): CholquiCoverage {
  const meta = (collection.metadata ?? {}) as Record<string, unknown>;
  const cov = (meta["coverage"] ?? {}) as Record<string, unknown>;
  return {
    typicalPct: numOrNull(cov["interpretable_typical_pct"]),
    bestCasePct: numOrNull(cov["interpretable_bestcase_pct"]),
    conclusive: cov["spectral_conclusive"] === true,
    sensor: str(meta["sensor"], "Sentinel-2 L2A"),
    scenesUsed: numOrNull(meta["scenes_used"]),
    headline: str(cov["headline"], ""),
    tenureNote: str(meta["nota_espacial"], ""),
  };
}

function readAnomalies(): CholquiAnomaly[] {
  const out: CholquiAnomaly[] = [];
  const features = Array.isArray(collection.features) ? collection.features : [];
  features.forEach((f, i) => {
    const centroid = polygonCentroid(f.geometry);
    if (!centroid) return;
    const p = (f.properties ?? {}) as Record<string, unknown>;
    const ring = (
      Array.isArray(f.geometry?.coordinates) ? f.geometry?.coordinates[0] : []
    ) as AnomalyRing;
    out.push({
      id: `CHQ-SAT-${String(i + 1).padStart(2, "0")}`,
      indexCode: str(p["index_code"], "SIN_INDICE"),
      severity: str(p["severity"], "s/d"),
      score: numOrNull(p["score"]),
      areaHa: numOrNull(p["area_ha"]),
      notes: typeof p["notes"] === "string" ? (p["notes"] as string) : null,
      detectedAt: typeof p["detected_at"] === "string" ? (p["detected_at"] as string) : null,
      withinTenure: p["dentro_concesion"] === true,
      lat: centroid.lat,
      lng: centroid.lng,
      ring: Array.isArray(ring) ? ring : [],
      zScore: numOrNull(p["z_score"]),
      provenance: str(p["procedencia"], "DERIVADO / INTERPRETADO — no verificado en terreno"),
      distanceToCenterM: distanceM(
        CHOLQUI_CENTER.lat,
        CHOLQUI_CENTER.lng,
        centroid.lat,
        centroid.lng,
      ),
    });
  });
  return out.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
}

export const getCholquiSatelliteTargets = createServerFn({ method: "GET" }).handler(
  async (): Promise<CholquiSatelliteTargets> => {
    const coverage = readCoverage();
    const anomalies = readAnomalies();

    // Same published proposal as 2D/3D; do not silently regenerate it from scores.
    const collars = parsePublishedDrillGrid(JSON.parse(drillGridRaw));

    const counts = new Map<string, number>();
    for (const a of anomalies) counts.set(a.indexCode, (counts.get(a.indexCode) ?? 0) + 1);

    const dates = anomalies.map((a) => a.detectedAt).filter((d): d is string => Boolean(d));
    const scores = anomalies.map((a) => a.score).filter((s): s is number => s != null);
    const within = anomalies.filter((a) => a.withinTenure);

    return {
      runDate: dates.length ? dates.slice().sort().reverse()[0]!.slice(0, 10) : "",
      coverage,
      anomalies,
      collars,
      summary: {
        anomalies: anomalies.length,
        withinTenure: within.length,
        outsideTenure: anomalies.length - within.length,
        drillable: within.filter((a) => (a.score ?? 0) >= 0.55 && a.indexCode !== "NDVI").length,
        collars: collars.length,
        totalMeters: totalMeters(collars),
        maxScore: scores.length ? Math.max(...scores) : null,
        indexes: [...counts.entries()]
          .map(([code, count]) => ({ code, count }))
          .sort((a, b) => b.count - a.count),
      },
    };
  },
);
