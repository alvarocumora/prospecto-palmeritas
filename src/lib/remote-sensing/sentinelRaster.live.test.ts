// @vitest-environment node
import { it, expect } from "vitest";
import { loadSentinelRasterScene } from "./sentinelScene.server";
import { processSentinelRaster } from "./sentinelRaster";
import { writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { fromArrayBuffer } from "geotiff";
it.skipIf(process.env.RUN_SENTINEL_LIVE !== "1")(
  "processes a public Sentinel-2 scene into real reflectance indices",
  async () => {
    const scene = await loadSentinelRasterScene(
      "S2B_MSIL2A_20250323T143749_R096_T19HCC_20250323T180942",
      AbortSignal.timeout(180000),
    );
    const result = await processSentinelRaster(
      scene,
      [-71.05, -33.91, -71.02, -33.88],
      AbortSignal.timeout(180000),
    );
    const sha256 = createHash("sha256").update(new Uint8Array(result.geoTiff)).digest("hex");
    writeFileSync("/tmp/geocapitals-sentinel-real.tif", new Uint8Array(result.geoTiff));
    writeFileSync(
      "/tmp/geocapitals-sentinel-real.json",
      JSON.stringify(
        {
          sceneId: scene.id,
          datetime: scene.datetime,
          stacHref: scene.stacHref,
          grid: result.grid,
          stats: result.stats,
          validPixels: result.validPixels,
          excludedPixels: result.excludedPixels,
          sha256,
          bytes: result.geoTiff.byteLength,
          provenance: "modelled",
          radiometry: Object.fromEntries(
            Object.entries(scene.assets).map(([key, a]) => [
              key,
              { scale: a.scale, offset: a.offset, nodata: a.nodata },
            ]),
          ),
        },
        null,
        2,
      ),
    );
    expect(result.validPixels).toBeGreaterThan(0);
    const tiff = await fromArrayBuffer(result.geoTiff);
    const image = await tiff.getImage();
    expect(image.getSamplesPerPixel()).toBe(4);
    expect(
      JSON.parse(
        String(await image.fileDirectory.loadValue("ImageDescription")).replace(/\0+$/g, ""),
      ).source.sceneId,
    ).toBe(scene.id);
    await tiff.close();
  },
  360000,
);
