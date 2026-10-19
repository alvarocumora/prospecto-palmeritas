import type { CadTerrainTile } from "@/lib/geospatial/terrainTile";
import { terrainGridCoordinate } from "@/lib/geospatial/terrainCoordinates";

/**
 * Builds a triangle mesh (metre offsets from the tile centre, absolute elevation)
 * from a CAD-derived terrain tile. Only grid cells whose four corners are inside
 * the coverage mask are emitted, so nothing is extrapolated beyond the contours.
 * Row 0 of the grid is the northern edge.
 */
export type CadTerrainMesh = {
  positions: Float32Array;
  normals: Float32Array;
  colors: Float32Array;
  texCoords: Float32Array;
  indices: Uint32Array;
  cellCount: number;
};

const LOW: [number, number, number] = [0.42, 0.47, 0.36];
const HIGH: [number, number, number] = [0.86, 0.8, 0.68];

export function buildCadTerrainMesh(
  tile: CadTerrainTile,
  imageBbox?: [number, number, number, number],
): CadTerrainMesh {
  const { size, extentMeters, heights, validMask, referenceElevationM } = tile;
  const step = extentMeters / (size - 1);
  const half = extentMeters / 2;
  const n = size * size;
  const positions = new Float32Array(n * 3);
  const colors = new Float32Array(n * 4);
  const texCoords = new Float32Array(n * 2);
  const range = Math.max(1, tile.maxH - tile.minH);

  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      const i = row * size + col;
      const h = validMask[i] ? heights[i] : tile.minH;
      positions[i * 3] = -half + col * step;
      positions[i * 3 + 1] = half - row * step;
      positions[i * 3 + 2] = h + referenceElevationM;
      const t = Math.min(1, Math.max(0, (h - tile.minH) / range));
      colors[i * 4] = LOW[0] + (HIGH[0] - LOW[0]) * t;
      colors[i * 4 + 1] = LOW[1] + (HIGH[1] - LOW[1]) * t;
      colors[i * 4 + 2] = LOW[2] + (HIGH[2] - LOW[2]) * t;
      colors[i * 4 + 3] = 1;
      if (imageBbox) {
        const [west, south, east, north] = imageBbox;
        const [lng, lat] = terrainGridCoordinate(
          Number(tile.centerLat),
          Number(tile.centerLng),
          size,
          extentMeters,
          col,
          row,
        );
        texCoords[i * 2] = (lng - west) / (east - west);
        texCoords[i * 2 + 1] = (north - lat) / (north - south);
      }
    }
  }

  const idx: number[] = [];
  let cellCount = 0;
  for (let row = 0; row < size - 1; row++) {
    for (let col = 0; col < size - 1; col++) {
      const a = row * size + col;
      const b = a + size;
      const c = b + 1;
      const d = a + 1;
      if (!(validMask[a] && validMask[b] && validMask[c] && validMask[d])) continue;
      idx.push(a, b, d, d, b, c);
      cellCount++;
    }
  }

  // Smooth normals from the grid gradient (supported nodes only).
  const normals = new Float32Array(n * 3);
  const z = (r: number, c: number) => {
    const rr = Math.min(size - 1, Math.max(0, r));
    const cc = Math.min(size - 1, Math.max(0, c));
    return positions[(rr * size + cc) * 3 + 2];
  };
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      const dx = (z(row, col + 1) - z(row, col - 1)) / (2 * step);
      const dy = (z(row - 1, col) - z(row + 1, col)) / (2 * step);
      const len = Math.hypot(dx, dy, 1);
      const i = (row * size + col) * 3;
      normals[i] = -dx / len;
      normals[i + 1] = -dy / len;
      normals[i + 2] = 1 / len;
    }
  }

  return { positions, normals, colors, texCoords, indices: Uint32Array.from(idx), cellCount };
}
