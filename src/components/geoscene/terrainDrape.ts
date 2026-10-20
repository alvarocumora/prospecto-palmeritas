// Drapes 2D GeoJSON onto the rendered terrain (MapLibre DEM or CAD tile) by
// giving every vertex an absolute z. Without this, deck.gl draws catastro and
// anomaly polygons at z=0 — hundreds of metres below the visible relief — so
// they slide away from their true position when the camera is pitched.
import type { Feature, FeatureCollection, Geometry, Position } from "geojson";
import { projectTerrainPoint, type TerrainGrid } from "@/lib/geospatial/terrainCoordinates";
import type { CadTerrainTile } from "@/lib/geospatial/terrainTile";

/** Returns absolute elevation in metres (already exaggerated), or null when unknown. */
export type ElevationSampler = (lng: number, lat: number) => number | null;

const M_PER_DEG = 111_320;

function segmentMeters(a: Position, b: Position): number {
  const cos = Math.cos((((a[1] + b[1]) / 2) * Math.PI) / 180);
  return Math.hypot((b[0] - a[0]) * M_PER_DEG * cos, (b[1] - a[1]) * M_PER_DEG);
}

/** Densifies a path so long edges follow the relief instead of cutting through it. */
export function drapePath(
  path: Position[],
  sample: ElevationSampler,
  fallback: number,
  offsetM: number,
  maxSegmentM: number,
): Position[] {
  const out: Position[] = [];
  const z = (lng: number, lat: number) => (sample(lng, lat) ?? fallback) + offsetM;
  for (let i = 0; i < path.length; i++) {
    const a = path[i];
    if (i === 0) out.push([a[0], a[1], z(a[0], a[1])]);
    if (i === path.length - 1) break;
    const b = path[i + 1];
    const steps = Math.min(64, Math.max(1, Math.ceil(segmentMeters(a, b) / maxSegmentM)));
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      const lng = a[0] + (b[0] - a[0]) * t;
      const lat = a[1] + (b[1] - a[1]) * t;
      out.push([lng, lat, z(lng, lat)]);
    }
  }
  return out;
}

function drapeGeometry(
  g: Geometry,
  sample: ElevationSampler,
  fallback: number,
  offsetM: number,
  maxSegmentM: number,
): Geometry {
  const path = (p: Position[]) => drapePath(p, sample, fallback, offsetM, maxSegmentM);
  switch (g.type) {
    case "Point":
      return { ...g, coordinates: path([g.coordinates])[0] };
    case "MultiPoint":
      return { ...g, coordinates: g.coordinates.map((c) => path([c])[0]) };
    case "LineString":
      return { ...g, coordinates: path(g.coordinates) };
    case "MultiLineString":
      return { ...g, coordinates: g.coordinates.map(path) };
    case "Polygon":
      return { ...g, coordinates: g.coordinates.map(path) };
    case "MultiPolygon":
      return { ...g, coordinates: g.coordinates.map((poly) => poly.map(path)) };
    case "GeometryCollection":
      return {
        ...g,
        geometries: g.geometries.map((x) =>
          drapeGeometry(x, sample, fallback, offsetM, maxSegmentM),
        ),
      };
  }
}

export function drapeFeatureCollection(
  fc: FeatureCollection,
  sample: ElevationSampler,
  { fallback = 0, offsetM = 6, maxSegmentM = 60 } = {},
): FeatureCollection {
  return {
    ...fc,
    features: fc.features.map((f): Feature =>
      f.geometry
        ? { ...f, geometry: drapeGeometry(f.geometry, sample, fallback, offsetM, maxSegmentM) }
        : f,
    ),
  };
}

/**
 * Selects (never blends) the first sampler that knows the elevation: survey
 * inside its coverage, regional DEM elsewhere. Keeps provenance per vertex clear.
 */
export function hybridElevationSampler(...samplers: ElevationSampler[]): ElevationSampler {
  return (lng, lat) => {
    for (const s of samplers) {
      const h = s(lng, lat);
      if (h !== null && Number.isFinite(h)) return h;
    }
    return null;
  };
}

/** Bilinear sampler over the CAD tile; null outside surveyed coverage (no extrapolation). */
export function cadElevationSampler(tile: CadTerrainTile): ElevationSampler {
  const grid = tile as unknown as TerrainGrid;
  return (lng, lat) => {
    const p = projectTerrainPoint(grid, lng, lat);
    return p ? p[1] + tile.referenceElevationM : null;
  };
}
