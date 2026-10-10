/**
 * Malla de sondajes propuesta para Cholqui a partir de anomalías satelitales.
 *
 * REGLA DE PROCEDENCIA: una anomalía espectral es un INDICIO (DERIVADO), no
 * mineralización. La malla que se deriva aquí es una PROPUESTA DE EXPLORACIÓN
 * (CONCEPTUAL): no es un programa comprometido, no estima recursos ni reservas
 * y debe validarse con topografía, mapeo estructural y permisos antes de
 * ejecutarse. El cálculo es determinista: la misma entrada produce la misma
 * malla, sin números aleatorios ni datos sintéticos.
 */

export type SatelliteAnomaly = {
  id: string;
  indexCode: string;
  severity: string;
  score: number | null;
  areaHa: number | null;
  notes: string | null;
  detectedAt: string | null;
  lat: number;
  lng: number;
  /**
   * La anomalía cae dentro de las concesiones conocidas del proyecto. Sólo
   * estas generan collar: no se propone perforación fuera de la tenencia.
   */
  withinTenure?: boolean;
};

export type ProposedCollar = {
  code: string;
  anomalyId: string;
  indexCode: string;
  lat: number;
  lng: number;
  /** Azimut de perforación en grados desde el norte. */
  azimuthDeg: number;
  /** Inclinación negativa desde la horizontal. */
  dipDeg: number;
  depthM: number;
  priority: "Alta" | "Media" | "Baja";
  objective: string;
  score: number;
};

/** Rumbos estructurales documentados en el prospecto (grados desde el norte). */
export const CHOLQUI_STRIKES_DEG = [350, 20, 352, 45, 15, 55, 50, 295, 250] as const;

/** Rumbo dominante del distrito: manto y vetas de La Maza (N20E / N10W). */
export const DOMINANT_STRIKE_DEG = 20;

export const INDEX_LABEL: Record<string, string> = {
  IRON_OXIDE: "Óxidos de hierro (razón B4/B2)",
  CLAY_MINERALS: "Arcillas / Al-OH (razón SWIR B11/B12)",
  HYDROTHERMAL_ALTERATION: "Alteración hidrotermal combinada",
  STRUCTURAL_LINEAMENTS: "Lineamientos estructurales",
  HISTORICAL_CHANGE: "Cambio histórico de superficie",
  NDVI: "Cobertura vegetal (NDVI)",
};

const OBJECTIVE: Record<string, string> = {
  IRON_OXIDE:
    "Verificar gossan / halo de óxidos y su continuidad en profundidad bajo la zona lixiviada",
  CLAY_MINERALS: "Cortar el halo argílico-sericítico y definir su relación con la estructura",
  HYDROTHERMAL_ALTERATION: "Interceptar el núcleo alterado y su zonación vertical",
  STRUCTURAL_LINEAMENTS: "Cortar la estructura interpretada en ángulo y medir su potencia real",
  HISTORICAL_CHANGE: "Chequear labores antiguas y su relación con la mineralización",
  NDVI: "Control de cobertura: no se propone sondaje",
};

/** Índices que no justifican una plataforma de sondaje por sí solos. */
const NON_DRILLABLE = new Set(["NDVI"]);

/** Puntaje mínimo para proponer una plataforma. */
export const MIN_SCORE = 0.55;

/** Máximo de plataformas de la fase 1 propuesta. */
export const MAX_COLLARS = 8;

export function indexLabel(code: string): string {
  return INDEX_LABEL[code] ?? code;
}

/** Centroide simple del anillo exterior de un polígono GeoJSON. */
export function polygonCentroid(geometry: unknown): { lat: number; lng: number } | null {
  const g = geometry as { type?: string; coordinates?: unknown } | null;
  if (!g || g.type !== "Polygon" || !Array.isArray(g.coordinates)) return null;
  const ring = g.coordinates[0] as unknown;
  if (!Array.isArray(ring) || ring.length === 0) return null;
  let sx = 0;
  let sy = 0;
  let n = 0;
  for (const pair of ring as Array<[number, number]>) {
    if (!Array.isArray(pair) || pair.length < 2) continue;
    const [lng, lat] = pair;
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue;
    sx += lng;
    sy += lat;
    n += 1;
  }
  if (n === 0) return null;
  return { lat: sy / n, lng: sx / n };
}

/** Distancia en metros entre dos coordenadas WGS84 (haversine). */
export function distanceM(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6_371_000;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

function priorityOf(score: number): ProposedCollar["priority"] {
  if (score >= 0.85) return "Alta";
  if (score >= 0.7) return "Media";
  return "Baja";
}

/** Rumbo (bearing) de un punto hacia otro, en grados desde el norte. */
export function bearingDeg(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const dx = (bLng - aLng) * Math.cos((((aLat + bLat) / 2) * Math.PI) / 180);
  const dy = bLat - aLat;
  const deg = (Math.atan2(dx, dy) * 180) / Math.PI;
  return (deg + 360) % 360;
}

function angularGap(a: number, b: number): number {
  const d = Math.abs(((a - b + 540) % 360) - 180);
  return d;
}

/**
 * Perforar en ángulo a la estructura: el azimut es perpendicular al rumbo
 * dominante (N20E). De las dos perpendiculares posibles se elige la que
 * apunta hacia el eje del distrito, para cortar el cuerpo interpretado y no
 * seguirlo.
 */
function azimuthFor(lat: number, lng: number, center: { lat: number; lng: number }): number {
  const perpendicular = (DOMINANT_STRIKE_DEG + 90) % 360; // 110 grados
  const opposite = (perpendicular + 180) % 360; // 290 grados
  const toCenter = bearingDeg(lat, lng, center.lat, center.lng);
  return angularGap(perpendicular, toCenter) <= angularGap(opposite, toCenter)
    ? perpendicular
    : opposite;
}

/** Profundidad propuesta: 120 m base más el realce por puntaje, en tramos de 10 m. */
function depthFor(score: number): number {
  const raw = 120 + score * 100;
  return Math.min(220, Math.max(120, Math.round(raw / 10) * 10));
}

export function buildDrillGrid(
  anomalies: SatelliteAnomaly[],
  center: { lat: number; lng: number },
  opts: { maxCollars?: number; minScore?: number } = {},
): ProposedCollar[] {
  const maxCollars = opts.maxCollars ?? MAX_COLLARS;
  const minScore = opts.minScore ?? MIN_SCORE;

  return (
    anomalies
      .filter((a) => !NON_DRILLABLE.has(a.indexCode))
      // Guarda legal: nunca se propone perforación fuera de la tenencia conocida.
      .filter((a) => a.withinTenure !== false)
      .filter((a) => (a.score ?? 0) >= minScore)
      .slice()
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0) || a.id.localeCompare(b.id))
      .slice(0, maxCollars)
      .map((a, i) => {
        const score = a.score ?? 0;
        return {
          code: `CHQ-DDH-${String(i + 1).padStart(2, "0")}`,
          anomalyId: a.id,
          indexCode: a.indexCode,
          lat: a.lat,
          lng: a.lng,
          azimuthDeg: azimuthFor(a.lat, a.lng, center),
          dipDeg: -60,
          depthM: depthFor(score),
          priority: priorityOf(score),
          objective: OBJECTIVE[a.indexCode] ?? "Verificar la anomalía en profundidad",
          score,
        };
      })
  );
}

export function totalMeters(collars: ProposedCollar[]): number {
  return collars.reduce((sum, c) => sum + c.depthM, 0);
}

/** The published file provides no anomaly IDs; preserve that absence explicitly. */
export type PublishedCollar = Omit<ProposedCollar, "anomalyId"> & { anomalyId: null };

export function parsePublishedDrillGrid(raw: unknown): PublishedCollar[] {
  if (!raw || typeof raw !== "object") throw new Error("PUBLISHED_DRILL_GRID_INVALID");
  const features = (raw as { features?: unknown }).features;
  if (!Array.isArray(features)) throw new Error("PUBLISHED_DRILL_GRID_INVALID");
  const codes = new Set<string>();
  return features.map((feature: unknown) => {
    const f = feature as {
      geometry?: { type?: string; coordinates?: unknown };
      properties?: Record<string, unknown>;
    } | null;
    const p = f?.properties;
    const coords = f?.geometry?.coordinates;
    if (f?.geometry?.type !== "Point" || !Array.isArray(coords) || !p ||
        typeof p.code !== "string" || !p.code.trim() || codes.has(p.code) ||
        typeof p.index_code !== "string" ||
        ![coords[0], coords[1], p.azimuth_deg, p.dip_deg, p.depth_m, p.score].every(
          (value) => typeof value === "number" && Number.isFinite(value),
        )) throw new Error("PUBLISHED_DRILL_COLLAR_INVALID");
    const [lng, lat] = coords as number[];
    const azimuthDeg = p.azimuth_deg as number;
    const dipDeg = p.dip_deg as number;
    const depthM = p.depth_m as number;
    const score = p.score as number;
    if (Math.abs(lng) > 180 || Math.abs(lat) >= 90 || azimuthDeg < 0 ||
        azimuthDeg >= 360 || dipDeg > 0 || dipDeg < -90 || depthM <= 0 ||
        score < 0 || score > 1 ||
        !["Alta", "Media", "Baja"].includes(String(p.priority))) {
      throw new Error("PUBLISHED_DRILL_COLLAR_INVALID");
    }
    codes.add(p.code);
    return {
      code: p.code, anomalyId: null, indexCode: p.index_code,
      lat, lng, azimuthDeg, dipDeg, depthM, score,
      priority: p.priority as ProposedCollar["priority"],
      objective: typeof p.objetivo === "string"
        ? p.objetivo : "Objetivo no informado en la propuesta publicada",
    };
  });
}
