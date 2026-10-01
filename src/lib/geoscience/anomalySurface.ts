/**
 * Superficie de intensidad por IDW para cualquier conjunto de puntos con
 * valor (anomalías satelitales por z-score, geoquímica por elemento, etc.).
 * Mismo algoritmo que `geophysicsSurface.ts` pero desacoplado de
 * `GeophysicsStation` para reutilizarse fuera de geofísica — es
 * visualización/interpolación, NO una medición ni una inversión.
 */

export type AnomalySurfaceCell = {
  lat: number;
  lng: number;
  south: number;
  west: number;
  north: number;
  east: number;
  value: number;
  normalized: number;
};

export type AnomalySurface = {
  unit: string;
  sourceCount: number;
  min: number;
  max: number;
  cells: AnomalySurfaceCell[];
};

export type AnomalySurfaceOptions = {
  gridSize?: number;
  power?: number;
  minPoints?: number;
  paddingFraction?: number;
  /** Radio de soporte máximo, como múltiplo de la distancia mediana al vecino más cercano. */
  maxSupportFactor?: number;
  unit?: string;
};

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * IDW para visualización de mapa únicamente. `points` debe traer solo
 * observaciones reales (no sintéticas) con valor finito.
 */
export function buildAnomalySurface(
  points: Array<{ lat: number; lng: number; value: number }>,
  options: AnomalySurfaceOptions = {},
): AnomalySurface | null {
  const valid = points.filter(
    (p) => Number.isFinite(p.lat) && Number.isFinite(p.lng) && Number.isFinite(p.value),
  );
  const minPoints = options.minPoints ?? 4;
  if (valid.length < minPoints) return null;

  const gridSize = Math.max(8, Math.min(options.gridSize ?? 32, 90));
  const power = Math.max(1, Math.min(options.power ?? 2, 4));
  const paddingFraction = Math.max(0, Math.min(options.paddingFraction ?? 0.1, 0.3));
  const maxSupportFactor = Math.max(1, Math.min(options.maxSupportFactor ?? 3, 6));

  const lats = valid.map((p) => p.lat);
  const lngs = valid.map((p) => p.lng);
  const rawLatSpan = Math.max(...lats) - Math.min(...lats);
  const rawLngSpan = Math.max(...lngs) - Math.min(...lngs);
  if (rawLatSpan <= 0 || rawLngSpan <= 0) return null;

  const latPad = rawLatSpan * paddingFraction;
  const lngPad = rawLngSpan * paddingFraction;
  const south = Math.min(...lats) - latPad;
  const north = Math.max(...lats) + latPad;
  const west = Math.min(...lngs) - lngPad;
  const east = Math.max(...lngs) + lngPad;
  const latStep = (north - south) / gridSize;
  const lngStep = (east - west) / gridSize;
  const meanLatRad = ((south + north) / 2) * (Math.PI / 180);
  const cosLat = Math.max(Math.cos(meanLatRad), 0.2);

  const nearestNeighbourDistances = valid.map((point, index) => {
    let nearest = Number.POSITIVE_INFINITY;
    valid.forEach((candidate, candidateIndex) => {
      if (candidateIndex === index) return;
      const dy = point.lat - candidate.lat;
      const dx = (point.lng - candidate.lng) * cosLat;
      nearest = Math.min(nearest, Math.sqrt(dx * dx + dy * dy));
    });
    return nearest;
  });
  const supportRadius = median(nearestNeighbourDistances) * maxSupportFactor;

  const rawCells: Array<Omit<AnomalySurfaceCell, "normalized">> = [];
  for (let row = 0; row < gridSize; row += 1) {
    for (let col = 0; col < gridSize; col += 1) {
      const lat = south + (row + 0.5) * latStep;
      const lng = west + (col + 0.5) * lngStep;
      let weighted = 0;
      let weights = 0;
      let exact: number | null = null;
      let nearestDistance = Number.POSITIVE_INFINITY;

      for (const point of valid) {
        const dy = lat - point.lat;
        const dx = (lng - point.lng) * cosLat;
        const d2 = dx * dx + dy * dy;
        const distance = Math.sqrt(d2);
        nearestDistance = Math.min(nearestDistance, distance);
        if (d2 < 1e-14) {
          exact = point.value;
          break;
        }
        const weight = 1 / Math.pow(Math.sqrt(d2), power);
        weighted += point.value * weight;
        weights += weight;
      }

      if (nearestDistance > supportRadius) continue;
      const value = exact ?? weighted / weights;
      rawCells.push({
        lat,
        lng,
        south: lat - latStep / 2,
        west: lng - lngStep / 2,
        north: lat + latStep / 2,
        east: lng + lngStep / 2,
        value,
      });
    }
  }

  if (!rawCells.length) return null;
  const values = rawCells.map((cell) => cell.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(max - min, Number.EPSILON);
  const cells = rawCells.map((cell) => ({
    ...cell,
    normalized: (cell.value - min) / span,
  }));

  return { unit: options.unit ?? "z-score", sourceCount: valid.length, min, max, cells };
}

/**
 * Rampa secuencial azul→cian→verde→amarillo→magenta por intensidad
 * normalizada [0,1] — mismo lenguaje visual que un mapa de kriging de
 * geoquímica (frío = fondo, cálido = anomalía fuerte).
 */
export function anomalyIntensityColor(t: number): string {
  const clamped = Math.max(0, Math.min(1, t));
  const stops: Array<[number, [number, number, number]]> = [
    [0, [37, 66, 153]], // azul
    [0.3, [14, 165, 233]], // cian
    [0.55, [34, 197, 94]], // verde
    [0.75, [234, 179, 8]], // amarillo
    [1, [217, 70, 239]], // magenta
  ];
  let lo = stops[0];
  let hi = stops[stops.length - 1];
  for (let i = 0; i < stops.length - 1; i++) {
    if (clamped >= stops[i][0] && clamped <= stops[i + 1][0]) {
      lo = stops[i];
      hi = stops[i + 1];
      break;
    }
  }
  const [loT, loC] = lo;
  const [hiT, hiC] = hi;
  const span = Math.max(hiT - loT, Number.EPSILON);
  const f = (clamped - loT) / span;
  const r = Math.round(loC[0] + (hiC[0] - loC[0]) * f);
  const g = Math.round(loC[1] + (hiC[1] - loC[1]) * f);
  const b = Math.round(loC[2] + (hiC[2] - loC[2]) * f);
  return `rgb(${r},${g},${b})`;
}

/**
 * Mismos 5 stops que `anomalyIntensityColor`, como pares [t, "#rrggbb"] para
 * usar en una expresión data-driven de MapLibre (`interpolate`/`linear`) o
 * en una leyenda CSS — evita duplicar la rampa en cada consumidor.
 */
export const ANOMALY_INTENSITY_COLOR_STOPS: ReadonlyArray<[number, string]> = [
  [0, "#254299"],
  [0.3, "#0ea5e9"],
  [0.55, "#22c55e"],
  [0.75, "#eab308"],
  [1, "#d946ef"],
];

/**
 * Convierte una AnomalySurface a un FeatureCollection de polígonos (un
 * rectángulo por celda) en GeoJSON estándar — sin dependencias de Leaflet,
 * MapLibre ni del contrato público; cada consumidor decide cómo pintarlo
 * (color por `value`/`normalized` en sus properties).
 */
export function anomalySurfaceToFeatureCollection(surface: AnomalySurface): {
  type: "FeatureCollection";
  features: Array<{
    type: "Feature";
    id: string;
    geometry: { type: "Polygon"; coordinates: number[][][] };
    properties: { value: number; normalized: number; unit: string; sourceCount: number };
  }>;
} {
  return {
    type: "FeatureCollection",
    features: surface.cells.map((cell, index) => ({
      type: "Feature",
      id: `intensity-cell-${index}`,
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [cell.west, cell.south],
            [cell.east, cell.south],
            [cell.east, cell.north],
            [cell.west, cell.north],
            [cell.west, cell.south],
          ],
        ],
      },
      properties: {
        value: cell.value,
        normalized: cell.normalized,
        unit: surface.unit,
        sourceCount: surface.sourceCount,
      },
    })),
  };
}
