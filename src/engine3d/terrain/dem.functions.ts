// Server function: devuelve un heightmap regular (Float32) para alimentar Martini.
//
// Por ahora genera un DEM procedural realista (multi-octava) centrado en el
// proyecto. Cuando exista un endpoint GeoTIFF de Copernicus/SRTM, este archivo
// es el único que cambia: parsear con @loaders.gl/geotiff y devolver el mismo
// shape (heightmap cuadrado tamaño 2^n+1).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const InputSchema = z.object({
  projectId: z.string().uuid(),
  /** Tamaño del grid (debe ser potencia de 2 + 1 para Martini). */
  size: z.number().int().min(65).max(1025).optional(),
  /** Extensión en metros del lado del tile. */
  extentMeters: z.number().min(500).max(20000).optional(),
});

export type DemTile = {
  /** Heightmap row-major, tamaño size*size. Altura en metros (relativa al centro). */
  heights: number[];
  size: number;
  extentMeters: number;
  minH: number;
  maxH: number;
};

// Hash 2D rápido (deterministic noise)
function hash2(x: number, y: number, seed: number): number {
  const h = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453;
  return h - Math.floor(h);
}
function smoothNoise(x: number, y: number, seed: number): number {
  const ix = Math.floor(x),
    iy = Math.floor(y);
  const fx = x - ix,
    fy = y - iy;
  const a = hash2(ix, iy, seed);
  const b = hash2(ix + 1, iy, seed);
  const c = hash2(ix, iy + 1, seed);
  const d = hash2(ix + 1, iy + 1, seed);
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  return a * (1 - ux) * (1 - uy) + b * ux * (1 - uy) + c * (1 - ux) * uy + d * ux * uy;
}
function fbm(x: number, y: number, seed: number, octaves = 5): number {
  let v = 0,
    amp = 0.5,
    freq = 1;
  for (let i = 0; i < octaves; i++) {
    v += amp * smoothNoise(x * freq, y * freq, seed + i * 17);
    amp *= 0.5;
    freq *= 2.05;
  }
  return v;
}

export const getDemTile = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data }) => {
    // Determinístico por projectId para que el DEM sea estable entre sesiones.
    const seedBase = Array.from(data.projectId).reduce((s, c) => (s * 31 + c.charCodeAt(0)) | 0, 7);
    const seed = (seedBase % 10000) / 100;

    const size = data.size ?? 257;
    const extent = data.extentMeters ?? 4000;
    const heights: number[] = new Array(size * size);
    let minH = Infinity,
      maxH = -Infinity;

    // Cordillera/relieve cordillerano sintético: ridge noise + valle central
    for (let j = 0; j < size; j++) {
      for (let i = 0; i < size; i++) {
        const u = i / (size - 1);
        const v = j / (size - 1);
        // Ridge noise
        const r1 = 1 - Math.abs(2 * fbm(u * 3, v * 3, seed) - 1);
        const r2 = fbm(u * 6, v * 6, seed + 100) * 0.5;
        // Forma cordillera centrada
        const cx = u - 0.5,
          cy = v - 0.5;
        const dist = Math.sqrt(cx * cx + cy * cy);
        const macro = Math.exp(-dist * 1.8) * 0.7 + 0.3;
        const h = (r1 * 0.7 + r2 * 0.3) * macro * 600 - 50;
        heights[j * size + i] = h;
        if (h < minH) minH = h;
        if (h > maxH) maxH = h;
      }
    }

    return {
      heights,
      size,
      extentMeters: extent,
      minH,
      maxH,
    } satisfies DemTile;
  });
