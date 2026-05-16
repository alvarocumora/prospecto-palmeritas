import type { LayerGroup } from "leaflet";
import type { LeafletNS } from "./types";
import type { DrillHole } from "@/hooks/useDrilling";
import { STATUS_COLORS, STATUS_LABELS, progressPct } from "@/hooks/useDrilling";

/** UTM (WGS84) → lat/lng. Default zone 19S (typical for central Chile). */
function utmToLatLng(easting: number, northing: number, zone = 19, south = true): [number, number] {
  const a = 6378137.0;
  const f = 1 / 298.257223563;
  const k0 = 0.9996;
  const e2 = f * (2 - f);
  const ep2 = e2 / (1 - e2);

  const x = easting - 500000.0;
  const y = south ? northing - 10000000.0 : northing;

  const M = y / k0;
  const mu = M / (a * (1 - e2 / 4 - (3 * e2 * e2) / 64 - (5 * e2 * e2 * e2) / 256));
  const e1 = (1 - Math.sqrt(1 - e2)) / (1 + Math.sqrt(1 - e2));

  const J1 = (3 * e1) / 2 - (27 * e1 ** 3) / 32;
  const J2 = (21 * e1 ** 2) / 16 - (55 * e1 ** 4) / 32;
  const J3 = (151 * e1 ** 3) / 96;
  const J4 = (1097 * e1 ** 4) / 512;

  const fp =
    mu +
    J1 * Math.sin(2 * mu) +
    J2 * Math.sin(4 * mu) +
    J3 * Math.sin(6 * mu) +
    J4 * Math.sin(8 * mu);

  const sinFp = Math.sin(fp);
  const cosFp = Math.cos(fp);
  const tanFp = Math.tan(fp);

  const C1 = ep2 * cosFp * cosFp;
  const T1 = tanFp * tanFp;
  const R1 = (a * (1 - e2)) / Math.pow(1 - e2 * sinFp * sinFp, 1.5);
  const N1 = a / Math.sqrt(1 - e2 * sinFp * sinFp);
  const D = x / (N1 * k0);

  const Q1 = (N1 * tanFp) / R1;
  const Q2 = (D * D) / 2;
  const Q3 = ((5 + 3 * T1 + 10 * C1 - 4 * C1 * C1 - 9 * ep2) * Math.pow(D, 4)) / 24;
  const Q4 =
    ((61 + 90 * T1 + 298 * C1 + 45 * T1 * T1 - 252 * ep2 - 3 * C1 * C1) * Math.pow(D, 6)) / 720;
  const lat = fp - Q1 * (Q2 - Q3 + Q4);

  const Q5 = D;
  const Q6 = ((1 + 2 * T1 + C1) * Math.pow(D, 3)) / 6;
  const Q7 = ((5 - 2 * C1 + 28 * T1 - 3 * C1 * C1 + 8 * ep2 + 24 * T1 * T1) * Math.pow(D, 5)) / 120;
  const lon = (Q5 - Q6 + Q7) / cosFp;

  const lonOrigin = ((zone - 1) * 6 - 180 + 3) * (Math.PI / 180);
  const longitude = (lonOrigin + lon) * (180 / Math.PI);
  const latitude = lat * (180 / Math.PI);
  return [latitude, longitude];
}

/** Auto-detect: if values look like lng/lat, use directly; else UTM 19S. */
function holeLatLng(h: DrillHole): [number, number] | null {
  if (h.easting == null || h.northing == null) return null;
  const e = Number(h.easting);
  const n = Number(h.northing);
  if (!Number.isFinite(e) || !Number.isFinite(n)) return null;
  if (Math.abs(e) <= 180 && Math.abs(n) <= 90) {
    // easting=lng, northing=lat
    return [n, e];
  }
  return utmToLatLng(e, n, 19, true);
}

function popupHtml(h: DrillHole): string {
  const color = STATUS_COLORS[h.status] ?? "#64748b";
  const label = STATUS_LABELS[h.status] ?? h.status;
  const pct = progressPct(h);
  const planned = h.planned_depth != null ? `${h.planned_depth} m` : "—";
  const actual = h.actual_depth != null ? `${h.actual_depth} m` : "—";
  const az = h.azimuth != null ? `${h.azimuth}°` : "—";
  const dip = h.dip != null ? `${h.dip}°` : "—";
  return `<div style="font-family:'IBM Plex Mono',monospace;font-size:11px;line-height:1.6;min-width:180px;">
    <strong style="color:${color};font-size:13px;">${h.hole_id}</strong>
    <span style="display:inline-block;margin-left:6px;padding:1px 6px;border-radius:3px;background:${color}33;color:${color};font-size:10px;text-transform:uppercase;letter-spacing:0.04em;">${label}</span>
    ${h.target_zone ? `<div style="color:#A89080;margin-top:4px;">Zona: ${h.target_zone}</div>` : ""}
    <div style="margin-top:6px;border-top:1px solid #3a322c;padding-top:6px;">
      Prof real: <strong>${actual}</strong> / plan ${planned}<br/>
      Avance: <strong>${pct}%</strong><br/>
      Az ${az} · Incl ${dip}
    </div>
  </div>`;
}

/** Build a LayerGroup of circleMarker collars colored by status, with optional mineralization halos. */
export function buildDrillCollarsLayer(
  L: LeafletNS,
  holes: DrillHole[],
  scoresByHole?: Record<string, number>,
  haloStyleFor?: (score: number) => { color: string; radius: number; label: string } | null,
): LayerGroup {
  const group = L.layerGroup();
  for (const h of holes) {
    const ll = holeLatLng(h);
    if (!ll) continue;

    // Halo first (so it renders below the collar dot)
    const score = scoresByHole?.[h.id] ?? 0;
    const halo = haloStyleFor && score > 0 ? haloStyleFor(score) : null;
    if (halo) {
      const haloMarker = L.circleMarker(ll, {
        radius: halo.radius,
        color: halo.color,
        weight: 2.5,
        opacity: 0.9,
        fillColor: halo.color,
        fillOpacity: 0.18,
        interactive: false,
      });
      group.addLayer(haloMarker);
    }

    const color = STATUS_COLORS[h.status] ?? "#64748b";
    const marker = L.circleMarker(ll, {
      radius: 6,
      color: "#0b0d10",
      weight: 1.5,
      fillColor: color,
      fillOpacity: 0.95,
    });
    let popup = popupHtml(h);
    if (halo && score > 0) {
      popup = popup.replace(
        "</div></div>",
        `</div><div style="margin-top:6px;border-top:1px solid #3a322c;padding-top:6px;">Mejor intercept: <strong style="color:${halo.color};">${score.toFixed(1)} g·m/t</strong> <span style="color:#A89080;">(${halo.label})</span></div></div>`,
      );
    }
    marker.bindPopup(popup);
    marker.bindTooltip(h.hole_id, {
      direction: "top",
      offset: [0, -8],
      className: "drill-collar-tooltip",
    });
    group.addLayer(marker);
  }
  return group;
}
