// Sprint 6.3 — buildRasterOverlayLayer: render de drone_rasters como L.imageOverlay con
// opacidad y visibilidad controladas dinámicamente desde RasterControlPanel.
// Usa signed URL si el raster tiene storage_path; si no, usa r.url directo (legado).
// Para PNG/JPG ortofotos se renderiza directo. Para GeoTIFF, sirve si el navegador
// puede mostrarlo (algunos no); en ese caso el usuario verá un cuadro vacío y deberá
// pre-procesar a PNG. Implementamos georaster-layer para GeoTIFF nativo en sprint futuro.

import type { LayerGroup, Map as LeafletMap } from "leaflet";
import type { LeafletNS } from "../map/types";
import type { DroneRaster } from "@/hooks/useDroneFlights";
import { getRasterSignedUrl } from "@/hooks/useDroneFlights";
import type { RasterSettings } from "./RasterControlPanel";

export async function buildRasterOverlayLayer(
  L: LeafletNS,
  rasters: DroneRaster[],
  settings: RasterSettings,
): Promise<LayerGroup> {
  const group = L.layerGroup();

  for (const r of rasters) {
    const s = settings[r.id];
    if (!s?.visible) continue;
    if (!r.bounds_geojson) continue;
    const bbox = r.bounds_geojson as { bbox?: number[] } | number[];
    const arr = Array.isArray(bbox) ? bbox : bbox.bbox;
    if (!arr || arr.length < 4) continue;
    const [minLng, minLat, maxLng, maxLat] = arr;

    let url = r.url;
    if (r.storage_path) {
      const signed = await getRasterSignedUrl(r.storage_path);
      if (signed) url = signed;
    }
    if (!url) continue;

    try {
      const overlay = L.imageOverlay(
        url,
        [[minLat, minLng], [maxLat, maxLng]],
        { opacity: s.opacity, interactive: false, className: `raster-${s.colormap}` },
      );
      overlay.addTo(group);
    } catch (err) {
      console.warn("[rasterOverlay] failed:", r.name, err);
    }
  }

  return group;
}

export function fitToRaster(L: LeafletNS, map: LeafletMap, r: DroneRaster) {
  if (!r.bounds_geojson) return;
  const bbox = r.bounds_geojson as { bbox?: number[] } | number[];
  const arr = Array.isArray(bbox) ? bbox : bbox.bbox;
  if (!arr || arr.length < 4) return;
  const [minLng, minLat, maxLng, maxLat] = arr;
  map.fitBounds(L.latLngBounds([minLat, minLng], [maxLat, maxLng]), { padding: [40, 40] });
}
