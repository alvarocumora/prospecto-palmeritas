import type { GeoJSON as LeafletGeoJSON, Map as LeafletMap } from "leaflet";
import {
  CATASTRO_STYLE,
  catastroPopupHtml,
  catastroQueryUrl,
  type CatastroOrigen,
} from "./overlays";
import type { AnyFC, LeafletNS } from "./types";

const TTL_MS = 24 * 60 * 60 * 1000; // 24h
const CACHE_VERSION = "v2"; // bumped: schema change (single layer, ORIGEN-discriminated)

function cacheKey(bbox: {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
}) {
  const r = (n: number) => n.toFixed(4);
  return `catastro:${CACHE_VERSION}:all:${r(bbox.minLng)},${r(bbox.minLat)},${r(bbox.maxLng)},${r(bbox.maxLat)}`;
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

export type CatastroLoadResult = {
  /** One Leaflet GeoJSON layer per ORIGEN type, ready to be added to the map. */
  layersByOrigen: Partial<Record<CatastroOrigen, LeafletGeoJSON>>;
  /** Raw GeoJSON features bucketed by ORIGEN (for export / analysis). */
  featuresByOrigen: Record<CatastroOrigen, AnyFC["features"]>;
  /** Feature counts per ORIGEN. */
  countsByOrigen: Record<CatastroOrigen, number>;
  total: number;
  cached: boolean;
};

const ALL_ORIGENS: CatastroOrigen[] = [
  "EXPLOTA_1983",
  "EXPLOTA_1932",
  "EXPLORA_1983",
  "ESTACAMENTO",
];

/**
 * Loads ALL constituted (situación 1,3) mining concessions in the bbox from
 * the SERNAGEOMIN public FeatureServer (single query against layer 2 —
 * `WGS84_Concesion`) and splits them client-side by `ORIGEN`. Cached in
 * localStorage with 24h TTL.
 */
export async function loadCatastro(
  L: LeafletNS,
  bbox: { minLng: number; minLat: number; maxLng: number; maxLat: number }
): Promise<CatastroLoadResult> {
  const key = cacheKey(bbox);
  const cached = readCache(key);
  let fc: AnyFC;
  let fromCache = false;
  if (cached) {
    fc = cached;
    fromCache = true;
  } else {
    const url = catastroQueryUrl(bbox);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Catastro HTTP ${res.status}`);
    const raw = (await res.json()) as unknown;
    if (raw && typeof raw === "object" && "error" in raw) {
      const err = (raw as { error: { message?: string; details?: string[] } }).error;
      throw new Error(`Catastro API error: ${err.message || err.details?.[0] || "unknown"}`);
    }
    fc = raw as AnyFC;
    writeCache(key, fc);
  }
  const features = Array.isArray(fc?.features) ? fc.features : [];

  // Bucket features by ORIGEN
  const buckets: Record<CatastroOrigen, AnyFC["features"]> = {
    EXPLOTA_1983: [],
    EXPLOTA_1932: [],
    EXPLORA_1983: [],
    ESTACAMENTO: [],
  };
  for (const f of features) {
    const origen = (f.properties?.ORIGEN as CatastroOrigen | undefined) ?? "EXPLOTA_1983";
    if (origen in buckets) buckets[origen].push(f);
  }

  const layersByOrigen: Partial<Record<CatastroOrigen, LeafletGeoJSON>> = {};
  const countsByOrigen = {} as Record<CatastroOrigen, number>;
  for (const origen of ALL_ORIGENS) {
    countsByOrigen[origen] = buckets[origen].length;
    if (buckets[origen].length === 0) continue;
    const style = CATASTRO_STYLE[origen];
    layersByOrigen[origen] = L.geoJSON(
      { type: "FeatureCollection", features: buckets[origen] } as AnyFC,
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
          l.bindPopup(catastroPopupHtml(f.properties ?? {}));
        },
      }
    );
  }

  return {
    layersByOrigen,
    featuresByOrigen: buckets,
    countsByOrigen,
    total: features.length,
    cached: fromCache,
  };
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
  ) => string,
) {
  map.on("click", async (e) => {
    const { lat, lng } = e.latlng;
    const popup = L.popup()
      .setLatLng(e.latlng)
      .setContent(
        `<div style="font-family:'IBM Plex Mono',monospace;font-size:11px;color:#A89080;">Consultando geología…</div>`,
      )
      .openOn(map);

    // 1) SERNAGEOMIN GetFeatureInfo (Chile) — siempre primero
    let chileHtml = "";
    try {
      const { wmsGetFeatureInfo } = await import("./sernageominLayers");
      const size = map.getSize();
      const point = map.latLngToContainerPoint(e.latlng);
      const b = map.getBounds();
      const bbox = `${b.getSouth()},${b.getWest()},${b.getNorth()},${b.getEast()}`;
      const props = await wmsGetFeatureInfo({
        baseUrl: "https://catastro.sernageomin.cl/arcgis/services/Geologia/Geologia_Base_1M/MapServer/WMSServer",
        layer: "0",
        bbox,
        width: size.x,
        height: size.y,
        x: point.x,
        y: point.y,
      });
      if (props && Object.keys(props).length > 0) {
        const name = (props.NOMBRE_UNIDAD ?? props.UNIDAD ?? props.NAME ?? props.LITOLOGIA ?? "Unidad geológica chilena") as string;
        const edad = (props.EDAD ?? props.AGE ?? props.PERIODO ?? "—") as string;
        const lito = (props.LITOLOGIA ?? props.ROCK_TYPE ?? "—") as string;
        chileHtml = `<div style="font-family:'IBM Plex Mono',monospace;font-size:11px;line-height:1.5;max-width:280px;">
          <strong style="color:#F0C96B;">${name}</strong><br/>
          Edad: ${edad}<br/>
          Litología: ${lito}
          <div style="margin-top:6px;padding-top:6px;border-top:1px solid #3a322c;color:#A89080;font-size:10px;">📎 SERNAGEOMIN · Carta Geológica 1:1.000.000 · ${lat.toFixed(4)}, ${lng.toFixed(4)}</div>
        </div>`;
      }
    } catch {
      /* ignore — caemos a Macrostrat */
    }

    if (chileHtml) {
      popup.setContent(chileHtml);
      return;
    }

    // 2) Macrostrat fallback (global)
    try {
      const unit = await fetchUnit(lat, lng);
      popup.setContent(popupHtml(unit, lat, lng));
    } catch (err) {
      popup.setContent(
        `<div style="font-family:'IBM Plex Mono',monospace;font-size:11px;color:#A89080;">Sin información geológica disponible en este punto<br/>${(err as Error).message}</div>`,
      );
    }
  });
}
