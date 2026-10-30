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
  /** Null when the published source has no explicit anomaly link. */
  anomalyId: string | null;
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

/**
 * Configuración por proyecto para proponer una malla de sondaje. El rumbo
 * dominante solo aplica a mineralización tabular (vetas/mantos): perforar
 * perpendicular a la estructura solo tiene sentido ahí. Para depósitos sin
 * control estructural dominante (p. ej. arcillas lateríticas/REE) este
 * modelo NO corresponde — ver advertencia en `buildDrillGrid`.
 */
export type ProjectDrillConfig = {
  /** Prefijo del código de collar, p. ej. "CHQ-DDH". */
  codePrefix: string;
  /** Rumbo dominante de la estructura objetivo (grados desde el norte). */
  dominantStrikeDeg: number;
};

export const CHOLQUI_DRILL_CONFIG: ProjectDrillConfig = {
  codePrefix: "CHQ-DDH",
  dominantStrikeDeg: DOMINANT_STRIKE_DEG,
};

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
function azimuthFor(
  lat: number,
  lng: number,
  center: { lat: number; lng: number },
  dominantStrikeDeg: number,
): number {
  const perpendicular = (dominantStrikeDeg + 90) % 360;
  const opposite = (perpendicular + 180) % 360;
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
  opts: { maxCollars?: number; minScore?: number; project?: ProjectDrillConfig } = {},
): ProposedCollar[] {
  const maxCollars = opts.maxCollars ?? MAX_COLLARS;
  const minScore = opts.minScore ?? MIN_SCORE;
  const project = opts.project ?? CHOLQUI_DRILL_CONFIG;

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
          code: `${project.codePrefix}-${String(i + 1).padStart(2, "0")}`,
          anomalyId: a.id,
          indexCode: a.indexCode,
          lat: a.lat,
          lng: a.lng,
          azimuthDeg: azimuthFor(a.lat, a.lng, center, project.dominantStrikeDeg),
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

/**
 * Rumbo dominante (grados desde el norte, 0-180) de un set de vetas medidas,
 * como promedio circular de líneas (no vectores): un rumbo de 10° y uno de
 * 190° son la misma línea, así que se dobla el ángulo antes de promediar.
 * Devuelve null si no hay rumbos medidos — nunca se asume un rumbo.
 */
export function dominantStrikeFromVeins(
  veins: Array<{ strike_deg: number | null }>,
): number | null {
  const angles = veins.map((v) => v.strike_deg).filter((d): d is number => d != null);
  if (!angles.length) return null;
  let sumSin = 0;
  let sumCos = 0;
  for (const deg of angles) {
    const rad = (deg * 2 * Math.PI) / 180;
    sumSin += Math.sin(rad);
    sumCos += Math.cos(rad);
  }
  const meanDeg = (Math.atan2(sumSin, sumCos) * 180) / Math.PI / 2;
  return ((meanDeg % 180) + 180) % 180;
}

/** A proposable point with its own evidence (target, not a spectral index). */
export type DrillTargetCandidate = {
  id: string;
  lat: number;
  lng: number;
  /** 0-100 scale, as stored in `exploration_targets.score`. */
  score: number;
  objective: string;
  withinTenure?: boolean;
};

/**
 * Same proposal logic as `buildDrillGrid`, but for real exploration targets
 * (DB-backed, with their own rationale) instead of spectral-index anomalies.
 * `score` is 0-100 here, not 0-1, so it is normalized before reusing the
 * shared depth/priority curve.
 */
export function buildDrillGridFromTargets(
  targets: DrillTargetCandidate[],
  center: { lat: number; lng: number },
  project: ProjectDrillConfig,
  opts: { maxCollars?: number; minScorePct?: number } = {},
): ProposedCollar[] {
  const maxCollars = opts.maxCollars ?? MAX_COLLARS;
  const minScorePct = opts.minScorePct ?? MIN_SCORE * 100;

  return targets
    .filter((t) => t.withinTenure !== false)
    .filter((t) => t.score >= minScorePct)
    .slice()
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
    .slice(0, maxCollars)
    .map((t, i) => {
      const score = Math.min(1, Math.max(0, t.score / 100));
      return {
        code: `${project.codePrefix}-${String(i + 1).padStart(2, "0")}`,
        anomalyId: t.id,
        indexCode: "TARGET",
        lat: t.lat,
        lng: t.lng,
        azimuthDeg: azimuthFor(t.lat, t.lng, center, project.dominantStrikeDeg),
        dipDeg: -60,
        depthM: depthFor(score),
        priority: priorityOf(score),
        objective: t.objective,
        score,
      };
    });
}

// ============ Selección geoestadística (variograma + ganancia de información) ============
//
// Alternativa a "ordenar por puntaje y tomar los N mejores": prioriza también
// targets lejos de sondajes ya ejecutados (ganancia de información real, vía
// varianza de kriging aproximada con un variograma esférico ajustado a los
// puntajes medidos). Igual que el resto de este archivo, es determinista: la
// geometría final (azimut/profundidad/prioridad) sale de azimuthFor/depthFor/
// priorityOf — nunca de un número aleatorio.

export type VariogramModel = { nugget: number; sill: number; range: number };

/** Proyección equirectangular local (metros) centrada en el promedio de los puntos. */
function toLocalMeters(lat: number, lng: number, refLat: number): { x: number; y: number } {
  return {
    x: lng * 111_320 * Math.cos((refLat * Math.PI) / 180),
    y: lat * 110_540,
  };
}

/** Variograma experimental: semivarianza promedio por bins de distancia. */
export function computeExperimentalVariogram(
  points: Array<{ x: number; y: number; value: number }>,
  nBins = 10,
): Array<{ lag: number; gamma: number }> {
  const pairs: Array<{ dist: number; diff2: number }> = [];
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      const dist = Math.hypot(points[i].x - points[j].x, points[i].y - points[j].y);
      pairs.push({ dist, diff2: (points[i].value - points[j].value) ** 2 });
    }
  }
  if (pairs.length === 0) return [];

  const maxDist = pairs.reduce((m, p) => (p.dist > m ? p.dist : m), 0);
  if (maxDist === 0) return [];
  const binWidth = maxDist / nBins;
  const bins: Array<{ lag: number; gamma: number }> = [];
  for (let b = 0; b < nBins; b++) {
    const lo = b * binWidth;
    const hi = (b + 1) * binWidth;
    const inBin = pairs.filter((p) => p.dist >= lo && p.dist < hi);
    if (inBin.length > 1) {
      bins.push({
        lag: (lo + hi) / 2,
        gamma: inBin.reduce((s, p) => s + p.diff2, 0) / (2 * inBin.length),
      });
    }
  }
  return bins;
}

/** Ajuste simple de un modelo esférico al variograma experimental. */
export function fitSphericalVariogram(
  bins: Array<{ lag: number; gamma: number }>,
): VariogramModel | null {
  if (bins.length < 3) return null;
  const sill = Math.max(...bins.map((b) => b.gamma));
  if (sill <= 0) return null;
  const nugget = bins[0].gamma * 0.3;
  let range = bins[bins.length - 1].lag;
  for (const b of bins) {
    if (b.gamma >= sill * 0.95) {
      range = b.lag;
      break;
    }
  }
  return { nugget, sill, range: range > 0 ? range : bins[bins.length - 1].lag };
}

/** Semivarianza de un modelo esférico a distancia h. */
export function sphericalVariogram(h: number, model: VariogramModel): number {
  if (h <= 0) return 0;
  if (h >= model.range) return model.sill;
  const hr = h / model.range;
  return model.nugget + (model.sill - model.nugget) * (1.5 * hr - 0.5 * hr ** 3);
}

export type ExistingDrillholeLocation = { lat: number; lng: number };

/**
 * Selecciona cuáles targets perforar combinando puntaje (prospectividad) con
 * ganancia de información respecto a sondajes ya ejecutados: un target de
 * puntaje medio lejos de toda la malla existente puede valer más que uno de
 * puntaje alto pegado a un sondaje ya hecho. Sin suficientes puntos para
 * ajustar un variograma (< 4 targets con puntaje), cae de vuelta a
 * `buildDrillGridFromTargets` — nunca inventa un rango de variograma.
 */
export function optimizeDrillSelection(
  targets: DrillTargetCandidate[],
  existingHoles: readonly ExistingDrillholeLocation[],
  center: { lat: number; lng: number },
  project: ProjectDrillConfig,
  opts: {
    maxCollars?: number;
    minScorePct?: number;
    strategy?: "infill" | "stepout" | "combined";
  } = {},
): ProposedCollar[] {
  const maxCollars = opts.maxCollars ?? MAX_COLLARS;
  const minScorePct = opts.minScorePct ?? MIN_SCORE * 100;
  const strategy = opts.strategy ?? "combined";

  const eligible = targets
    .filter((t) => t.withinTenure !== false)
    .filter((t) => t.score >= minScorePct);

  const refLat = eligible.length
    ? eligible.reduce((s, t) => s + t.lat, 0) / eligible.length
    : center.lat;
  const points = eligible.map((t) => {
    const { x, y } = toLocalMeters(t.lat, t.lng, refLat);
    return { x, y, value: Math.min(1, Math.max(0, t.score / 100)) };
  });
  const model = fitSphericalVariogram(computeExperimentalVariogram(points));

  // Sin datos suficientes para un variograma confiable: no se inventa un
  // rango de influencia, se usa el criterio simple de puntaje.
  if (!model) {
    return buildDrillGridFromTargets(targets, center, project, { maxCollars, minScorePct });
  }

  const placed: ExistingDrillholeLocation[] = [...existingHoles];
  const minSpacingM = model.range * 0.3;

  const scored = eligible
    .map((t) => {
      const prosp = Math.min(1, Math.max(0, t.score / 100));
      let minDistExisting = Infinity;
      for (const h of placed) {
        const d = distanceM(t.lat, t.lng, h.lat, h.lng);
        if (d < minDistExisting) minDistExisting = d;
      }
      const krigingVar =
        minDistExisting === Infinity || minDistExisting >= model.range
          ? model.sill
          : sphericalVariogram(minDistExisting, model);
      const infoGain = krigingVar / model.sill;

      let score: number;
      if (strategy === "infill") score = prosp * 0.6 + infoGain * 0.4;
      else if (strategy === "stepout") {
        const edgeBonus = prosp > 0.3 && prosp < 0.7 ? 0.3 : 0;
        score = prosp * 0.3 + infoGain * 0.4 + edgeBonus;
      } else score = prosp * 0.5 + infoGain * 0.5;

      return { target: t, prosp, score };
    })
    .sort((a, b) => b.score - a.score || a.target.id.localeCompare(b.target.id));

  const chosen: DrillTargetCandidate[] = [];
  for (const candidate of scored) {
    if (chosen.length >= maxCollars) break;
    const tooClose = placed.some(
      (h) => distanceM(candidate.target.lat, candidate.target.lng, h.lat, h.lng) < minSpacingM,
    );
    if (tooClose) continue;
    chosen.push(candidate.target);
    placed.push({ lat: candidate.target.lat, lng: candidate.target.lng });
  }

  return chosen.map((t, i) => {
    const score = Math.min(1, Math.max(0, t.score / 100));
    return {
      code: `${project.codePrefix}-${String(i + 1).padStart(2, "0")}`,
      anomalyId: t.id,
      indexCode: "TARGET",
      lat: t.lat,
      lng: t.lng,
      azimuthDeg: azimuthFor(t.lat, t.lng, center, project.dominantStrikeDeg),
      dipDeg: -60,
      depthM: depthFor(score),
      priority: priorityOf(score),
      objective: t.objective,
      score,
    };
  });
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
    if (
      f?.geometry?.type !== "Point" ||
      !Array.isArray(coords) ||
      !p ||
      typeof p.code !== "string" ||
      !p.code.trim() ||
      codes.has(p.code) ||
      typeof p.index_code !== "string" ||
      ![coords[0], coords[1], p.azimuth_deg, p.dip_deg, p.depth_m, p.score].every(
        (value) => typeof value === "number" && Number.isFinite(value),
      )
    )
      throw new Error("PUBLISHED_DRILL_COLLAR_INVALID");
    const [lng, lat] = coords as number[];
    const azimuthDeg = p.azimuth_deg as number;
    const dipDeg = p.dip_deg as number;
    const depthM = p.depth_m as number;
    const score = p.score as number;
    if (
      Math.abs(lng) > 180 ||
      Math.abs(lat) >= 90 ||
      azimuthDeg < 0 ||
      azimuthDeg >= 360 ||
      dipDeg > 0 ||
      dipDeg < -90 ||
      depthM <= 0 ||
      score < 0 ||
      score > 1 ||
      !["Alta", "Media", "Baja"].includes(String(p.priority))
    ) {
      throw new Error("PUBLISHED_DRILL_COLLAR_INVALID");
    }
    codes.add(p.code);
    return {
      code: p.code,
      anomalyId: null,
      indexCode: p.index_code,
      lat,
      lng,
      azimuthDeg,
      dipDeg,
      depthM,
      score,
      priority: p.priority as ProposedCollar["priority"],
      objective:
        typeof p.objetivo === "string"
          ? p.objetivo
          : "Objetivo no informado en la propuesta publicada",
    };
  });
}
