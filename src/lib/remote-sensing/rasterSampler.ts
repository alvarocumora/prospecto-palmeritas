import proj4 from "proj4";
import { fromUrl } from "geotiff";
import type { BandSample } from "@/lib/remote-sensing/anomalyEngine";

export type SentinelAssets = {
  b02: string;
  b04: string;
  b08: string;
  b11: string;
  b12: string;
  scl?: string;
};
export type Wgs84Point = { lat: number; lng: number };
export type SampleOptions = { windowRadiusPx?: number; maskClouds?: boolean };
export type SampledBands = { bands: BandSample; validPixels: number; maskedPixels: number };

const cloudy = new Set([0, 1, 3, 8, 9, 10, 11]);
const median = (v: number[]) => {
  const a = v.filter(Number.isFinite).sort((x, y) => x - y);
  if (!a.length) throw new Error("NO_VALID_PIXELS");
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
};

async function readWindow(url: string, point: Wgs84Point, radius: number) {
  const t = await fromUrl(url);
  const image = await t.getImage();
  const geo = image.getGeoKeys() as Record<string, unknown>;
  const epsg = Number(geo.ProjectedCSTypeGeoKey ?? geo.GeographicTypeGeoKey);
  if (!Number.isFinite(epsg)) throw new Error("RASTER_CRS_UNKNOWN");
  const [xw, yw] =
    epsg === 4326
      ? [point.lng, point.lat]
      : proj4("EPSG:4326", `EPSG:${epsg}`, [point.lng, point.lat]);
  const [ox, oy] = image.getOrigin(),
    [rx, ry] = image.getResolution();
  const x = Math.floor((xw - ox) / rx),
    y = Math.floor((yw - oy) / ry);
  const x0 = Math.max(0, x - radius),
    y0 = Math.max(0, y - radius),
    x1 = Math.min(image.getWidth(), x + radius + 1),
    y1 = Math.min(image.getHeight(), y + radius + 1);
  if (x0 >= x1 || y0 >= y1) throw new Error("POINT_OUTSIDE_RASTER");
  const r = await image.readRasters({ window: [x0, y0, x1, y1] });
  return { values: Array.from(r[0] as ArrayLike<number>, Number), epsg };
}
export async function sampleSentinelBands(
  assets: SentinelAssets,
  point: Wgs84Point,
  options: SampleOptions = {},
): Promise<SampledBands> {
  const radius = options.windowRadiusPx ?? 2;
  const [b02, b04, b08, b11, b12, scl] = await Promise.all([
    readWindow(assets.b02, point, radius),
    readWindow(assets.b04, point, radius),
    readWindow(assets.b08, point, radius),
    readWindow(assets.b11, point, radius),
    readWindow(assets.b12, point, radius),
    assets.scl ? readWindow(assets.scl, point, radius) : Promise.resolve(null),
  ]);
  const n = Math.min(
    b02.values.length,
    b04.values.length,
    b08.values.length,
    b11.values.length,
    b12.values.length,
  );
  const valid: number[] = [];
  for (let i = 0; i < n; i++) {
    if (options.maskClouds !== false && scl && cloudy.has(scl.values[i])) continue;
    valid.push(i);
  }
  if (!valid.length) throw new Error("NO_CLEAR_PIXELS");
  const pick = (v: number[]) => median(valid.map((i) => v[i]));
  return {
    bands: {
      b02: pick(b02.values),
      b04: pick(b04.values),
      b08: pick(b08.values),
      b11: pick(b11.values),
      b12: pick(b12.values),
    },
    validPixels: valid.length,
    maskedPixels: n - valid.length,
  };
}
