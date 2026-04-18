import type { GeoJSON as LeafletGeoJSON, Map as LeafletMap } from "leaflet";
import {
  CATASTRO_STYLE,
  catastroPopupHtml,
  catastroQueryUrl,
  type CatastroKind,
} from "./overlays";
import type { AnyFC, LeafletNS } from "./types";

const TTL_MS = 24 * 60 * 60 * 1000; // 24h
const CACHE_VERSION = "v1";

function cacheKey(
  kind: CatastroKind,
  bbox: { minLng: number; minLat: number; maxLng: number; maxLat: number }
) {
  const r = (n: number) => n.toFixed(4);
  return `catastro:${CACHE_VERSION}:${kind}:${r(bbox.minLng)},${r(bbox.minLat)},${r(bbox.maxLng)},${r(bbox.maxLat)}`;
}

function readCache(key: string): AnyFC | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const { ts, fc } = JSON.parse(raw) as { ts: number; fc: AnyFC };
    if (Date.now() - ts > TTL_MS) {
      window.localStorage.removeItem(key);
      return null;
    }
    return fc;
  } catch {
    return null;
  }
}

function writeCache(key: string, fc: AnyFC) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify({ ts: Date.now(), fc }));
  } catch {
    // Quota exceeded or disabled — ignore silently.
  }
}

/** Removes all cached catastro entries from localStorage. */
export function clearCatastroCache(): number {
  if (typeof window === "undefined") return 0;
  let removed = 0;
  try {
    const keys: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith("catastro:")) keys.push(k);
    }
    for (const k of keys) {
      window.localStorage.removeItem(k);
      removed++;
    }
  } catch {
    // ignore
  }
  return removed;
}
 * ArcGIS FeatureServer for a given bbox and returns a Leaflet GeoJSON layer.
 * Cached in localStorage with 24h TTL keyed by kind + rounded bbox.
 * The layer is NOT added to the map automatically — the caller decides.
 */
export async function loadCatastroLayer(
  L: LeafletNS,
  kind: CatastroKind,
  bbox: { minLng: number; minLat: number; maxLng: number; maxLat: number }
): Promise<{ layer: LeafletGeoJSON; count: number; cached: boolean }> {
  const key = cacheKey(kind, bbox);
  const cached = readCache(key);
  let fc: AnyFC;
  let fromCache = false;
  if (cached) {
    fc = cached;
    fromCache = true;
  } else {
    const url = catastroQueryUrl(kind, bbox);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Catastro ${kind} HTTP ${res.status}`);
    const raw = (await res.json()) as unknown;
    // ArcGIS sometimes returns 200 OK with {"error":{...}} body — guard against it.
    if (raw && typeof raw === "object" && "error" in raw) {
      const err = (raw as { error: { message?: string; details?: string[] } }).error;
      throw new Error(`Catastro ${kind} API error: ${err.message || err.details?.[0] || "unknown"}`);
    }
    fc = raw as AnyFC;
    writeCache(key, fc);
  }
  const features = Array.isArray(fc?.features) ? fc.features : [];
  const style = CATASTRO_STYLE[kind];
  const layer = L.geoJSON(
    { type: "FeatureCollection", features } as AnyFC,
    {
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
    }
  );
  return { layer, count: features.length, cached: fromCache };
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
