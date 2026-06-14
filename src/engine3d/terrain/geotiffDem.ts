// GeoTIFF DEM loader — convierte un raster GeoTIFF subido por el usuario en un
// heightmap compatible con el worker de Martini.
// Usa la librería `geotiff` que decodifica en cliente sin dependencias nativas.
import { fromArrayBuffer, type GeoTIFFImage } from "geotiff";

export type DemHeightmap = {
  width: number;
  height: number;
  /** Float32Array length = width*height. */
  data: Float32Array;
  /** Bounding box [west, south, east, north]. */
  bbox: [number, number, number, number];
  /** Resolución original (m por pixel) si está disponible. */
  resolution?: { x: number; y: number };
  noData?: number;
};

export async function loadGeoTiffDem(file: File): Promise<DemHeightmap> {
  const buf = await file.arrayBuffer();
  const tiff = await fromArrayBuffer(buf);
  const image: GeoTIFFImage = await tiff.getImage();
  const width = image.getWidth();
  const height = image.getHeight();
  const rasters = await image.readRasters({ interleave: false });
  const band = rasters[0] as ArrayLike<number>;
  const data = new Float32Array(width * height);
  for (let i = 0; i < data.length; i++) data[i] = Number(band[i]);

  const bbox = image.getBoundingBox() as [number, number, number, number];
  let resolution: { x: number; y: number } | undefined;
  try {
    const r = image.getResolution() as number[];
    resolution = { x: Math.abs(r[0]), y: Math.abs(r[1]) };
  } catch {
    resolution = undefined;
  }
  const noData = image.getGDALNoData();
  if (noData != null) {
    for (let i = 0; i < data.length; i++) if (data[i] === noData) data[i] = NaN;
  }
  return {
    width,
    height,
    data,
    bbox,
    resolution,
    noData: noData ?? undefined,
  };
}

/** Convierte un DemHeightmap a la entrada del worker Martini (grid potencia de 2 + 1). */
export function heightmapToMartiniGrid(
  dem: DemHeightmap,
  targetSize = 257,
): { size: number; data: Float32Array; min: number; max: number } {
  const size = targetSize;
  const out = new Float32Array(size * size);
  // Bilinear resample
  let min = Infinity,
    max = -Infinity;
  for (let y = 0; y < size; y++) {
    const v = (y / (size - 1)) * (dem.height - 1);
    const y0 = Math.floor(v);
    const y1 = Math.min(dem.height - 1, y0 + 1);
    const ty = v - y0;
    for (let x = 0; x < size; x++) {
      const u = (x / (size - 1)) * (dem.width - 1);
      const x0 = Math.floor(u);
      const x1 = Math.min(dem.width - 1, x0 + 1);
      const tx = u - x0;
      const a = dem.data[y0 * dem.width + x0];
      const b = dem.data[y0 * dem.width + x1];
      const c = dem.data[y1 * dem.width + x0];
      const d = dem.data[y1 * dem.width + x1];
      const safeA = Number.isFinite(a) ? a : 0;
      const safeB = Number.isFinite(b) ? b : safeA;
      const safeC = Number.isFinite(c) ? c : safeA;
      const safeD = Number.isFinite(d) ? d : safeA;
      const top = safeA * (1 - tx) + safeB * tx;
      const bot = safeC * (1 - tx) + safeD * tx;
      const z = top * (1 - ty) + bot * ty;
      out[y * size + x] = z;
      if (z < min) min = z;
      if (z > max) max = z;
    }
  }
  return { size, data: out, min, max };
}
