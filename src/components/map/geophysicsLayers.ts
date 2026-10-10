import type { LayerGroup, Map as LeafletMap } from "leaflet";
import type { LeafletNS } from "./types";
import type { GeophysicsSurface } from "@/lib/geoscience/geophysicsSurface";
import type { AnomalySurface } from "@/lib/geoscience/anomalySurface";
import { anomalyIntensityColor } from "@/lib/geoscience/anomalySurface";
import type {
  GeophysicsLine,
  GeophysicsStation,
  GeophysicsSurvey,
} from "@/hooks/useGeophysicsData";

const METHOD_COLOR: Record<string, string> = {
  Magnetometry: "#E11D48",
  "Magnetometría terrestre": "#E11D48",
  "Magnetometría aérea": "#F43F5E",
  "IP-Resistivity": "#7C3AED",
  "IP — Cargabilidad": "#7C3AED",
  "IP — Resistividad": "#A78BFA",
  CSAMT: "#0EA5E9",
  Gravimetría: "#10B981",
  Radiometría: "#F59E0B",
  TEM: "#06B6D4",
  Sísmica: "#8B5CF6",
};

function colorFor(survey: GeophysicsSurvey | undefined): string {
  if (!survey) return "#888";
  return METHOD_COLOR[survey.method] ?? "#888";
}

export type MagStats = {
  baseline: number;
  min: number;
  max: number;
  count: number;
};

export function computeMagStats(stations: GeophysicsStation[]): MagStats | null {
  const vals = stations.map((s) => s.mag_nt).filter((v): v is number => v != null);
  if (!vals.length) return null;
  const baseline = vals.reduce((a, b) => a + b, 0) / vals.length;
  return { baseline, min: Math.min(...vals), max: Math.max(...vals), count: vals.length };
}

/** Diverging blue→white→red color for magnetometry anomaly */
export function magColor(anomaly: number, span: number): string {
  if (span <= 0) return "#9ca3af";
  const t = Math.max(-1, Math.min(1, anomaly / span));
  if (t >= 0) {
    // white → red
    const r = 255;
    const g = Math.round(255 - 200 * t);
    const b = Math.round(255 - 220 * t);
    return `rgb(${r},${g},${b})`;
  } else {
    const t2 = -t;
    const r = Math.round(255 - 220 * t2);
    const g = Math.round(255 - 180 * t2);
    const b = 255;
    return `rgb(${r},${g},${b})`;
  }
}

type BuildOptions = {
  /** When true, omit the "SIMULADO" badge in popups (real field captures). */
  realData?: boolean;
};

/** Renders geophysics lines + magnetometry stations as a layer group. */
export function buildGeophysicsLayer(
  L: LeafletNS,
  surveys: GeophysicsSurvey[],
  lines: GeophysicsLine[],
  stations: GeophysicsStation[],
  opts: BuildOptions = {},
): LayerGroup {
  const group = L.layerGroup();
  const surveyById = new Map(surveys.map((s) => [s.id, s]));
  const stats = computeMagStats(stations);
  const span = stats
    ? Math.max(Math.abs(stats.max - stats.baseline), Math.abs(stats.min - stats.baseline), 1)
    : 1;

  for (const ln of lines) {
    const s = ln.survey_id ? surveyById.get(ln.survey_id) : undefined;
    const color = colorFor(s);
    const coords = ln.geometry_geojson?.coordinates ?? [];
    const latlngs = coords.map(([lng, lat]) => [lat, lng]) as [number, number][];
    if (latlngs.length < 2) continue;
    const isSyn = ln.is_synthetic;
    const polyline = L.polyline(latlngs, {
      color,
      weight: isSyn ? 2.5 : 3.5,
      opacity: 0.9,
      dashArray: isSyn ? "6 4" : undefined,
    });
    const badge =
      isSyn && !opts.realData
        ? `<span style="background:#7c3aed22;color:#a78bfa;padding:1px 6px;border-radius:3px;font-size:9px;margin-left:6px;">SIMULADO</span>`
        : !isSyn
          ? `<span style="background:#10b98122;color:#34d399;padding:1px 6px;border-radius:3px;font-size:9px;margin-left:6px;">REAL</span>`
          : "";
    polyline.bindPopup(
      `<div style="font-family:'IBM Plex Mono',monospace;font-size:11px;line-height:1.5;max-width:240px;">
        <strong style="color:${color};">${ln.line_id}</strong>${badge}<br/>
        ${s?.name ?? "—"}<br/>
        Método: ${s?.method ?? "—"}${ln.length_m != null ? ` · ${ln.length_m.toFixed(0)} m` : ""}
        ${ln.notes ? `<div style="margin-top:4px;color:#A89080;font-size:10px;">${ln.notes}</div>` : ""}
      </div>`,
    );
    group.addLayer(polyline);
  }

  // Stations: diverging color by magnetometry anomaly; size by magnitude
  for (const st of stations) {
    const s = st.survey_id ? surveyById.get(st.survey_id) : undefined;
    const surveyColor = colorFor(s);
    const hasMag = st.mag_nt != null;
    const anomaly = hasMag && stats ? (st.mag_nt as number) - stats.baseline : 0;
    const radius = hasMag
      ? Math.min(10, Math.max(4, 4 + Math.abs(anomaly) / Math.max(span / 6, 1)))
      : 4;
    const fill = hasMag ? magColor(anomaly, span) : "#9ca3af";
    const isSyn = st.is_synthetic;
    const marker = L.circleMarker([st.lat, st.lng], {
      radius,
      color: isSyn ? surveyColor : "#0f172a",
      weight: isSyn ? 1 : 2,
      fillColor: fill,
      fillOpacity: 0.85,
    });
    const badge =
      isSyn && !opts.realData
        ? `<span style="background:#7c3aed22;color:#a78bfa;padding:1px 6px;border-radius:3px;font-size:9px;margin-left:6px;">SIMULADO</span>`
        : !isSyn
          ? `<span style="background:#10b98122;color:#34d399;padding:1px 6px;border-radius:3px;font-size:9px;margin-left:6px;">CAMPO</span>`
          : "";
    const ip = [
      st.ip_chargeability_mvv != null
        ? `IP carg: <strong>${st.ip_chargeability_mvv} mV/V</strong>`
        : null,
      st.ip_resistivity_ohmm != null
        ? `IP resist: <strong>${st.ip_resistivity_ohmm} Ω·m</strong>`
        : null,
    ]
      .filter(Boolean)
      .join("<br/>");
    marker.bindPopup(
      `<div style="font-family:'IBM Plex Mono',monospace;font-size:11px;line-height:1.5;min-width:200px;">
        <strong style="color:${surveyColor};">${st.station_id}</strong>${badge}<br/>
        <span style="color:#A89080;font-size:10px;">${s?.name ?? "Sin campaña"} · ${s?.method ?? "—"}</span><br/>
        ${hasMag ? `Mag: <strong>${(st.mag_nt as number).toFixed(1)} nT</strong> · <span style="color:${anomaly >= 0 ? "#dc2626" : "#1d4ed8"};">${anomaly >= 0 ? "+" : ""}${anomaly.toFixed(1)}</span><br/>` : ""}
        ${ip ? `${ip}<br/>` : ""}
        <span style="color:#A89080;font-size:10px;">${st.lat.toFixed(5)}, ${st.lng.toFixed(5)}</span>
        ${st.notes ? `<div style="margin-top:4px;color:#A89080;font-size:10px;border-top:1px solid #3a322c;padding-top:4px;">${st.notes}</div>` : ""}
      </div>`,
    );
    group.addLayer(marker);
  }

  return group;
}

export function fitToGeophysics(
  L: LeafletNS,
  map: LeafletMap,
  lines: GeophysicsLine[],
  stations: GeophysicsStation[],
) {
  const pts: [number, number][] = [];
  for (const ln of lines) {
    for (const [lng, lat] of ln.geometry_geojson?.coordinates ?? []) pts.push([lat, lng]);
  }
  for (const s of stations) pts.push([s.lat, s.lng]);
  if (pts.length) map.fitBounds(L.latLngBounds(pts), { padding: [30, 30] });
}

export function geophysicsSurfaceColor(surface: GeophysicsSurface, normalized: number, value: number): string {
  if (surface.metric === "mag_residual_nt") {
    const span = Math.max(Math.abs(surface.min), Math.abs(surface.max), 1);
    return magColor(value, span);
  }
  const t = Math.max(0, Math.min(1, normalized));
  if (surface.metric === "ip_chargeability_mvv") {
    const r = Math.round(237 - 128 * t);
    const g = Math.round(233 - 193 * t);
    const b = Math.round(254 - 37 * t);
    return `rgb(${r},${g},${b})`;
  }
  const r = Math.round(224 - 194 * t);
  const g = Math.round(242 - 107 * t);
  const b = Math.round(254 - 26 * t);
  return `rgb(${r},${g},${b})`;
}

/**
 * Renders an IDW surface derived exclusively from non-synthetic field stations.
 * This is a visualization/interpolation layer, NOT a geophysical inversion.
 */
export function buildGeophysicsSurfaceLayer(L: LeafletNS, surface: GeophysicsSurface): LayerGroup {
  const group = L.layerGroup();

  for (const cell of surface.cells) {
    const rectangle = L.rectangle(
      [
        [cell.south, cell.west],
        [cell.north, cell.east],
      ],
      {
        stroke: false,
        fillColor: geophysicsSurfaceColor(surface, cell.normalized, cell.value),
        fillOpacity: 0.42,
        interactive: true,
      },
    );
    rectangle.bindTooltip(
      `<div style="font-family:'IBM Plex Mono',monospace;font-size:10px;">
        <strong>${cell.value.toFixed(2)} ${surface.unit}</strong><br/>
        DERIVADO · IDW desde ${surface.sourceCount} estaciones CAMPO<br/>
        No es inversión geofísica.
      </div>`,
      { sticky: true },
    );
    group.addLayer(rectangle);
  }

  return group;
}

/**
 * Renders an IDW-interpolated color surface (e.g. anomalías satelitales por
 * z-score) as a grid of rectangles — mismo lenguaje visual que un mapa de
 * kriging. Es interpolación/visualización, NO una medición continua.
 */
export function buildAnomalySurfaceLayer(L: LeafletNS, surface: AnomalySurface): LayerGroup {
  const group = L.layerGroup();

  for (const cell of surface.cells) {
    const rectangle = L.rectangle(
      [
        [cell.south, cell.west],
        [cell.north, cell.east],
      ],
      {
        stroke: false,
        fillColor: anomalyIntensityColor(cell.normalized),
        fillOpacity: 0.45,
        interactive: true,
      },
    );
    rectangle.bindTooltip(
      `<div style="font-family:'IBM Plex Mono',monospace;font-size:10px;">
        <strong>${cell.value.toFixed(2)} ${surface.unit}</strong><br/>
        DERIVADO · IDW desde ${surface.sourceCount} anomalías detectadas<br/>
        Interpolación de intensidad, no es una medición continua.
      </div>`,
      { sticky: true },
    );
    group.addLayer(rectangle);
  }

  return group;
}
