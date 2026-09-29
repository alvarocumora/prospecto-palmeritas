import type { DemTile } from "@/engine3d/terrain/dem.functions";

export type LonLat = [number, number];

export type TerrainWorkClass = "A" | "B" | "C" | "D";

export type TerrainClassSummary = {
  workClass: TerrainWorkClass;
  label: string;
  minSlopeDeg: number;
  maxSlopeDeg: number | null;
  pct: number;
  areaHa: number;
};

export type TerrainControlPoint = {
  code: string;
  purpose: string;
  lat: number;
  lng: number;
  elevationM: number | null;
  relativeElevationM: number | null;
  slopeDeg: number | null;
  workClass: TerrainWorkClass | null;
};

export type TerrainAnalysis = {
  source: DemTile["source"];
  cellSizeM: number;
  reliefM: number;
  minElevationM: number | null;
  maxElevationM: number | null;
  meanSlopeDeg: number;
  polygonCells: number;
  classes: TerrainClassSummary[];
  controlPoints: TerrainControlPoint[];
};

const METERS_PER_DEG_LAT = 111_320;

export function pointInPolygon(lng: number, lat: number, ring: LonLat[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersects =
      yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi || Number.EPSILON) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

function midpoint(a: LonLat, b: LonLat): LonLat {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
}

function ringVertices(ring: LonLat[]): LonLat[] {
  if (ring.length > 1) {
    const first = ring[0];
    const last = ring[ring.length - 1];
    if (first[0] === last[0] && first[1] === last[1]) return ring.slice(0, -1);
  }
  return ring.slice();
}

export function buildToki2ControlPoints(ring: LonLat[]): Array<{
  code: string;
  purpose: string;
  lat: number;
  lng: number;
}> {
  const vertices = ringVertices(ring);
  if (vertices.length < 4) return [];
  const [nw, ne, se, sw] = vertices;
  const center: LonLat = [
    vertices.reduce((sum, point) => sum + point[0], 0) / vertices.length,
    vertices.reduce((sum, point) => sum + point[1], 0) / vertices.length,
  ];
  const definitions: Array<[string, string, LonLat]> = [
    ["TK2-01", "Vértice NO · control litológico", nw],
    ["TK2-02", "Borde norte · traverse E–O", midpoint(nw, ne)],
    ["TK2-03", "Vértice NE · control estructural", ne],
    ["TK2-04", "Borde este · exposición y acceso", midpoint(ne, se)],
    ["TK2-05", "Vértice SE · control perimetral", se],
    ["TK2-06", "Borde sur · traverse E–O", midpoint(se, sw)],
    ["TK2-07", "Vértice SO · control perimetral", sw],
    ["TK2-08", "Borde oeste · acceso y quebradas", midpoint(sw, nw)],
    ["TK2-09", "Centro · estación estructural", center],
  ];
  return definitions.map(([code, purpose, [lng, lat]]) => ({ code, purpose, lat, lng }));
}

export function workClassForSlope(slopeDeg: number): TerrainWorkClass {
  if (slopeDeg <= 15) return "A";
  if (slopeDeg <= 25) return "B";
  if (slopeDeg <= 35) return "C";
  return "D";
}

export const TERRAIN_CLASS_LABELS: Record<TerrainWorkClass, string> = {
  A: "Favorable para plataforma / apoyo",
  B: "Acceso condicionado y diseño local",
  C: "Exploración principalmente manual",
  D: "Restringido para maquinaria",
};

function slopeAt(tile: DemTile, i: number, j: number): number {
  const cell = tile.extentMeters / (tile.size - 1);
  const leftI = Math.max(0, i - 1);
  const rightI = Math.min(tile.size - 1, i + 1);
  const upJ = Math.max(0, j - 1);
  const downJ = Math.min(tile.size - 1, j + 1);
  const dxDen = Math.max(1, rightI - leftI) * cell;
  const dyDen = Math.max(1, downJ - upJ) * cell;
  const dzdx = (tile.heights[j * tile.size + rightI] - tile.heights[j * tile.size + leftI]) / dxDen;
  const dzdy = (tile.heights[downJ * tile.size + i] - tile.heights[upJ * tile.size + i]) / dyDen;
  return (Math.atan(Math.hypot(dzdx, dzdy)) * 180) / Math.PI;
}

function gridLonLat(tile: DemTile, i: number, j: number): LonLat | null {
  if (tile.centerLat == null || tile.centerLng == null) return null;
  const cell = tile.extentMeters / (tile.size - 1);
  const half = tile.extentMeters / 2;
  const east = i * cell - half;
  const north = half - j * cell;
  const lat = tile.centerLat + north / METERS_PER_DEG_LAT;
  const lng =
    tile.centerLng + east / (METERS_PER_DEG_LAT * Math.cos((tile.centerLat * Math.PI) / 180));
  return [lng, lat];
}

export function sampleTerrainAt(
  tile: DemTile,
  lat: number,
  lng: number,
): Omit<TerrainControlPoint, "code" | "purpose" | "lat" | "lng"> {
  if (tile.centerLat == null || tile.centerLng == null) {
    return {
      elevationM: null,
      relativeElevationM: null,
      slopeDeg: null,
      workClass: null,
    };
  }
  const north = (lat - tile.centerLat) * METERS_PER_DEG_LAT;
  const east =
    (lng - tile.centerLng) * METERS_PER_DEG_LAT * Math.cos((tile.centerLat * Math.PI) / 180);
  const half = tile.extentMeters / 2;
  const u = (east + half) / tile.extentMeters;
  const v = (half - north) / tile.extentMeters;
  if (u < 0 || u > 1 || v < 0 || v > 1) {
    return {
      elevationM: null,
      relativeElevationM: null,
      slopeDeg: null,
      workClass: null,
    };
  }
  const i = Math.min(tile.size - 1, Math.max(0, Math.round(u * (tile.size - 1))));
  const j = Math.min(tile.size - 1, Math.max(0, Math.round(v * (tile.size - 1))));
  const relativeElevationM = tile.heights[j * tile.size + i] ?? null;
  const slopeDeg = slopeAt(tile, i, j);
  return {
    elevationM:
      relativeElevationM != null && tile.centerElevationM != null
        ? tile.centerElevationM + relativeElevationM
        : null,
    relativeElevationM,
    slopeDeg,
    workClass: workClassForSlope(slopeDeg),
  };
}

export function analyzeToki2Terrain(
  tile: DemTile,
  ring: LonLat[],
  concessionAreaHa = 100,
): TerrainAnalysis {
  const slopes: number[] = [];
  const relativeHeights: number[] = [];
  const classCounts: Record<TerrainWorkClass, number> = { A: 0, B: 0, C: 0, D: 0 };

  for (let j = 0; j < tile.size; j++) {
    for (let i = 0; i < tile.size; i++) {
      const ll = gridLonLat(tile, i, j);
      if (!ll || !pointInPolygon(ll[0], ll[1], ring)) continue;
      const h = tile.heights[j * tile.size + i];
      if (!Number.isFinite(h)) continue;
      const slope = slopeAt(tile, i, j);
      slopes.push(slope);
      relativeHeights.push(h);
      classCounts[workClassForSlope(slope)] += 1;
    }
  }

  const polygonCells = slopes.length;
  const minRelative = relativeHeights.length ? Math.min(...relativeHeights) : 0;
  const maxRelative = relativeHeights.length ? Math.max(...relativeHeights) : 0;
  const reliefM = maxRelative - minRelative;
  const meanSlopeDeg = slopes.length
    ? slopes.reduce((sum, slope) => sum + slope, 0) / slopes.length
    : 0;

  const specs: Array<[TerrainWorkClass, number, number | null]> = [
    ["A", 0, 15],
    ["B", 15, 25],
    ["C", 25, 35],
    ["D", 35, null],
  ];
  const classes = specs.map(([workClass, minSlopeDeg, maxSlopeDeg]) => {
    const pct = polygonCells ? (classCounts[workClass] / polygonCells) * 100 : 0;
    return {
      workClass,
      label: TERRAIN_CLASS_LABELS[workClass],
      minSlopeDeg,
      maxSlopeDeg,
      pct,
      areaHa: (pct / 100) * concessionAreaHa,
    };
  });

  const controlPoints = buildToki2ControlPoints(ring).map((point) => ({
    ...point,
    ...sampleTerrainAt(tile, point.lat, point.lng),
  }));

  return {
    source: tile.source,
    cellSizeM: tile.extentMeters / (tile.size - 1),
    reliefM,
    minElevationM: tile.centerElevationM != null ? tile.centerElevationM + minRelative : null,
    maxElevationM: tile.centerElevationM != null ? tile.centerElevationM + maxRelative : null,
    meanSlopeDeg,
    polygonCells,
    classes,
    controlPoints,
  };
}
