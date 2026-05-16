import type { LayerGroup } from "leaflet";
import type { LeafletNS } from "./types";
import type { SamplingResult } from "@/hooks/useSamplingResults";
import { auColor, auRadius } from "./sampleColors";

/** UTM (zone 19S, WGS84) → lat/lng. Auto-detects if coords look like lng/lat. */
function utmToLatLng(easting: number, northing: number, zone = 19, south = true): [number, number] {
  if (easting >= -180 && easting <= 180 && northing >= -90 && northing <= 90) {
    return [northing, easting];
  }
  const a = 6378137.0;
  const e = 0.081819190842622;
  const k0 = 0.9996;
  const e1sq = (e * e) / (1 - e * e);
  const x = easting - 500000;
  const y = south ? northing - 10000000 : northing;
  const m = y / k0;
  const mu = m / (a * (1 - (e * e) / 4 - (3 * e ** 4) / 64 - (5 * e ** 6) / 256));
  const e1 = (1 - Math.sqrt(1 - e * e)) / (1 + Math.sqrt(1 - e * e));
  const phi1 =
    mu +
    ((3 * e1) / 2 - (27 * e1 ** 3) / 32) * Math.sin(2 * mu) +
    ((21 * e1 ** 2) / 16 - (55 * e1 ** 4) / 32) * Math.sin(4 * mu) +
    ((151 * e1 ** 3) / 96) * Math.sin(6 * mu);
  const n1 = a / Math.sqrt(1 - (e * Math.sin(phi1)) ** 2);
  const t1 = Math.tan(phi1) ** 2;
  const c1 = e1sq * Math.cos(phi1) ** 2;
  const r1 = (a * (1 - e * e)) / Math.pow(1 - (e * Math.sin(phi1)) ** 2, 1.5);
  const d = x / (n1 * k0);
  const lat =
    phi1 -
    ((n1 * Math.tan(phi1)) / r1) *
      (d ** 2 / 2 - ((5 + 3 * t1 + 10 * c1 - 4 * c1 ** 2 - 9 * e1sq) * d ** 4) / 24);
  const lng =
    (((zone - 1) * 6 - 180 + 3) * Math.PI) / 180 +
    (d - ((1 + 2 * t1 + c1) * d ** 3) / 6) / Math.cos(phi1);
  return [(lat * 180) / Math.PI, (lng * 180) / Math.PI];
}

function sampleLatLng(s: SamplingResult): [number, number] | null {
  const e = (s as unknown as { easting?: number | null }).easting ?? null;
  const n = (s as unknown as { northing?: number | null }).northing ?? null;
  if (e == null || n == null) return null;
  try {
    return utmToLatLng(Number(e), Number(n));
  } catch {
    return null;
  }
}

function escape(s: string): string {
  return s.replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string,
  );
}

function popupHtml(s: SamplingResult): string {
  const au = s.au_gpt != null ? `${Number(s.au_gpt).toFixed(3)} g/t` : "—";
  const ag = s.ag_gpt != null ? `${Number(s.ag_gpt).toFixed(2)} g/t` : "—";
  const cu = s.cu_pct != null ? `${Number(s.cu_pct).toFixed(3)} %` : "—";
  const code = escape(s.sample_code);
  const type = escape(s.sample_type ?? "");
  const lab = s.lab ? escape(s.lab) : "—";
  return `<div style="font-family:'IBM Plex Mono',monospace;font-size:11px;line-height:1.5;min-width:180px;">
    <strong style="color:#C8922A;">${code}</strong>
    <div style="color:#A89080;text-transform:uppercase;font-size:9px;margin-bottom:4px;">${type}</div>
    <div>Au: <strong style="color:${auColor(s.au_gpt)};">${au}</strong></div>
    <div>Ag: ${ag}</div>
    <div>Cu: ${cu}</div>
    <div style="margin-top:4px;color:#A89080;font-size:10px;">Lab: ${lab}</div>
  </div>`;
}

export function buildSamplesLayer(
  L: LeafletNS,
  samples: SamplingResult[],
  opts: { onClick?: (s: SamplingResult) => void; minAu?: number } = {},
): LayerGroup {
  const group = L.layerGroup();
  const min = opts.minAu ?? null;
  for (const s of samples) {
    if (min != null && (s.au_gpt ?? 0) < min) continue;
    const ll = sampleLatLng(s);
    if (!ll) continue;
    const marker = L.circleMarker(ll, {
      radius: auRadius(s.au_gpt),
      color: "#fff",
      weight: 1,
      fillColor: auColor(s.au_gpt),
      fillOpacity: 0.85,
    });
    marker.bindPopup(popupHtml(s));
    if (opts.onClick) marker.on("click", () => opts.onClick?.(s));
    marker.addTo(group);
  }
  return group;
}
