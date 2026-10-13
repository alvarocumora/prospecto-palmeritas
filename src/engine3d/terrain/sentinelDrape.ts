import proj4 from "proj4";
import { fromArrayBuffer } from "geotiff";
import * as THREE from "three";
import type { DemTile } from "./dem.functions";

const METERS_PER_DEGREE = 111_320;

/** Reprojects the stored Sentinel RGB raster onto the DEM's local terrain grid. */
export async function loadSentinelDrapeTexture(
  url: string,
  tile: DemTile,
): Promise<THREE.CanvasTexture> {
  if (tile.source !== "copernicus" || tile.centerLat == null || tile.centerLng == null)
    throw new Error("REAL_TERRAIN_REQUIRED_FOR_SENTINEL_DRAPE");
  const response = await fetch(url);
  if (!response.ok) throw new Error(`SENTINEL_RGB_${response.status}`);
  const tiff = await fromArrayBuffer(await response.arrayBuffer());
  try {
    const image = await tiff.getImage();
    const epsg = Number(image.getGeoKeys()?.ProjectedCSTypeGeoKey);
    const south = epsg >= 32701 && epsg <= 32760;
    const north = epsg >= 32601 && epsg <= 32660;
    if (!south && !north) throw new Error("SENTINEL_RGB_UTM_CRS_REQUIRED");
    const zone = epsg % 100;
    const crs = `EPSG:${epsg}`;
    proj4.defs(
      crs,
      `+proj=utm +zone=${zone} ${south ? "+south " : ""}+datum=WGS84 +units=m +no_defs`,
    );
    const [originX, originY] = image.getOrigin();
    const [resolutionX, resolutionY] = image.getResolution();
    if (!(resolutionX > 0 && resolutionY < 0) || image.getSamplesPerPixel() !== 4)
      throw new Error("SENTINEL_RGB_LAYOUT_UNSUPPORTED");
    const raster = (await image.readRasters({ interleave: true })) as Uint8Array;
    const rasterWidth = image.getWidth();
    const rasterHeight = image.getHeight();
    const canvas = document.createElement("canvas");
    const size = 512;
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("CANVAS_CONTEXT_UNAVAILABLE");
    const pixels = context.createImageData(size, size);
    const cosine = Math.cos((tile.centerLat * Math.PI) / 180);
    for (let row = 0; row < size; row++) {
      const northing = (0.5 - (row + 0.5) / size) * tile.extentMeters;
      const lat = tile.centerLat + northing / METERS_PER_DEGREE;
      for (let col = 0; col < size; col++) {
        const easting = ((col + 0.5) / size - 0.5) * tile.extentMeters;
        const lng = tile.centerLng + easting / (METERS_PER_DEGREE * cosine);
        const [x, y] = proj4("EPSG:4326", crs, [lng, lat]);
        const sourceCol = Math.floor((x - originX) / resolutionX);
        const sourceRow = Math.floor((originY - y) / -resolutionY);
        if (sourceCol < 0 || sourceCol >= rasterWidth || sourceRow < 0 || sourceRow >= rasterHeight)
          continue;
        const source = (sourceRow * rasterWidth + sourceCol) * 4;
        const target = (row * size + col) * 4;
        pixels.data[target] = raster[source];
        pixels.data[target + 1] = raster[source + 1];
        pixels.data[target + 2] = raster[source + 2];
        pixels.data[target + 3] = raster[source + 3];
      }
    }
    context.putImageData(pixels, 0, 0);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.generateMipmaps = true;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.needsUpdate = true;
    return texture;
  } finally {
    await tiff.close();
  }
}
