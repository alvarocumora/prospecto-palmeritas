import type { Map as LeafletMap } from "leaflet";
import { CENTER, type AnyFC, type LeafletNS, sourceLine } from "./types";

/** Adds AOI/veins/palms/workings/drills to the map and fits bounds. */
export function addProjectFeatures(
  L: LeafletNS,
  map: LeafletMap,
  data: { aoi: AnyFC; veins: AnyFC; palms: AnyFC; workings: AnyFC; drills: AnyFC }
) {
  // AOI centroid
  const centroidIcon = L.divIcon({
    className: "",
    html: `<div style="width:14px;height:14px;border-radius:50%;background:var(--gold);box-shadow:0 0 0 4px color-mix(in oklab, var(--gold) 30%, transparent);border:2px solid var(--background);"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
  L.geoJSON(data.aoi, {
    pointToLayer: (_f, latlng) => L.marker(latlng, { icon: centroidIcon }),
    onEachFeature: (f, layer) => {
      const p = f.properties ?? {};
      layer.bindPopup(
        `<div style="font-family:'IBM Plex Mono',monospace;font-size:11px;line-height:1.5;">
          <strong style="color:#C8922A;">${p.name ?? "AOI"}</strong><br/>
          ${p.code ?? ""}<br/>
          ${CENTER[0].toFixed(6)}, ${CENTER[1].toFixed(6)}
          ${sourceLine(p.source)}
        </div>`
      );
    },
  }).addTo(map);

  // Veins
  L.geoJSON(data.veins, {
    style: { color: "#F0C96B", weight: 4, opacity: 0.9 },
    onEachFeature: (f, layer) => {
      const p = f.properties ?? {};
      layer.bindPopup(
        `<div style="font-family:'IBM Plex Mono',monospace;font-size:11px;">
          <strong style="color:#C8922A;">${p.name}</strong><br/>
          Rumbo: ${p.strike} · ${p.dip ?? ""}
          ${sourceLine(p.source)}
        </div>`
      );
    },
  }).addTo(map);

  // Palm clusters
  L.geoJSON(data.palms, {
    pointToLayer: (f, latlng) => {
      const count = (f.properties?.count as number) ?? 0;
      const icon = L.divIcon({
        className: "",
        html: `<div style="width:20px;height:20px;border-radius:50%;background:color-mix(in oklab, #1D9E75 35%, transparent);border:2px solid #1D9E75;display:flex;align-items:center;justify-content:center;color:#F5F0EB;font-family:'IBM Plex Mono',monospace;font-size:9px;font-weight:700;">${count}</div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      });
      return L.marker(latlng, { icon });
    },
    onEachFeature: (f, layer) => {
      const p = f.properties ?? {};
      layer.bindPopup(
        `<div style="font-family:'IBM Plex Mono',monospace;font-size:11px;">
          <strong style="color:#1D9E75;">${p.name}</strong><br/>
          ${p.count}× ${p.species ?? "Jubaea chilensis"}<br/>
          <em style="color:#A89080;">Proxy estructural</em>
          ${sourceLine(p.source)}
        </div>`
      );
    },
  }).addTo(map);

  // Workings
  L.geoJSON(data.workings, {
    pointToLayer: (_f, latlng) => {
      const icon = L.divIcon({
        className: "",
        html: `<div style="width:12px;height:12px;background:#CD7F32;border:1.5px solid #F5F0EB;transform:rotate(45deg);"></div>`,
        iconSize: [12, 12],
        iconAnchor: [6, 6],
      });
      return L.marker(latlng, { icon });
    },
    onEachFeature: (f, layer) => {
      const p = f.properties ?? {};
      layer.bindPopup(
        `<div style="font-family:'IBM Plex Mono',monospace;font-size:11px;">
          <strong style="color:#CD7F32;">${p.name}</strong><br/>
          ${p.type}
          ${sourceLine(p.source)}
        </div>`
      );
    },
  }).addTo(map);

  // Drill collars
  L.geoJSON(data.drills, {
    pointToLayer: (_f, latlng) => {
      const icon = L.divIcon({
        className: "",
        html: `<div style="width:18px;height:18px;border-radius:3px;background:color-mix(in oklab, #185FA5 50%, transparent);border:2px solid #185FA5;display:flex;align-items:center;justify-content:center;color:#F5F0EB;font-family:'IBM Plex Mono',monospace;font-size:9px;font-weight:700;">D</div>`,
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      });
      return L.marker(latlng, { icon });
    },
    onEachFeature: (f, layer) => {
      const p = f.properties ?? {};
      layer.bindPopup(
        `<div style="font-family:'IBM Plex Mono',monospace;font-size:11px;line-height:1.6;">
          <strong style="color:#5DA3DD;">${p.id}</strong><br/>
          Az ${p.azimuth} · Incl ${p.inclination}<br/>
          Prof: ${p.depth}<br/>
          <em style="color:#A89080;">${p.target}</em>
          ${sourceLine(p.source)}
        </div>`
      );
    },
  }).addTo(map);

  // Fit bounds to all geometry
  const collect: [number, number][] = [];
  [data.veins, data.palms, data.workings, data.drills].forEach((fc) => {
    fc.features.forEach((f) => {
      if (f.geometry.type === "Point") {
        const [lng, lat] = f.geometry.coordinates as [number, number];
        collect.push([lat, lng]);
      } else if (f.geometry.type === "LineString") {
        (f.geometry.coordinates as [number, number][]).forEach(([lng, lat]) =>
          collect.push([lat, lng])
        );
      }
    });
  });
  if (collect.length) {
    map.fitBounds(L.latLngBounds(collect), { padding: [30, 30] });
  }
}
