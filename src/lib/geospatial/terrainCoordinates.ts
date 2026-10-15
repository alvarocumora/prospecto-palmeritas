import type { Geometry, Position } from "geojson";

export const TERRAIN_METERS_PER_DEGREE = 111_320;

export type TerrainGrid = {
  size: number;
  extentMeters: number;
  centerLat: number | null;
  centerLng: number | null;
  heights: number[];
  source: "copernicus" | "cad_contours" | "synthetic";
  validMask?: boolean[];
};

export function localTerrainMeters(
  lng: number,
  lat: number,
  centerLng: number,
  centerLat: number,
): [number, number] | null {
  if (
    ![lng, lat, centerLng, centerLat].every(Number.isFinite) ||
    Math.abs(lng) > 180 ||
    Math.abs(lat) >= 90 ||
    Math.abs(centerLng) > 180 ||
    Math.abs(centerLat) >= 90
  )
    return null;
  const cosine = Math.cos((centerLat * Math.PI) / 180);
  return [
    (lng - centerLng) * TERRAIN_METERS_PER_DEGREE * cosine,
    (lat - centerLat) * TERRAIN_METERS_PER_DEGREE,
  ];
}

/** Display grid in a local metric frame; this does not transform a source datum. */
export function terrainGridCoordinate(
  centerLat: number,
  centerLng: number,
  size: number,
  extentMeters: number,
  column: number,
  row: number,
): [number, number] {
  const east = (column / (size - 1) - 0.5) * extentMeters;
  const north = (0.5 - row / (size - 1)) * extentMeters;
  return [
    centerLng + east / (TERRAIN_METERS_PER_DEGREE * Math.cos((centerLat * Math.PI) / 180)),
    centerLat + north / TERRAIN_METERS_PER_DEGREE,
  ];
}

/** Bilinear sampling. Unknown/outside/synthetic terrain never becomes elevation zero. */
export function projectTerrainPoint(
  tile: TerrainGrid,
  lng: number,
  lat: number,
): [number, number, number] | null {
  if (
    (tile.source !== "copernicus" && tile.source !== "cad_contours") ||
    tile.centerLat == null ||
    tile.centerLng == null ||
    tile.size < 2 ||
    tile.heights.length !== tile.size * tile.size ||
    !Number.isFinite(tile.extentMeters) ||
    tile.extentMeters <= 0
  )
    return null;
  const local = localTerrainMeters(lng, lat, tile.centerLng, tile.centerLat);
  if (!local) return null;
  const [east, north] = local;
  const u = east / tile.extentMeters + 0.5;
  const v = 0.5 - north / tile.extentMeters;
  const epsilon = 1e-9;
  if (u < -epsilon || u > 1 + epsilon || v < -epsilon || v > 1 + epsilon) return null;
  const x = Math.min(1, Math.max(0, u)) * (tile.size - 1);
  const y = Math.min(1, Math.max(0, v)) * (tile.size - 1);
  const x0 = Math.floor(x),
    y0 = Math.floor(y);
  const x1 = Math.min(tile.size - 1, x0 + 1),
    y1 = Math.min(tile.size - 1, y0 + 1);
  if (tile.source === "cad_contours" &&
      (!tile.validMask || tile.validMask.length !== tile.size * tile.size ||
       [y0 * tile.size + x0, y0 * tile.size + x1, y1 * tile.size + x0, y1 * tile.size + x1]
         .some((index) => !tile.validMask?.[index]))) return null;
  const values = [
    tile.heights[y0 * tile.size + x0],
    tile.heights[y0 * tile.size + x1],
    tile.heights[y1 * tile.size + x0],
    tile.heights[y1 * tile.size + x1],
  ];
  if (!values.every(Number.isFinite)) return null;
  const fx = x - x0,
    fy = y - y0;
  const h =
    (values[0] * (1 - fx) + values[1] * fx) * (1 - fy) +
    (values[2] * (1 - fx) + values[3] * fx) * fy;
  return [east, h, -north];
}

function geometryPaths(geometry: Geometry): Position[][] {
  switch (geometry.type) {
    case "Polygon":
      return geometry.coordinates;
    case "MultiPolygon":
      return geometry.coordinates.flat();
    case "LineString":
      return [geometry.coordinates];
    case "MultiLineString":
      return geometry.coordinates;
    case "GeometryCollection":
      return geometry.geometries.flatMap(geometryPaths);
    default:
      return [];
  }
}

/** Preserve holes and multipart paths; split at missing/outside elevations. */
export function terrainFootprintPaths(
  geometry: Geometry | null,
  tile: TerrainGrid,
): Array<Array<[number, number, number]>> {
  if (!geometry || tile.centerLat == null || tile.centerLng == null) return [];
  const result: Array<Array<[number, number, number]>> = [];
  const spacing = Math.max(20, tile.extentMeters / (tile.size - 1));
  for (const ring of geometryPaths(geometry)) {
    let segment: Array<[number, number, number]> = [];
    const flush = () => {
      if (segment.length > 1) result.push(segment);
      segment = [];
    };
    for (let i = 0; i < ring.length - 1; i++) {
      const a = ring[i],
        b = ring[i + 1];
      const start = localTerrainMeters(a[0], a[1], tile.centerLng, tile.centerLat);
      const end = localTerrainMeters(b[0], b[1], tile.centerLng, tile.centerLat);
      if (!start || !end) {
        flush();
        continue;
      }
      const steps = Math.min(
        4096,
        Math.max(1, Math.ceil(Math.hypot(end[0] - start[0], end[1] - start[1]) / spacing)),
      );
      for (let step = 0; step <= steps; step++) {
        const t = step / steps;
        const point = projectTerrainPoint(tile, a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t);
        if (point) segment.push(point);
        else flush();
      }
    }
    flush();
  }
  return result;
}

export function proposedTraceEnd(
  collar: [number, number, number],
  azimuthDeg: number,
  dipDeg: number,
  depthM: number,
): [number, number, number] | null {
  if (
    ![...collar, azimuthDeg, dipDeg, depthM].every(Number.isFinite) ||
    depthM <= 0 ||
    dipDeg > 0 ||
    dipDeg < -90
  )
    return null;
  const az = (azimuthDeg * Math.PI) / 180;
  const dip = (-dipDeg * Math.PI) / 180;
  const horizontal = depthM * Math.cos(dip);
  return [
    collar[0] + Math.sin(az) * horizontal,
    collar[1] - depthM * Math.sin(dip),
    collar[2] - Math.cos(az) * horizontal,
  ];
}
