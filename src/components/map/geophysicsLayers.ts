import type { LayerGroup, Map as LeafletMap } from "leaflet";
import type { LeafletNS } from "./types";
import type { GeophysicsLine, GeophysicsStation, GeophysicsSurvey } from "@/hooks/useGeophysicsData";

const METHOD_COLOR: Record<string, string> = {
  Magnetometry: "#E11D48", // rojo
  "IP-Resistivity": "#7C3AED", // violeta
  CSAMT: "#0EA5E9", // cyan
};

function colorFor(survey: GeophysicsSurvey | undefined): string {
  if (!survey) return "#888";
  return METHOD_COLOR[survey.method] ?? "#888";
}

/** Renders geophysics lines + magnetometry stations as a layer group. */
export function buildGeophysicsLayer(
  L: LeafletNS,
  surveys: GeophysicsSurvey[],
  lines: GeophysicsLine[],
  stations: GeophysicsStation[]
): LayerGroup {
  const group = L.layerGroup();
  const surveyById = new Map(surveys.map((s) => [s.id, s]));

  for (const ln of lines) {
    const s = ln.survey_id ? surveyById.get(ln.survey_id) : undefined;
    const color = colorFor(s);
    const coords = ln.geometry_geojson?.coordinates ?? [];
    const latlngs = coords.map(([lng, lat]) => [lat, lng]) as [number, number][];
    if (latlngs.length < 2) continue;
    const polyline = L.polyline(latlngs, {
      color,
      weight: 2.5,
      opacity: 0.9,
      dashArray: "6 4",
    });
    polyline.bindPopup(
      `<div style="font-family:'IBM Plex Mono',monospace;font-size:11px;line-height:1.5;max-width:240px;">
        <strong style="color:${color};">${ln.line_id}</strong>
        <span style="background:#7c3aed22;color:#a78bfa;padding:1px 6px;border-radius:3px;font-size:9px;margin-left:6px;">SIMULADO</span><br/>
        ${s?.name ?? "—"}<br/>
        Método: ${s?.method ?? "—"} · ${ln.length_m ?? "?"} m
        ${ln.notes ? `<div style="margin-top:4px;color:#A89080;font-size:10px;">${ln.notes}</div>` : ""}
      </div>`
    );
    group.addLayer(polyline);
  }

  // Stations: size proportional to mag_nt anomaly relative to baseline
  const magVals = stations.map((s) => s.mag_nt).filter((v): v is number => v != null);
  const baseline = magVals.length ? magVals.reduce((a, b) => a + b, 0) / magVals.length : 24500;
  for (const st of stations) {
    if (st.mag_nt == null) continue;
    const s = st.survey_id ? surveyById.get(st.survey_id) : undefined;
    const color = colorFor(s);
    const anomaly = st.mag_nt - baseline;
    const radius = Math.min(8, Math.max(3, Math.abs(anomaly) / 30));
    const fill = anomaly > 0 ? "#dc2626" : "#1d4ed8";
    const marker = L.circleMarker([st.lat, st.lng], {
      radius,
      color,
      weight: 1,
      fillColor: fill,
      fillOpacity: 0.7,
    });
    marker.bindPopup(
      `<div style="font-family:'IBM Plex Mono',monospace;font-size:11px;line-height:1.5;">
        <strong style="color:${color};">${st.station_id}</strong>
        <span style="background:#7c3aed22;color:#a78bfa;padding:1px 6px;border-radius:3px;font-size:9px;margin-left:6px;">SIMULADO</span><br/>
        Mag total: <strong>${st.mag_nt.toFixed(1)} nT</strong><br/>
        Anomalía: <strong style="color:${anomaly > 0 ? "#dc2626" : "#1d4ed8"};">${anomaly >= 0 ? "+" : ""}${anomaly.toFixed(1)} nT</strong><br/>
        ${st.lat.toFixed(5)}, ${st.lng.toFixed(5)}
      </div>`
    );
    group.addLayer(marker);
  }

  return group;
}

export function fitToGeophysics(
  L: LeafletNS,
  map: LeafletMap,
  lines: GeophysicsLine[],
  stations: GeophysicsStation[]
) {
  const pts: [number, number][] = [];
  for (const ln of lines) {
    for (const [lng, lat] of ln.geometry_geojson?.coordinates ?? []) pts.push([lat, lng]);
  }
  for (const s of stations) pts.push([s.lat, s.lng]);
  if (pts.length) map.fitBounds(L.latLngBounds(pts), { padding: [30, 30] });
}
