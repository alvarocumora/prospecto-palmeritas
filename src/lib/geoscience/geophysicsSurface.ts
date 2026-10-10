import type { GeophysicsStation } from "@/types/geophysics";

export type GeophysicsSurfaceMetric =
  | "mag_residual_nt"
  | "ip_chargeability_mvv"
  | "ip_resistivity_ohmm";

export type GeophysicsSurfaceCell = {
  lat: number;
  lng: number;
  south: number;
  west: number;
  north: number;
  east: number;
  value: number;
  normalized: number;
};

export type GeophysicsSurface = {
  metric: GeophysicsSurfaceMetric;
  unit: string;
  sourceCount: number;
  provenance: "FIELD_INTERPOLATION";
  baseline: number | null;
  min: number;
  max: number;
  cells: GeophysicsSurfaceCell[];
};

export type GeophysicsSurfaceOptions = {
  gridSize?: number;
  power?: number;
  minPoints?: number;
  paddingFraction?: number;
  /** Maximum support radius as a multiple of median nearest-neighbour spacing. */
  maxSupportFactor?: number;
};

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function valueFor(
  station: GeophysicsStation,
  metric: GeophysicsSurfaceMetric,
  magneticBaseline: number | null,
): number | null {
  if (metric === "mag_residual_nt") {
    if (station.mag_nt == null || magneticBaseline == null) return null;
    return station.mag_nt - magneticBaseline;
  }
  if (metric === "ip_chargeability_mvv") return station.ip_chargeability_mvv;
  return station.ip_resistivity_ohmm;
}

function unitFor(metric: GeophysicsSurfaceMetric): string {
  if (metric === "mag_residual_nt") return "nT residual";
  if (metric === "ip_chargeability_mvv") return "mV/V";
  return "Ω·m";
}

/**
 * IDW interpolation for map visualization only.
 *
 * It deliberately accepts FIELD stations only. Synthetic stations never enter
 * this surface. The result is DERIVED from measurements and must not be
 * presented as an inversion or as direct subsurface observation.
 */
export function buildFieldGeophysicsSurface(
  stations: GeophysicsStation[],
  metric: GeophysicsSurfaceMetric,
  options: GeophysicsSurfaceOptions = {},
): GeophysicsSurface | null {
  const field = stations.filter(
    (station) =>
      !station.is_synthetic &&
      Number.isFinite(station.lat) &&
      Number.isFinite(station.lng) &&
      Math.abs(station.lat) < 90 &&
      Math.abs(station.lng) <= 180,
  );
  // A residual baseline cannot mix campaigns or project coordinate frames.
  const campaigns = new Set(
    field.map((station) => JSON.stringify([station.project_id, station.survey_id])),
  );
  if (campaigns.size > 1) return null;
  const magneticValues = field
    .map((station) => station.mag_nt)
    .filter((value): value is number => value != null && Number.isFinite(value));
  const magneticBaseline = magneticValues.length ? median(magneticValues) : null;

  const points = field
    .map((station) => ({
      lat: station.lat,
      lng: station.lng,
      value: valueFor(station, metric, magneticBaseline),
    }))
    .filter(
      (point): point is { lat: number; lng: number; value: number } =>
        point.value != null && Number.isFinite(point.value),
    );

  const minPoints = options.minPoints ?? 4;
  if (points.length < minPoints) return null;
  const positions = new Set(points.map((point) => point.lat + ":" + point.lng));
  // Repeated stations must be resolved by acquisition QA, not silently averaged.
  if (positions.size !== points.length) return null;

  const gridSize = Math.max(8, Math.min(options.gridSize ?? 28, 80));
  const power = Math.max(1, Math.min(options.power ?? 2, 4));
  const paddingFraction = Math.max(0, Math.min(options.paddingFraction ?? 0.08, 0.3));
  const maxSupportFactor = Math.max(1, Math.min(options.maxSupportFactor ?? 2.5, 6));

  const lats = points.map((point) => point.lat);
  const lngs = points.map((point) => point.lng);
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

  const nearestNeighbourDistances = points.map((point, index) => {
    let nearest = Number.POSITIVE_INFINITY;
    points.forEach((candidate, candidateIndex) => {
      if (candidateIndex === index) return;
      const dy = point.lat - candidate.lat;
      const dx = (point.lng - candidate.lng) * cosLat;
      nearest = Math.min(nearest, Math.sqrt(dx * dx + dy * dy));
    });
    return nearest;
  });
  const supportRadius = median(nearestNeighbourDistances) * maxSupportFactor;

  const rawCells: Array<Omit<GeophysicsSurfaceCell, "normalized">> = [];
  for (let row = 0; row < gridSize; row += 1) {
    for (let col = 0; col < gridSize; col += 1) {
      const lat = south + (row + 0.5) * latStep;
      const lng = west + (col + 0.5) * lngStep;
      let weighted = 0;
      let weights = 0;
      let exact: number | null = null;
      let nearestDistance = Number.POSITIVE_INFINITY;

      for (const point of points) {
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

  return {
    metric,
    unit: unitFor(metric),
    sourceCount: points.length,
    provenance: "FIELD_INTERPOLATION",
    baseline: metric === "mag_residual_nt" ? magneticBaseline : null,
    min,
    max,
    cells,
  };
}
