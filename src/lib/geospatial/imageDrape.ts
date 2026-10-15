import * as THREE from "three";
import type { TerrainTile } from "./terrainTile";
import { terrainGridCoordinate } from "./terrainCoordinates";

export type GeoreferencedImageDrape = {
  url: string;
  bbox: readonly number[];
  attribution: string;
  source: string;
};

/** EPSG:4326 image → local metric terrain, honoring the export's actual extent. */
export async function loadImageDrape(image: GeoreferencedImageDrape, tile: TerrainTile) {
  if (tile.source === "synthetic" || tile.centerLat == null || tile.centerLng == null)
    throw new Error("GEOREFERENCED_TERRAIN_REQUIRED");
  const [west, south, east, north] = image.bbox;
  if (image.bbox.length !== 4 || !image.bbox.every(Number.isFinite) || east <= west || north <= south)
    throw new Error("INVALID_IMAGE_EXTENT");
  const response = await fetch(image.url);
  if (!response.ok) throw new Error("SATELLITE_IMAGE_UNAVAILABLE");
  const bitmap = await createImageBitmap(await response.blob());
  try {
    const size = 2048;
    const canvas = document.createElement("canvas");
    canvas.width = size; canvas.height = size;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("CANVAS_UNAVAILABLE");
    const source = document.createElement("canvas");
    source.width = bitmap.width; source.height = bitmap.height;
    const sourceContext = source.getContext("2d");
    if (!sourceContext) throw new Error("CANVAS_UNAVAILABLE");
    sourceContext.drawImage(bitmap, 0, 0);
    const pixels = sourceContext.getImageData(0, 0, bitmap.width, bitmap.height);
    const output = context.createImageData(size, size);
    for (let row = 0; row < size; row++) {
      for (let column = 0; column < size; column++) {
        const [lng, lat] = terrainGridCoordinate(tile.centerLat, tile.centerLng, size + 1,
          tile.extentMeters, column + 0.5, row + 0.5);
        const x = Math.floor((lng - west) / (east - west) * bitmap.width);
        const y = Math.floor((north - lat) / (north - south) * bitmap.height);
        if (x < 0 || y < 0 || x >= bitmap.width || y >= bitmap.height) continue;
        const from = (y * bitmap.width + x) * 4, to = (row * size + column) * 4;
        output.data.set(pixels.data.subarray(from, from + 4), to);
      }
    }
    context.putImageData(output, 0, 0);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    return texture;
  } finally { bitmap.close(); }
}