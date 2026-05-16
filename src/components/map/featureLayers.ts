import type { Map as LeafletMap } from "leaflet";
import { CENTER, type AnyFC, type LeafletNS, sourceLine } from "./types";

const RING_COLORS: Record<number, string> = {
  1: "#F0C96B", // gold — Discovery
  2: "#CD7F32", // copper — Step-out
  3: "#5DA3DD", // blue — Reserve
};
const RING_LABELS: Record<number, string> = { 1: "R1", 2: "R2", 3: "R3" };

/** Adds AOI/veins/palms/workings/drills (+ optional anomalies) and fits bounds. */
export function addProjectFeatures(
  L: LeafletNS,
  map: LeafletMap,
  data: {
    aoi: AnyFC;
    veins: AnyFC;
    palms: AnyFC;
    workings: AnyFC;
    drills: AnyFC;
    anomalies?: AnyFC;
  },
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
    style: (f) =>
      f?.geometry?.type === "Polygon"
        ? {
            color: "#F0C96B",
            weight: 2,
            opacity: 0.9,
            fillColor: "#F0C96B",
            fillOpacity: 0.06,
            dashArray: "4 4",
          }
        : {},
    onEachFeature: (f, layer) => {
      const p = f.properties ?? {};
      layer.bindPopup(
        `<div style="font-family:'IBM Plex Mono',monospace;font-size:11px;line-height:1.5;">
          <strong style="color:#C8922A;">${p.name ?? "AOI"}</strong><br/>
          ${p.code ?? ""}<br/>
          ${CENTER[0].toFixed(6)}, ${CENTER[1].toFixed(6)}
          ${sourceLine(p.source)}
        </div>`,
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
        </div>`,
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
        </div>`,
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
        </div>`,
      );
    },
  }).addTo(map);

  // Drill collars — coloreados por anillo (R1 Discovery / R2 Step-out / R3 Reserve)
  L.geoJSON(data.drills, {
    pointToLayer: (f, latlng) => {
      const p = (f.properties ?? {}) as { ring?: number };
      const ring = (p.ring ?? 1) as 1 | 2 | 3;
      const color = RING_COLORS[ring] ?? "#185FA5";
      const label = RING_LABELS[ring] ?? "D";
      const icon = L.divIcon({
        className: "",
        html: `<div style="width:20px;height:20px;border-radius:3px;background:color-mix(in oklab, ${color} 55%, transparent);border:2px solid ${color};display:flex;align-items:center;justify-content:center;color:#0d0d0d;font-family:'IBM Plex Mono',monospace;font-size:9px;font-weight:800;">${label}</div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      });
      return L.marker(latlng, { icon });
    },
    onEachFeature: (f, layer) => {
      const p = f.properties ?? {};
      const ring = (p.ring ?? 1) as 1 | 2 | 3;
      const color = RING_COLORS[ring] ?? "#5DA3DD";
      const ringLabel = p.ring_label ?? `Anillo ${ring}`;
      const justification = p.justification
        ? `<div style="margin-top:4px;padding-top:4px;border-top:1px dashed #3a3a3a;color:#cfc8b8;font-size:10px;">${p.justification}</div>`
        : "";
      layer.bindPopup(
        `<div style="font-family:'IBM Plex Mono',monospace;font-size:11px;line-height:1.55;min-width:220px;">
          <div style="display:flex;align-items:center;gap:6px;">
            <span style="display:inline-block;width:8px;height:8px;background:${color};border-radius:2px;"></span>
            <strong style="color:${color};">${p.id}</strong>
            <span style="font-size:9px;color:#A89080;margin-left:auto;">${ringLabel}</span>
          </div>
          <div style="margin-top:4px;">Az ${p.azimuth} · Incl ${p.inclination} · <strong>${p.depth}</strong></div>
          <div style="color:#cfc8b8;">Target: ${p.target ?? p.target_zone ?? "—"}</div>
          ${justification}
          ${sourceLine(p.source)}
        </div>`,
      );
    },
  }).addTo(map);

  // Anomalías satelitales y lineamientos estructurales (opcional)
  if (data.anomalies) {
    L.geoJSON(data.anomalies, {
      pointToLayer: (f, latlng) => {
        const p = (f.properties ?? {}) as { color?: string; code?: string; score?: number };
        const color = p.color ?? "#E85D3A";
        const score = p.score ?? 0;
        const size = Math.max(22, Math.min(40, 18 + score / 5));
        const icon = L.divIcon({
          className: "",
          html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:color-mix(in oklab, ${color} 25%, transparent);border:2px solid ${color};display:flex;align-items:center;justify-content:center;color:#0d0d0d;font-family:'IBM Plex Mono',monospace;font-size:9px;font-weight:800;box-shadow:0 0 0 4px color-mix(in oklab, ${color} 15%, transparent);">${p.code ?? "•"}</div>`,
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2],
        });
        return L.marker(latlng, { icon });
      },
      style: (f) => {
        if (f?.geometry?.type === "LineString") {
          return { color: "#9B72CF", weight: 2, opacity: 0.85, dashArray: "6 5" };
        }
        return {};
      },
      onEachFeature: (f, layer) => {
        const p = f.properties ?? {};
        if (p.kind === "lineament") {
          layer.bindPopup(
            `<div style="font-family:'IBM Plex Mono',monospace;font-size:11px;">
              <strong style="color:#9B72CF;">${p.name}</strong><br/>
              Rumbo: ${p.strike ?? "—"}
              ${sourceLine(p.source)}
            </div>`,
          );
        } else {
          const color = p.color ?? "#E85D3A";
          layer.bindPopup(
            `<div style="font-family:'IBM Plex Mono',monospace;font-size:11px;line-height:1.55;min-width:200px;">
              <strong style="color:${color};">${p.name}</strong><br/>
              Alteración: ${p.alteration ?? "—"}<br/>
              Score: <strong>${p.score ?? "—"}</strong>
              ${sourceLine(p.source)}
            </div>`,
          );
        }
      },
    }).addTo(map);
  }

  // Fit bounds a toda la geometría disponible
  const collect: [number, number][] = [];
  const collectFcs: AnyFC[] = [data.veins, data.palms, data.workings, data.drills];
  if (data.anomalies) collectFcs.push(data.anomalies);
  collectFcs.forEach((fc) => {
    fc.features.forEach((f) => {
      if (f.geometry.type === "Point") {
        const [lng, lat] = f.geometry.coordinates as [number, number];
        collect.push([lat, lng]);
      } else if (f.geometry.type === "LineString") {
        (f.geometry.coordinates as [number, number][]).forEach(([lng, lat]) =>
          collect.push([lat, lng]),
        );
      }
    });
  });
  if (collect.length) {
    map.fitBounds(L.latLngBounds(collect), { padding: [30, 30] });
  }
}
