import type { GeoJSON as LeafletGeoJSON, Map as LeafletMap } from "leaflet";
import {
  CATASTRO_STYLE,
  catastroPopupHtml,
  catastroQueryUrl,
  type CatastroKind,
} from "./overlays";
import type { AnyFC, LeafletNS } from "./types";

/**
 * Loads a Catastro layer (explotacion or exploracion) from SERNAGEOMIN's
 * ArcGIS FeatureServer for a given bbox and returns a Leaflet GeoJSON layer.
 * The layer is NOT added to the map automatically — the caller decides.
 */
export async function loadCatastroLayer(
  L: LeafletNS,
  kind: CatastroKind,
  bbox: { minLng: number; minLat: number; maxLng: number; maxLat: number }
): Promise<{ layer: LeafletGeoJSON; count: number }> {
  const url = catastroQueryUrl(kind, bbox);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Catastro ${kind} ${res.status}`);
  const fc = (await res.json()) as AnyFC;
  const style = CATASTRO_STYLE[kind];
  const layer = L.geoJSON(fc, {
    style: () => ({
      color: style.color,
      weight: style.weight,
      opacity: style.opacity,
      fillColor: style.fillColor,
      fillOpacity: style.fillOpacity,
      dashArray: style.dashArray,
    }),
    onEachFeature: (f, l) => {
      l.bindPopup(catastroPopupHtml(kind, f.properties ?? {}));
    },
  });
  return { layer, count: fc.features?.length ?? 0 };
}

/** Returns a bbox in degrees around a center point with the given half-size in km. */
export function bboxAround(center: [number, number], halfKm: number) {
  const [lat, lng] = center;
  const dLat = halfKm / 111;
  const dLng = halfKm / (111 * Math.cos((lat * Math.PI) / 180));
  return {
    minLat: lat - dLat,
    maxLat: lat + dLat,
    minLng: lng - dLng,
    maxLng: lng + dLng,
  };
}

/** Wires a click handler that fetches Macrostrat unit at the clicked point. */
export function wireMacrostratClickPopup(
  L: LeafletNS,
  map: LeafletMap,
  fetchUnit: (lat: number, lng: number) => Promise<Record<string, unknown> | undefined>,
  popupHtml: (
    unit: Record<string, unknown> | undefined,
    lat: number,
    lng: number
  ) => string
) {
  map.on("click", async (e) => {
    const { lat, lng } = e.latlng;
    const popup = L.popup()
      .setLatLng(e.latlng)
      .setContent(
        `<div style="font-family:'IBM Plex Mono',monospace;font-size:11px;color:#A89080;">Consultando Macrostrat…</div>`
      )
      .openOn(map);
    try {
      const unit = await fetchUnit(lat, lng);
      popup.setContent(popupHtml(unit, lat, lng));
    } catch (err) {
      popup.setContent(
        `<div style="font-family:'IBM Plex Mono',monospace;font-size:11px;color:#A89080;">Error consultando Macrostrat: ${(err as Error).message}</div>`
      );
    }
  });
}
