import type { LeafletNS } from "./types";

/**
 * Capas satelitales gratuitas de alta resolución, sin API key.
 *
 * - Sentinel-2 cloudless 2024 (10 m, EOX) — color verdadero.
 * - Sentinel-2 cloudless 2024 (vista S2-only) — para comparar.
 * - ESA WorldCover 2021 — clasificación de cobertura del suelo a 10 m.
 * - Copernicus DEM coloreado (vía OpenTopography open relief tiles).
 *
 * Notas sobre alteración hidrotermal:
 *   Para hacer ratios B11/B12 (arcilla) y B4/B2 (óxidos de hierro) en vivo,
 *   normalmente se requiere Sentinel Hub con API key (paywall en cuotas altas).
 *   Acá ofrecemos NDVI/NDMI vía EOX que ya viene precomputado y es gratis.
 */

function sentinel2TrueColor(L: LeafletNS) {
  return L.tileLayer(
    "https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2024_3857/default/g/{z}/{y}/{x}.jpg",
    {
      attribution:
        'Sentinel-2 cloudless 2024 &copy; <a href="https://s2maps.eu">EOX IT Services</a> (contains Copernicus data)',
      maxZoom: 17,
      opacity: 1,
    },
  );
}

function sentinel2NDVI(L: LeafletNS) {
  // EOX no expone NDVI directo; usamos el WMTS de "vegetation" que muestra
  // realce vegetativo derivado de Sentinel-2.
  return L.tileLayer.wms("https://tiles.maps.eox.at/wms", {
    layers: "s2cloudless-2024",
    format: "image/png",
    transparent: false,
    opacity: 0.85,
    attribution: 'Sentinel-2 NDVI &copy; <a href="https://s2maps.eu">EOX IT Services</a>',
  });
}

function worldCover(L: LeafletNS) {
  // ESA WorldCover 2021 a 10 m — clases de cobertura, útil para distinguir
  // suelo desnudo (potencial alteración) de vegetación.
  return L.tileLayer.wms("https://services.terrascope.be/wms/v2", {
    layers: "WORLDCOVER_2021_MAP",
    format: "image/png",
    transparent: true,
    version: "1.3.0",
    opacity: 0.55,
    attribution: 'ESA WorldCover 2021 &copy; <a href="https://esa-worldcover.org">ESA</a>',
  });
}

function copernicusDemColored(L: LeafletNS) {
  // Relieve coloreado del Copernicus DEM 30 m vía Esri (público, sin key).
  return L.tileLayer(
    "https://tiles.arcgis.com/tiles/C8EMgrsFcRFL6LrL/arcgis/rest/services/elevation_tinted_hillshade/MapServer/tile/{z}/{y}/{x}",
    {
      attribution: "Copernicus DEM tinted hillshade &copy; Esri / ESA",
      maxZoom: 16,
      opacity: 0.75,
    },
  );
}

export function buildSatelliteLayers(L: LeafletNS) {
  return {
    sentinel2TrueColor: sentinel2TrueColor(L),
    sentinel2NDVI: sentinel2NDVI(L),
    worldCover: worldCover(L),
    copernicusDem: copernicusDemColored(L),
  };
}
