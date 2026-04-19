import type { LayerGroup, Map as LeafletMap } from "leaflet";
import type { LeafletNS } from "./types";

/**
 * Sprint 6.5 — External live feeds.
 *
 * 1) USGS Earthquakes (last 30 days, magnitude ≥ 2.5).
 *    Public GeoJSON, no API key. Refreshed every 5 min by USGS.
 *    Docs: https://earthquake.usgs.gov/earthquakes/feed/v1.0/geojson.php
 *
 * 2) OSM Overpass — roads + buildings within current viewport.
 *    Uses the public Overpass API. Re-fetched on `moveend` when visible.
 */

const USGS_FEED =
  "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_month.geojson";

type USGSFeature = {
  type: "Feature";
  geometry: { type: "Point"; coordinates: [number, number, number] };
  properties: {
    mag: number | null;
    place: string | null;
    time: number;
    url: string;
    depth?: number;
  };
};

type USGSFC = { type: "FeatureCollection"; features: USGSFeature[] };

function magColor(mag: number): string {
  if (mag >= 6) return "#dc2626"; // red
  if (mag >= 5) return "#ea580c"; // orange
  if (mag >= 4) return "#f59e0b"; // amber
  if (mag >= 3) return "#eab308"; // yellow
  return "#a3a3a3"; // grey
}

export async function buildUsgsEarthquakesLayer(
  L: LeafletNS,
): Promise<LayerGroup> {
  const group = L.layerGroup();
  try {
    const res = await fetch(USGS_FEED);
    if (!res.ok) throw new Error(`USGS ${res.status}`);
    const fc = (await res.json()) as USGSFC;
    for (const f of fc.features) {
      const [lng, lat, depth] = f.geometry.coordinates;
      const mag = f.properties.mag ?? 0;
      const r = Math.max(3, Math.min(18, mag * 2.5));
      const color = magColor(mag);
      const when = new Date(f.properties.time).toLocaleString("es-CL");
      const html = `<div style="font-family:'IBM Plex Mono',monospace;font-size:11px;line-height:1.5;max-width:240px;">
        <strong style="color:${color};">M ${mag.toFixed(1)} · ${f.properties.place ?? "—"}</strong><br/>
        Profundidad: ${depth?.toFixed?.(1) ?? "—"} km<br/>
        ${when}<br/>
        <a href="${f.properties.url}" target="_blank" rel="noreferrer" style="color:#F0C96B;">Ver en USGS →</a>
        <div style="margin-top:6px;padding-top:6px;border-top:1px solid #3a322c;color:#A89080;font-size:10px;">📎 USGS Earthquake Hazards Program · feed mensual</div>
      </div>`;
      L.circleMarker([lat, lng], {
        radius: r,
        color,
        weight: 1,
        fillColor: color,
        fillOpacity: 0.55,
      })
        .bindPopup(html)
        .addTo(group);
    }
  } catch (err) {
    console.warn("[usgs] failed to load earthquake feed:", err);
  }
  return group;
}

/* ------------------------------------------------------------------ */
/*  OSM Overpass — viewport-driven roads + buildings                  */
/* ------------------------------------------------------------------ */

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";

export type OverpassController = {
  group: LayerGroup;
  attach: (map: LeafletMap) => void;
  detach: (map: LeafletMap) => void;
};

export function buildOverpassInfraLayer(L: LeafletNS): OverpassController {
  const group = L.layerGroup();
  let lastFetchKey = "";
  let pending = false;

  async function fetchForMap(map: LeafletMap) {
    if (pending) return;
    if (map.getZoom() < 13) {
      group.clearLayers();
      L.marker(map.getCenter(), { opacity: 0 }); // no-op
      return;
    }
    const b = map.getBounds();
    const key = [b.getSouth().toFixed(3), b.getWest().toFixed(3), b.getNorth().toFixed(3), b.getEast().toFixed(3), map.getZoom()].join(",");
    if (key === lastFetchKey) return;
    lastFetchKey = key;
    pending = true;

    const bbox = `${b.getSouth()},${b.getWest()},${b.getNorth()},${b.getEast()}`;
    // Roads (highway=*) + buildings (building=*). Limit with timeout to be polite.
    const q = `[out:json][timeout:15];(
      way["highway"](${bbox});
      way["building"](${bbox});
    );out geom 800;`;
    try {
      const res = await fetch(OVERPASS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `data=${encodeURIComponent(q)}`,
      });
      if (!res.ok) throw new Error(`Overpass ${res.status}`);
      const json = (await res.json()) as {
        elements: Array<{
          type: string;
          tags?: Record<string, string>;
          geometry?: Array<{ lat: number; lon: number }>;
        }>;
      };
      group.clearLayers();
      for (const el of json.elements) {
        if (!el.geometry || el.geometry.length < 2) continue;
        const latlngs = el.geometry.map((g) => [g.lat, g.lon] as [number, number]);
        const isBuilding = !!el.tags?.building;
        const isHighway = !!el.tags?.highway;
        if (isBuilding) {
          L.polygon(latlngs, {
            color: "#9333ea",
            weight: 1,
            fillColor: "#9333ea",
            fillOpacity: 0.25,
          }).addTo(group);
        } else if (isHighway) {
          const cls = el.tags?.highway ?? "";
          const major = ["motorway", "trunk", "primary", "secondary"].includes(cls);
          L.polyline(latlngs, {
            color: major ? "#fbbf24" : "#fde68a",
            weight: major ? 2.5 : 1.2,
            opacity: 0.9,
          })
            .bindPopup(
              `<div style="font-family:'IBM Plex Mono',monospace;font-size:11px;">
                <strong style="color:#fbbf24;">${el.tags?.name ?? "Vía sin nombre"}</strong><br/>
                Tipo: ${cls}<br/>
                <div style="margin-top:6px;padding-top:6px;border-top:1px solid #3a322c;color:#A89080;font-size:10px;">📎 OpenStreetMap · Overpass API</div>
              </div>`,
            )
            .addTo(group);
        }
      }
    } catch (err) {
      console.warn("[overpass] failed:", err);
    } finally {
      pending = false;
    }
  }

  let handler: (() => void) | null = null;

  return {
    group,
    attach(map: LeafletMap) {
      handler = () => {
        // Only fetch if the layer is currently on the map.
        if (map.hasLayer(group)) void fetchForMap(map);
      };
      map.on("moveend", handler);
      map.on("zoomend", handler);
      // Initial fetch when added.
      group.on("add", () => void fetchForMap(map));
    },
    detach(map: LeafletMap) {
      if (handler) {
        map.off("moveend", handler);
        map.off("zoomend", handler);
        handler = null;
      }
    },
  };
}
