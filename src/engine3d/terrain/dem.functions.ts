// Server function: devuelve un heightmap regular (Float32) para alimentar Martini.
//
// Fuente primaria: Copernicus DEM GLO-30 (COG público en AWS Open Data,
// resolución ~30 m, sin API key) leído con range-requests vía `geotiff`.
// Fallback: DEM procedural multi-octava determinístico por projectId, para
// proyectos sin coordenadas o si el tile remoto no responde.
import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { fromUrl } from "geotiff";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import { terrainGridCoordinate } from "@/lib/geospatial/terrainCoordinates";

const InputSchema = z.object({
  projectId: z.string().uuid(),
  /** Tamaño del grid (debe ser potencia de 2 + 1 para Martini). */
  size: z.number().int().min(65).max(1025).optional(),
  /** Extensión en metros del lado del tile. */
  extentMeters: z.number().min(500).max(20000).optional(),
  /** Centro explícito para subáreas (p. ej. una concesión); si falta, usa el centro del proyecto. */
  centerLat: z.number().min(-90).max(90).optional(),
  centerLng: z.number().min(-180).max(180).optional(),
});

export type DemTile = {
  /** Heightmap row-major, tamaño size*size. Altura en metros (relativa al centro). */
  heights: number[];
  size: number;
  extentMeters: number;
  minH: number;
  maxH: number;
  /** Centro geográfico real del parche solicitado. */
  centerLat: number | null;
  centerLng: number | null;
  /** Elevación absoluta del píxel central en Copernicus; null en fallback sintético. */
  centerElevationM: number | null;
  /** "copernicus" = GLO-30 real; "synthetic" = fallback procedural. */
  source: "copernicus" | "synthetic";
};

// Cache en memoria del proceso: los DEM son estáticos.
const demCache = new Map<string, DemTile>();

// ── Copernicus GLO-30 (AWS Open Data) ─────────────────────────────────────────

export function copernicusTileUrl(lat: number, lng: number): string {
  const latFloor = Math.floor(lat);
  const lngFloor = Math.floor(lng);
  const ns = latFloor >= 0 ? "N" : "S";
  const ew = lngFloor >= 0 ? "E" : "W";
  const latStr = String(Math.abs(latFloor)).padStart(2, "0");
  const lngStr = String(Math.abs(lngFloor)).padStart(3, "0");
  const name = `Copernicus_DSM_COG_10_${ns}${latStr}_00_${ew}${lngStr}_00_DEM`;
  return `https://copernicus-dem-30m.s3.amazonaws.com/${name}/${name}.tif`;
}

/** Read every source tile touched by the requested grid; never stretch a cropped tile. */
export async function fetchCopernicusDem(
  lat: number,
  lng: number,
  size: number,
  extentMeters: number,
): Promise<DemTile | null> {
  try {
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) >= 85) return null;
    type Patch = {
      lat: number;
      lng: number;
      minI: number;
      maxI: number;
      minJ: number;
      maxJ: number;
    };
    const patches = new Map<string, Patch>();
    for (let j = 0; j < size; j++) {
      for (let i = 0; i < size; i++) {
        const [x, y] = terrainGridCoordinate(lat, lng, size, extentMeters, i, j);
        if (Math.abs(x) > 180 || Math.abs(y) >= 90) return null;
        const tileLng = Math.floor(x),
          tileLat = Math.floor(y);
        const key = `${tileLat}:${tileLng}`;
        const patch = patches.get(key);
        if (patch) {
          patch.minI = Math.min(patch.minI, i);
          patch.maxI = Math.max(patch.maxI, i);
          patch.minJ = Math.min(patch.minJ, j);
          patch.maxJ = Math.max(patch.maxJ, j);
        } else {
          patches.set(key, { lat: tileLat, lng: tileLng, minI: i, maxI: i, minJ: j, maxJ: j });
        }
      }
    }
    if (patches.size > 9) return null;
    const absolute = new Float64Array(size * size).fill(NaN);
    // Sequential source reads bound memory when a grid crosses multiple tiles.
    for (const patch of patches.values()) {
      const tiff = await fromUrl(copernicusTileUrl(patch.lat + 0.5, patch.lng + 0.5));
      const image = await tiff.getImage();
      const keys = image.getGeoKeys();
      if (!keys || Number(keys.GeographicTypeGeoKey) !== 4326) return null;
      const [ox, oy] = image.getOrigin();
      const [rx, ry] = image.getResolution();
      if (!(rx > 0 && ry < 0)) return null;
      const pixelOffset = Number(keys.GTRasterTypeGeoKey) === 2 ? 0 : 0.5;
      const [west, north] = terrainGridCoordinate(
        lat,
        lng,
        size,
        extentMeters,
        patch.minI,
        patch.minJ,
      );
      const [east, south] = terrainGridCoordinate(
        lat,
        lng,
        size,
        extentMeters,
        patch.maxI,
        patch.maxJ,
      );
      const pixelX = (x: number) => (x - ox) / rx - pixelOffset;
      const pixelY = (y: number) => (y - oy) / ry - pixelOffset;
      const x0 = Math.max(0, Math.floor(pixelX(west)));
      const y0 = Math.max(0, Math.floor(pixelY(north)));
      const x1 = Math.min(image.getWidth(), Math.floor(pixelX(east)) + 2);
      const y1 = Math.min(image.getHeight(), Math.floor(pixelY(south)) + 2);
      const width = x1 - x0,
        height = y1 - y0;
      if (width < 1 || height < 1 || width * height > 4_000_000) return null;
      const rasters = await image.readRasters({ window: [x0, y0, x1, y1], samples: [0] });
      const band = rasters[0];
      if (typeof band === "number" || band.length !== width * height) return null;
      const nodata = image.getGDALNoData();
      for (let j = patch.minJ; j <= patch.maxJ; j++) {
        for (let i = patch.minI; i <= patch.maxI; i++) {
          const [x, y] = terrainGridCoordinate(lat, lng, size, extentMeters, i, j);
          const px = Math.max(0, Math.min(image.getWidth() - 1, pixelX(x))) - x0;
          const py = Math.max(0, Math.min(image.getHeight() - 1, pixelY(y))) - y0;
          const a = Math.floor(px),
            b = Math.floor(py);
          const c = Math.min(width - 1, a + 1),
            d = Math.min(height - 1, b + 1);
          const values = [
            Number(band[b * width + a]),
            Number(band[b * width + c]),
            Number(band[d * width + a]),
            Number(band[d * width + c]),
          ];
          if (!values.every((v) => Number.isFinite(v) && (nodata == null || v !== nodata)))
            return null;
          const fx = px - a,
            fy = py - b;
          absolute[j * size + i] =
            (values[0] * (1 - fx) + values[1] * fx) * (1 - fy) +
            (values[2] * (1 - fx) + values[3] * fx) * fy;
        }
      }
    }
    const centerH = absolute[Math.floor(size / 2) * size + Math.floor(size / 2)];
    if (!Number.isFinite(centerH)) return null;
    const heights = Array.from(absolute, (h) => h - centerH);
    let minH = Infinity,
      maxH = -Infinity;
    for (const h of heights) {
      if (!Number.isFinite(h)) return null;
      minH = Math.min(minH, h);
      maxH = Math.max(maxH, h);
    }
    return {
      heights,
      size,
      extentMeters,
      minH,
      maxH,
      centerLat: lat,
      centerLng: lng,
      centerElevationM: centerH,
      source: "copernicus",
    };
  } catch {
    return null;
  }
}

// ── Fallback procedural (determinístico por projectId) ────────────────────────

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

function syntheticDem(
  projectId: string,
  size: number,
  extentMeters: number,
  center: { lat: number; lng: number } | null,
): DemTile {
  // Determinístico por projectId para que el DEM sea estable entre sesiones.
  const seedBase = Array.from(projectId).reduce((s, c) => (s * 31 + c.charCodeAt(0)) | 0, 7);
  const seed = (seedBase % 10000) / 100;

  const heights: number[] = new Array(size * size);
  let minH = Infinity,
    maxH = -Infinity;

  // Cordillera/relieve cordillerano sintético: ridge noise + valle central
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const u = i / (size - 1);
      const v = j / (size - 1);
      const r1 = 1 - Math.abs(2 * fbm(u * 3, v * 3, seed) - 1);
      const r2 = fbm(u * 6, v * 6, seed + 100) * 0.5;
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
    extentMeters,
    minH,
    maxH,
    centerLat: center?.lat ?? null,
    centerLng: center?.lng ?? null,
    centerElevationM: null,
    source: "synthetic",
  };
}

// ── Server function ───────────────────────────────────────────────────────────

export const getDemTile = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data }) => {
    const size = data.size ?? 257;
    const extent = data.extentMeters ?? 4000;
    const explicitCenter =
      data.centerLat != null && data.centerLng != null
        ? { lat: data.centerLat, lng: data.centerLng }
        : null;
    const cacheKey = `${data.projectId}:${size}:${extent}:${explicitCenter?.lat ?? "project"}:${explicitCenter?.lng ?? "project"}`;
    const cached = demCache.get(cacheKey);
    if (cached) return cached;

    // Centro explícito de subárea o, por defecto, centro del proyecto.
    let center: { lat: number; lng: number } | null = explicitCenter;
    if (!center) {
      try {
        const supabase = createClient<Database>(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_PUBLISHABLE_KEY!,
          { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
        );
        const { data: proj } = await supabase
          .from("projects")
          .select("center_lat, center_lng")
          .eq("id", data.projectId)
          .maybeSingle();
        if (proj?.center_lat != null && proj?.center_lng != null) {
          center = { lat: Number(proj.center_lat), lng: Number(proj.center_lng) };
        }
      } catch {
        center = null;
      }
    }

    let tile: DemTile | null = null;
    if (center) {
      tile = await fetchCopernicusDem(center.lat, center.lng, size, extent);
    }
    if (!tile) {
      tile = syntheticDem(data.projectId, size, extent, center);
    }

    if (tile.source === "copernicus") demCache.set(cacheKey, tile);
    return tile;
  });
