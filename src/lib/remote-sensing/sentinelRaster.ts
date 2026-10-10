import proj4 from "proj4";
import { fromUrl, type GeoTIFFImage, writeArrayBuffer } from "geotiff";
import { computeSpectralMetrics } from "./anomalyEngine";
import { validSatelliteBbox } from "../satellite/evidence";

export const SENTINEL_PIPELINE = "sentinel2-l2a-indices-v1";
export const SENTINEL_BANDS = ["B02", "B04", "B08", "B11", "B12", "SCL"] as const;
export type SentinelBand = (typeof SENTINEL_BANDS)[number];
export type RasterAsset = { href: string; scale: number; offset: number; nodata: number };
export type SentinelRasterScene = {
  id: string;
  datetime: string;
  cloudPct: number | null;
  stacHref: string;
  assets: Record<SentinelBand, RasterAsset>;
};
export type RasterGrid = {
  epsg: number;
  x: number;
  y: number;
  resolution: number;
  width: number;
  height: number;
};
export type BandWindow = {
  values: ArrayLike<number>;
  width: number;
  x: number;
  y: number;
  rx: number;
  ry: number;
  scale: number;
  offset: number;
  nodata: number;
};
export type IndexStats = { mean: number; min: number; max: number; count: number };
export type SentinelRasterResult = {
  grid: RasterGrid;
  stats: Record<string, IndexStats>;
  validPixels: number;
  excludedPixels: number;
  geoTiff: ArrayBuffer;
};
const NO_DATA = -9999;
export const INDEX_ORDER = ["ndvi", "ndmi", "ironOxideRatio", "swirContrast"] as const;

export function utmDefinition(epsg: number) {
  const north = epsg >= 32601 && epsg <= 32660;
  const south = epsg >= 32701 && epsg <= 32760;
  if (!north && !south) throw new Error("SENTINEL_UTM_CRS_REQUIRED");
  const name = `EPSG:${epsg}`;
  proj4.defs(
    name,
    `+proj=utm +zone=${epsg % 100} ${south ? "+south" : ""} +datum=WGS84 +units=m +no_defs`,
  );
  return name;
}

/** Exact spatial lookup: each band is sampled at the same 20 m grid centre. */
export function valueAt(band: BandWindow, x: number, y: number): number | null {
  const col = Math.floor((x - band.x) / band.rx);
  const row = Math.floor((y - band.y) / band.ry);
  if (col < 0 || col >= band.width || row < 0 || row * band.width + col >= band.values.length)
    return null;
  const raw = band.values[row * band.width + col];
  return !Number.isFinite(raw) || raw === band.nodata ? null : raw * band.scale + band.offset;
}

export function computeSentinelGrid(
  grid: RasterGrid,
  bands: Record<SentinelBand, BandWindow>,
  include: (x: number, y: number) => boolean = () => true,
) {
  const size = grid.width * grid.height;
  if (!Number.isInteger(size) || size < 1 || size > 1_000_000)
    throw new Error("AOI_EXCEEDS_ONE_MILLION_PIXELS");
  const values = new Float32Array(size * INDEX_ORDER.length).fill(NO_DATA);
  const aggregates = INDEX_ORDER.map(() => ({ sum: 0, min: Infinity, max: -Infinity, count: 0 }));
  let validPixels = 0;
  for (let row = 0; row < grid.height; row++)
    for (let col = 0; col < grid.width; col++) {
      const x = grid.x + (col + 0.5) * grid.resolution;
      const y = grid.y - (row + 0.5) * grid.resolution;
      if (!include(x, y)) continue;
      const scl = valueAt(bands.SCL, x, y);
      // Only vegetation and bare soil: excludes cloud, shadow, water, snow and uncertain classes.
      if (scl !== 4 && scl !== 5) continue;
      const raw = ["B02", "B04", "B08", "B11", "B12"].map((key) =>
        valueAt(bands[key as SentinelBand], x, y),
      );
      if (raw.some((v) => v == null || v <= 0)) continue;
      const [b02, b04, b08, b11, b12] = raw as number[];
      const metrics = computeSpectralMetrics({ b02, b04, b08, b11, b12 });
      if (INDEX_ORDER.some((key) => metrics[key] == null || !Number.isFinite(metrics[key])))
        continue;
      validPixels++;
      INDEX_ORDER.forEach((key, index) => {
        const value = metrics[key]!;
        values[(row * grid.width + col) * INDEX_ORDER.length + index] = value;
        const stat = aggregates[index];
        stat.sum += value;
        stat.min = Math.min(stat.min, value);
        stat.max = Math.max(stat.max, value);
        stat.count++;
      });
    }
  if (!validPixels) throw new Error("NO_CLEAR_VALID_PIXELS");
  const stats = Object.fromEntries(
    INDEX_ORDER.map((key, index) => {
      const s = aggregates[index];
      return [key, { mean: s.sum / s.count, min: s.min, max: s.max, count: s.count }];
    }),
  );
  return { values, stats, validPixels, excludedPixels: size - validPixels };
}

function imageCrs(image: GeoTIFFImage) {
  return Number(image.getGeoKeys()?.ProjectedCSTypeGeoKey);
}
async function readBand(
  image: GeoTIFFImage,
  grid: RasterGrid,
  asset: RasterAsset,
  signal?: AbortSignal,
): Promise<BandWindow> {
  if (imageCrs(image) !== grid.epsg) throw new Error("BAND_CRS_MISMATCH");
  const [ox, oy] = image.getOrigin();
  const [rx, ry] = image.getResolution();
  if (!(rx > 0 && ry < 0)) throw new Error("UNSUPPORTED_RASTER_ORIENTATION");
  const x0 = Math.max(0, Math.floor((grid.x - ox) / rx));
  const y0 = Math.max(0, Math.floor((grid.y - oy) / ry));
  const x1 = Math.min(
    image.getWidth(),
    Math.ceil((grid.x + grid.width * grid.resolution - ox) / rx),
  );
  const y1 = Math.min(
    image.getHeight(),
    Math.ceil((grid.y - grid.height * grid.resolution - oy) / ry),
  );
  if (x1 <= x0 || y1 <= y0) throw new Error("AOI_OUTSIDE_SCENE");
  if ((x1 - x0) * (y1 - y0) > 4_100_000) throw new Error("BAND_WINDOW_TOO_LARGE");
  const raster = await image.readRasters({ window: [x0, y0, x1, y1], samples: [0], signal });
  return {
    values: raster[0] as ArrayLike<number>,
    width: x1 - x0,
    x: ox + x0 * rx,
    y: oy + y0 * ry,
    rx,
    ry,
    scale: asset.scale,
    offset: asset.offset,
    nodata: asset.nodata,
  };
}

export function encodeSentinelGeoTiff(
  grid: RasterGrid,
  values: Float32Array,
  source: Record<string, unknown> = {},
) {
  const metadata = {
    width: grid.width,
    height: grid.height,
    SamplesPerPixel: 4,
    BitsPerSample: [32, 32, 32, 32],
    SampleFormat: [3, 3, 3, 3],
    PhotometricInterpretation: 1,
    ModelPixelScale: [grid.resolution, grid.resolution, 0],
    ModelTiepoint: [0, 0, 0, grid.x, grid.y, 0],
    GTModelTypeGeoKey: 1,
    GTRasterTypeGeoKey: 1,
    ProjectedCSTypeGeoKey: grid.epsg,
    GDAL_NODATA: String(NO_DATA),
    ImageDescription: JSON.stringify({
      pipeline: SENTINEL_PIPELINE,
      bands: INDEX_ORDER,
      provenance: "modelled",
      units: "dimensionless",
      resampling: "nearest grid centre",
      sclAccepted: [4, 5],
      source: { sceneId: source.sceneId, acquisitionDate: source.acquisitionDate },
    }),
  };
  // geotiff.js reserves a fixed 1000-byte IFD; keep its ASCII description bounded.
  if (new TextEncoder().encode(metadata.ImageDescription).length > 600)
    throw new Error("GEOTIFF_DESCRIPTION_TOO_LARGE");
  return writeArrayBuffer(values, metadata);
}

/** Real BOA raster computation. No catalog-only or synthetic success fallback. */
export async function processSentinelRaster(
  scene: SentinelRasterScene,
  bbox: [number, number, number, number],
  signal?: AbortSignal,
): Promise<SentinelRasterResult> {
  if (!validSatelliteBbox(bbox)) throw new Error("INVALID_AOI");
  const tiffs = [];
  try {
    // Open sequentially so a failed asset can still close previously opened resources.
    const images = {} as Record<SentinelBand, GeoTIFFImage>;
    for (const key of SENTINEL_BANDS) {
      const tiff = await fromUrl(scene.assets[key].href, {}, signal);
      tiffs.push(tiff);
      images[key] = await tiff.getImage();
    }
    const reference = images.B11;
    const epsg = imageCrs(reference);
    const crs = utmDefinition(epsg);
    const [ox, oy] = reference.getOrigin();
    const [rx, ry] = reference.getResolution();
    if (Math.abs(rx - 20) > 0.01 || Math.abs(ry + 20) > 0.01)
      throw new Error("EXPECTED_SENTINEL_20M_REFERENCE");
    const points: number[][] = [];
    for (let i = 0; i <= 16; i++) {
      const t = i / 16;
      const lng = bbox[0] + t * (bbox[2] - bbox[0]),
        lat = bbox[1] + t * (bbox[3] - bbox[1]);
      points.push(
        ...[
          [lng, bbox[1]],
          [lng, bbox[3]],
          [bbox[0], lat],
          [bbox[2], lat],
        ].map((p) => proj4("EPSG:4326", crs, p)),
      );
    }
    const minX = Math.min(...points.map((p) => p[0])),
      maxX = Math.max(...points.map((p) => p[0])),
      minY = Math.min(...points.map((p) => p[1])),
      maxY = Math.max(...points.map((p) => p[1]));
    const x = ox + Math.floor((minX - ox) / 20) * 20,
      y = oy - Math.floor((oy - maxY) / 20) * 20;
    const grid: RasterGrid = {
      epsg,
      x,
      y,
      resolution: 20,
      width: Math.ceil((maxX - x) / 20),
      height: Math.ceil((y - minY) / 20),
    };
    if (grid.width * grid.height > 1_000_000)
      throw new Error("AOI_EXCEEDS_ONE_MILLION_PIXELS_REDUCE_AREA");
    const windows = {} as Record<SentinelBand, BandWindow>;
    for (const key of SENTINEL_BANDS)
      windows[key] = await readBand(images[key], grid, scene.assets[key], signal);
    const inverse = proj4(crs, "EPSG:4326");
    const result = computeSentinelGrid(grid, windows, (x, y) => {
      const [lng, lat] = inverse.forward([x, y]);
      return lng >= bbox[0] && lng <= bbox[2] && lat >= bbox[1] && lat <= bbox[3];
    });
    return {
      grid,
      stats: result.stats,
      validPixels: result.validPixels,
      excludedPixels: result.excludedPixels,
      geoTiff: encodeSentinelGeoTiff(grid, result.values, {
        sceneId: scene.id,
        acquisitionDate: scene.datetime,
        stacHref: scene.stacHref,
        bboxWgs84: bbox,
        radiometry: Object.fromEntries(
          Object.entries(scene.assets).map(([key, asset]) => [
            key,
            {
              href: asset.href.split("?")[0],
              scale: asset.scale,
              offset: asset.offset,
              nodata: asset.nodata,
            },
          ]),
        ),
      }),
    };
  } finally {
    await Promise.allSettled(tiffs.map((tiff) => tiff.close()));
  }
}
