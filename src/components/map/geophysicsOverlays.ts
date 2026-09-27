import type { LeafletNS } from "./types";

/**
 * Real public geophysics WMS overlays.
 * - EMAG2 v3 (NOAA NCEI): global magnetic anomaly, ~2 arc-min (~3.7 km) resolution.
 * - WGM2012 (BGI): global Bouguer gravity anomaly, terrestrial.
 * - World Hillshade (Esri): SRTM-derived shaded relief, useful para control estructural.
 *
 * Escala apropiada para contexto regional/distrital, NO para escala de prospecto.
 */
export function buildGeophysicsOverlays(L: LeafletNS) {
  const emag2 = L.tileLayer.wms(
    "https://gis.ngdc.noaa.gov/arcgis/services/EMAG2v3/ImageServer/WMSServer",
    {
      layers: "0",
      format: "image/png",
      transparent: true,
      opacity: 0.55,
      attribution:
        'Magnetometría EMAG2 v3 &copy; <a href="https://www.ncei.noaa.gov/products/emag2">NOAA NCEI</a> · contexto regional',
    },
  );

  const wgm2012 = L.tileLayer.wms("https://bgi.obs-mip.fr/cgi-bin/wgm2012?", {
    layers: "WGM2012_Bouguer",
    format: "image/png",
    transparent: true,
    opacity: 0.55,
    attribution:
      'Gravimetría WGM2012 Bouguer &copy; <a href="https://bgi.obs-mip.fr/data-products/grids-and-models/wgm2012-global-model/">BGI/CGMW</a> · contexto regional',
  });

  const hillshade = L.tileLayer(
    "https://services.arcgisonline.com/ArcGIS/rest/services/Elevation/World_Hillshade/MapServer/tile/{z}/{y}/{x}",
    {
      attribution: "Hillshade SRTM &copy; Esri",
      opacity: 0.6,
      maxZoom: 18,
    },
  );

  return {
    "Magnetometría EMAG2 (regional)": emag2,
    "Gravimetría Bouguer WGM2012 (regional)": wgm2012,
    "Hillshade SRTM (Esri)": hillshade,
  };
}
