import { beforeEach, describe, expect, it, vi } from "vitest";
import { fromArrayBuffer, writeArrayBuffer } from "geotiff";
import proj4 from "proj4";
import {
  computeSentinelGrid,
  encodeSentinelGeoTiff,
  processSentinelRaster,
  SENTINEL_BANDS,
  utmDefinition,
  valueAt,
  type BandWindow,
  type SentinelBand,
  type SentinelRasterScene,
} from "./sentinelRaster";
import { parseSentinelRadiometry, trustedSentinelAsset } from "./sentinelScene.server";
const fixtures = vi.hoisted(() => new Map<string, ArrayBuffer>());
vi.mock("geotiff", async (importOriginal) => {
  const actual = await importOriginal<typeof import("geotiff")>();
  return {
    ...actual,
    fromUrl: vi.fn(async (url: string) => {
      const bytes = fixtures.get(url);
      if (!bytes) throw new Error("ASSET_UNAVAILABLE");
      return actual.fromArrayBuffer(bytes);
    }),
  };
});
beforeEach(() => fixtures.clear());
const band = (values: number[], width = 2, rx = 20): BandWindow => ({
  values,
  width,
  x: 0,
  y: 40,
  rx,
  ry: -rx,
  scale: 0.0001,
  offset: -0.1,
  nodata: 0,
});
const grid = { epsg: 32719, x: 0, y: 40, resolution: 20, width: 2, height: 2 };
function windows(): Record<SentinelBand, BandWindow> {
  return {
    B02: band([2000, 2000, 2000, 2000]),
    B04: band([3000, 3000, 3000, 3000]),
    B08: band([5000, 5000, 5000, 5000]),
    B11: band([4000, 4000, 4000, 4000]),
    B12: band([2500, 2500, 2500, 2500]),
    SCL: { ...band([5, 9, 4, 5]), scale: 1, offset: 0 },
  };
}
describe("real raster indices", () => {
  it("aligns mixed native resolutions by spatial coordinate, not array position", () => {
    const fine = {
      ...band(
        Array.from({ length: 16 }, (_, i) => 1000 + i * 100),
        4,
        10,
      ),
    };
    expect(valueAt(fine, 10, 30)).toBeCloseTo(0.05);
    expect(valueAt(fine, 30, 10)).toBeCloseTo(0.15);
    expect(valueAt(fine, -1, 30)).toBeNull();
  });
  it("uses BOA scale/offset, excludes cloud and nodata, and computes actual ratios", () => {
    const result = computeSentinelGrid(grid, windows());
    expect(result.validPixels).toBe(3);
    expect(result.excludedPixels).toBe(1);
    expect(result.stats.ndvi.mean).toBeCloseTo(1 / 3);
    expect(result.stats.ironOxideRatio.mean).toBeCloseTo(2);
    expect(result.values[4]).toBe(-9999);
    const input = windows();
    input.B02.values = [0, 2000, 2000, 2000];
    expect(computeSentinelGrid(grid, input).validPixels).toBe(2);
  });
  it("fails when every cell is cloudy rather than inventing a successful result", () => {
    const input = windows();
    input.SCL.values = [9, 9, 9, 9];
    expect(() => computeSentinelGrid(grid, input)).toThrow("NO_CLEAR_VALID_PIXELS");
  });
  it("round-trips four float bands, nodata, CRS and georeferencing into a real GeoTIFF", async () => {
    const result = computeSentinelGrid(grid, windows());
    const bytes = encodeSentinelGeoTiff(grid, result.values, {
      sceneId: "fixture-scene",
      acquisitionDate: "2025-01-01T00:00:00Z",
    });
    const tiff = await fromArrayBuffer(bytes);
    const image = await tiff.getImage();
    expect(
      JSON.parse(
        String(await image.fileDirectory.loadValue("ImageDescription")).replace(/\0+$/g, ""),
      ).source.sceneId,
    ).toBe("fixture-scene");
    expect(image.getSamplesPerPixel()).toBe(4);
    expect(image.getGeoKeys()?.ProjectedCSTypeGeoKey).toBe(32719);
    expect(image.getGDALNoData()).toBe(-9999);
    const raster = await image.readRasters({ interleave: true });
    expect(Array.from(raster)).toEqual(Array.from(result.values));
    await tiff.close();
  });
  it("executes the complete reader and common-grid computation on mixed-resolution GeoTIFF assets", async () => {
    const x = 300000,
      y = 6300040;
    utmDefinition(32719);
    const values: Record<SentinelBand, number> = {
      B02: 2000,
      B04: 3000,
      B08: 5000,
      B11: 4000,
      B12: 2500,
      SCL: 5,
    };
    const assets = {} as SentinelRasterScene["assets"];
    for (const key of SENTINEL_BANDS) {
      const resolution = ["B02", "B04", "B08"].includes(key) ? 10 : 20,
        width = 80 / resolution;
      const href = `https://fixture.test/${key}.tif`;
      fixtures.set(
        href,
        writeArrayBuffer(new Uint16Array(width * width).fill(values[key]), {
          width,
          height: width,
          ModelPixelScale: [resolution, resolution, 0],
          ModelTiepoint: [0, 0, 0, x, y, 0],
          GTModelTypeGeoKey: 1,
          GTRasterTypeGeoKey: 1,
          ProjectedCSTypeGeoKey: 32719,
        }),
      );
      assets[key] = {
        href,
        scale: key === "SCL" ? 1 : 0.0001,
        offset: key === "SCL" ? 0 : -0.1,
        nodata: 0,
      };
    }
    const lower = proj4("EPSG:32719", "EPSG:4326", [x + 20, y - 60]),
      upper = proj4("EPSG:32719", "EPSG:4326", [x + 60, y - 20]);
    const result = await processSentinelRaster(
      { id: "fixture", datetime: "2025-01-01", cloudPct: 0, stacHref: "fixture", assets },
      [lower[0], lower[1], upper[0], upper[1]],
    );
    expect(result.validPixels).toBeGreaterThan(0);
    expect(result.stats.ndvi.mean).toBeCloseTo(1 / 3);
    expect(result.grid.resolution).toBe(20);
    expect(result.geoTiff.byteLength).toBeGreaterThan(0);
  });
});
describe("source radiometry and trusted asset boundary", () => {
  it("reads per-band XML offsets and refuses missing offsets on newer baselines", () => {
    const xml =
      '<BOA_QUANTIFICATION_VALUE unit="none">10000</BOA_QUANTIFICATION_VALUE>' +
      [1, 3, 7, 11, 12]
        .map((id) => `<BOA_ADD_OFFSET band_id="${id}">-1000</BOA_ADD_OFFSET>`)
        .join("");
    expect(parseSentinelRadiometry(xml, "05.11").B02).toEqual({
      scale: 0.0001,
      offset: -0.1,
      nodata: 0,
    });
    expect(() =>
      parseSentinelRadiometry(
        "<BOA_QUANTIFICATION_VALUE>10000</BOA_QUANTIFICATION_VALUE>",
        "05.11",
      ),
    ).toThrow("MISSING_BOA_OFFSET");
    expect(
      parseSentinelRadiometry("<BOA_QUANTIFICATION_VALUE>10000</BOA_QUANTIFICATION_VALUE>", "03.00")
        .B02.offset,
    ).toBe(0);
  });
  it("refuses arbitrary asset URLs and lookalike hosts", () => {
    expect(() => trustedSentinelAsset("http://127.0.0.1/private")).toThrow("UNTRUSTED");
    expect(() =>
      trustedSentinelAsset("https://sentinel2l2a01.blob.core.windows.net.evil.test/a.tif"),
    ).toThrow("UNTRUSTED");
  });
});
