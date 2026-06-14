// Web Mercator tile math + stitcher para basemaps XYZ (ESRI / OSM / Topo).
// Devuelve un HTMLCanvasElement con las tiles compuestas, y la bbox real
// en lng/lat de la región cubierta — para mapear UVs sobre planos o DEM.

export type BasemapSource = "esri" | "osm" | "topo" | "none";

export type TileGrid = {
  canvas: HTMLCanvasElement;
  /** bbox real cubierta por el canvas (en lng/lat). */
  lngMin: number;
  lngMax: number;
  latMin: number;
  latMax: number;
  /** bbox en metros ENU relativos al centro del proyecto. */
  enuMinX: number;
  enuMaxX: number;
  enuMinY: number;
  enuMaxY: number;
  zoom: number;
  source: BasemapSource;
  failed: boolean;
};

const TILE_TEMPLATES: Record<Exclude<BasemapSource, "none">, string> = {
  esri: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  osm: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  topo: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}",
};

function lngLatToTile(lng: number, lat: number, z: number) {
  const n = 2 ** z;
  const x = Math.floor(((lng + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n);
  return { x, y };
}

function tileToLngLat(x: number, y: number, z: number) {
  const n = 2 ** z;
  const lng = (x / n) * 360 - 180;
  const latRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n)));
  return { lng, lat: (latRad * 180) / Math.PI };
}

function lngLatToEnu(lng: number, lat: number, centerLng: number, centerLat: number) {
  const R = 6378137;
  const dLat = ((lat - centerLat) * Math.PI) / 180;
  const dLng = ((lng - centerLng) * Math.PI) / 180;
  return {
    x: dLng * R * Math.cos((centerLat * Math.PI) / 180),
    y: dLat * R,
  };
}

function pickZoom(extentMeters: number, lat: number) {
  // metros por pixel a lat: 156543.03 * cos(lat) / 2^z; queremos cubrir extent con ~4 tiles
  const target = extentMeters / 4; // metros por tile aprox
  const z = Math.log2((256 * 156543.03 * Math.cos((lat * Math.PI) / 180)) / target);
  return Math.max(2, Math.min(18, Math.round(z)));
}

function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

export async function buildBasemapTexture(
  source: BasemapSource,
  centerLng: number,
  centerLat: number,
  extentMeters: number,
): Promise<TileGrid | null> {
  if (source === "none") return null;
  const template = TILE_TEMPLATES[source];

  const z = pickZoom(extentMeters, centerLat);
  // Esquinas geográficas del cuadro del proyecto
  const R = 6378137;
  const dLat = (extentMeters / 2 / R) * (180 / Math.PI);
  const dLng = (extentMeters / 2 / (R * Math.cos((centerLat * Math.PI) / 180))) * (180 / Math.PI);

  const minLng = centerLng - dLng;
  const maxLng = centerLng + dLng;
  const minLat = centerLat - dLat;
  const maxLat = centerLat + dLat;

  const tlMin = lngLatToTile(minLng, maxLat, z); // top-left (north-west)
  const brMax = lngLatToTile(maxLng, minLat, z); // bottom-right (south-east)
  const tx0 = Math.min(tlMin.x, brMax.x);
  const tx1 = Math.max(tlMin.x, brMax.x);
  const ty0 = Math.min(tlMin.y, brMax.y);
  const ty1 = Math.max(tlMin.y, brMax.y);
  const tilesX = tx1 - tx0 + 1;
  const tilesY = ty1 - ty0 + 1;
  const maxTiles = 8;
  if (tilesX > maxTiles || tilesY > maxTiles) {
    console.warn("[basemap] tile grid too large", { tilesX, tilesY, z });
  }

  const TILE = 256;
  const canvas = document.createElement("canvas");
  canvas.width = tilesX * TILE;
  canvas.height = tilesY * TILE;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  // Fondo gris oscuro mientras cargan/fallan tiles
  ctx.fillStyle = "#1a1a1a";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const promises: Promise<void>[] = [];
  let failures = 0;
  for (let ty = ty0; ty <= ty1; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      const url = template
        .replace("{z}", String(z))
        .replace("{x}", String(tx))
        .replace("{y}", String(ty));
      const dx = (tx - tx0) * TILE;
      const dy = (ty - ty0) * TILE;
      promises.push(
        loadImage(url).then((img) => {
          if (img) ctx.drawImage(img, dx, dy);
          else failures++;
        }),
      );
    }
  }
  await Promise.all(promises);

  const totalTiles = tilesX * tilesY;
  const failed = failures > totalTiles * 0.5;

  // bbox real del canvas en lng/lat
  const nw = tileToLngLat(tx0, ty0, z);
  const se = tileToLngLat(tx1 + 1, ty1 + 1, z);
  const cLngMin = Math.min(nw.lng, se.lng);
  const cLngMax = Math.max(nw.lng, se.lng);
  const cLatMin = Math.min(nw.lat, se.lat);
  const cLatMax = Math.max(nw.lat, se.lat);

  // Convertir bbox a ENU
  const sw = lngLatToEnu(cLngMin, cLatMin, centerLng, centerLat);
  const ne = lngLatToEnu(cLngMax, cLatMax, centerLng, centerLat);

  return {
    canvas,
    lngMin: cLngMin,
    lngMax: cLngMax,
    latMin: cLatMin,
    latMax: cLatMax,
    enuMinX: sw.x,
    enuMaxX: ne.x,
    enuMinY: sw.y,
    enuMaxY: ne.y,
    zoom: z,
    source,
    failed,
  };
}
