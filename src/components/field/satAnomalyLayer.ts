// Capa Leaflet: anomalías satelitales del proyecto activo (project.satellite_anomalies).
// Polígonos coloreados por índice mineralógico + halo según severidad.
import type { LayerGroup } from "leaflet";
import type { AnomalyRow, SatIndexCode } from "@/hooks/useProjectSatelliteAnomalies";

type LeafletNS = typeof import("leaflet");

const INDEX_COLOR: Record<SatIndexCode, string> = {
  IRON_OXIDE: "#dc5a28",
  CLAY_MINERALS: "#dcc850",
  HYDROTHERMAL_ALTERATION: "#c83cc8",
  STRUCTURAL_LINEAMENTS: "#50c8e6",
};

const INDEX_LABEL: Record<SatIndexCode, string> = {
  IRON_OXIDE: "Óxidos de Fe",
  CLAY_MINERALS: "Arcillas",
  HYDROTHERMAL_ALTERATION: "Alteración hidrotermal",
  STRUCTURAL_LINEAMENTS: "Lineamientos estructurales",
};

const SEVERITY_OPACITY: Record<string, number> = {
  low: 0.18,
  medium: 0.32,
  high: 0.48,
};

export function buildSatAnomalyOverlay(
  L: LeafletNS,
  anomalies: AnomalyRow[],
): LayerGroup {
  const group = L.layerGroup();
  for (const a of anomalies) {
    if (!a.geometry) continue;
    const color = INDEX_COLOR[a.index_code] ?? "#facc15";
    const fillOpacity = SEVERITY_OPACITY[a.severity] ?? 0.25;
    try {
      const layer = L.geoJSON(a.geometry as never, {
        style: () => ({
          color,
          weight: a.index_code === "STRUCTURAL_LINEAMENTS" ? 2.5 : 1.5,
          opacity: 0.9,
          fillColor: color,
          fillOpacity,
        }),
        pointToLayer: (_f, latlng) =>
          L.circleMarker(latlng, {
            radius: 6 + (a.score ?? 50) / 20,
            color,
            weight: 2,
            fillColor: color,
            fillOpacity,
          }),
      });
      layer.bindPopup(
        `<div style="font-family:monospace;font-size:11px;min-width:180px">
          <div style="color:${color};font-weight:700">${INDEX_LABEL[a.index_code]}</div>
          <div style="color:#A89080;margin-top:3px">Severidad: ${a.severity}</div>
          <div style="color:#A89080">Score: ${(a.score ?? 0).toFixed(0)}</div>
          ${a.area_ha != null ? `<div style="color:#A89080">Área: ${a.area_ha.toFixed(1)} ha</div>` : ""}
          ${a.notes ? `<div style="color:#A89080;margin-top:3px">${a.notes}</div>` : ""}
        </div>`,
      );
      group.addLayer(layer);
    } catch {
      /* skip malformed geometry */
    }
  }
  return group;
}

export { INDEX_COLOR, INDEX_LABEL };
