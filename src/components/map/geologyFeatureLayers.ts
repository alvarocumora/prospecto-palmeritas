import type { LayerGroup } from "leaflet";
import type { LeafletNS } from "./types";
import type {
  AlterationMapUnit,
  GeologicalFeatureRow,
  LithologyMapUnit,
} from "@/hooks/useProjectGeologyMap";

const DEFAULT_LITHO_COLOR = "#a8794d";
const DEFAULT_ALT_COLOR = "#c08aff";

export type GeologyLegendEntry = {
  id: string;
  code: string;
  label: string;
  color: string;
  count: number;
  sub?: string | null;
};

export type GeologyLayerBuild = {
  lithologyLayer: LayerGroup;
  alterationLayer: LayerGroup;
  lithologyLegend: GeologyLegendEntry[];
  alterationLegend: GeologyLegendEntry[];
};

function esc(v: unknown): string {
  if (v == null) return "—";
  return String(v).replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c] ?? c);
}

function lithoPopup(f: GeologicalFeatureRow, unit: LithologyMapUnit | undefined): string {
  return `<div style="font-family:'IBM Plex Mono',monospace;font-size:11px;line-height:1.5;max-width:280px;">
    <strong style="color:${unit?.color_hex ?? DEFAULT_LITHO_COLOR};">${esc(f.name)}</strong>
    <span style="color:#8a7e72;"> · ${esc(f.feature_code)}</span><br/>
    <span style="color:#A89080;">Host rock: <strong style="color:#F0C96B;">${esc(unit?.name ?? "Sin asignar")}</strong></span><br/>
    ${unit?.rock_type ? `Tipo: ${esc(unit.rock_type)}<br/>` : ""}
    ${unit?.formation ? `Formación: ${esc(unit.formation)}<br/>` : ""}
    ${unit?.age ? `Edad: ${esc(unit.age)}<br/>` : ""}
    ${f.strike || f.dip ? `Strike/Dip: ${esc(f.strike)} / ${esc(f.dip)}<br/>` : ""}
    ${f.length_m ? `Largo: ${Number(f.length_m).toFixed(0)} m<br/>` : ""}
    ${f.description ? `<div style="margin-top:4px;color:#A89080;font-size:10px;">${esc(f.description).slice(0, 200)}</div>` : ""}
  </div>`;
}

function altPopup(f: GeologicalFeatureRow, unit: AlterationMapUnit | undefined): string {
  return `<div style="font-family:'IBM Plex Mono',monospace;font-size:11px;line-height:1.5;max-width:280px;">
    <strong style="color:${unit?.color_hex ?? DEFAULT_ALT_COLOR};">${esc(f.name)}</strong>
    <span style="color:#8a7e72;"> · ${esc(f.feature_code)}</span><br/>
    <span style="color:#A89080;">Alteración: <strong style="color:#C08AFF;">${esc(unit?.name ?? "Sin asignar")}</strong></span><br/>
    ${unit?.assemblage ? `Ensamble: ${esc(unit.assemblage)}<br/>` : ""}
    ${unit?.intensity ? `Intensidad: ${esc(unit.intensity)}<br/>` : ""}
    ${f.description ? `<div style="margin-top:4px;color:#A89080;font-size:10px;">${esc(f.description).slice(0, 200)}</div>` : ""}
  </div>`;
}

export function buildGeologyFeatureLayers(
  L: LeafletNS,
  data: {
    features: GeologicalFeatureRow[];
    lithology: LithologyMapUnit[];
    alteration: AlterationMapUnit[];
  },
): GeologyLayerBuild {
  const lithoLayer = L.layerGroup();
  const altLayer = L.layerGroup();

  const lithoById = new Map(data.lithology.map((u) => [u.id, u]));
  const altById = new Map(data.alteration.map((u) => [u.id, u]));

  const lithoCounts = new Map<string, number>();
  const altCounts = new Map<string, number>();

  for (const f of data.features) {
    if (!f.geometry_geojson) continue;
    const geom = f.geometry_geojson;

    // Host rock layer
    if (f.lithology_id) {
      const unit = lithoById.get(f.lithology_id);
      const color = unit?.color_hex ?? DEFAULT_LITHO_COLOR;
      const layer = L.geoJSON(geom, {
        style: {
          color,
          weight: 1.5,
          opacity: 0.95,
          fillColor: color,
          fillOpacity: 0.4,
        },
        pointToLayer: (_feat, latlng) =>
          L.circleMarker(latlng, {
            radius: 6,
            color,
            weight: 1.5,
            fillColor: color,
            fillOpacity: 0.85,
          }),
      });
      layer.bindTooltip(`${unit?.name ?? f.name} · ${f.feature_code}`, {
        sticky: true,
        direction: "top",
        className: "geo-tooltip",
      });
      layer.bindPopup(lithoPopup(f, unit));
      layer.addTo(lithoLayer);
      lithoCounts.set(f.lithology_id, (lithoCounts.get(f.lithology_id) ?? 0) + 1);
    }

    // Alteration layer
    if (f.alteration_id) {
      const unit = altById.get(f.alteration_id);
      const color = unit?.color_hex ?? DEFAULT_ALT_COLOR;
      const layer = L.geoJSON(geom, {
        style: {
          color,
          weight: 1.2,
          opacity: 0.85,
          dashArray: "4 3",
          fillColor: color,
          fillOpacity: 0.3,
        },
        pointToLayer: (_feat, latlng) =>
          L.circleMarker(latlng, {
            radius: 5,
            color,
            weight: 1.2,
            fillColor: color,
            fillOpacity: 0.75,
          }),
      });
      layer.bindTooltip(`${unit?.name ?? f.name} · ${f.feature_code}`, {
        sticky: true,
        direction: "top",
        className: "geo-tooltip",
      });
      layer.bindPopup(altPopup(f, unit));
      layer.addTo(altLayer);
      altCounts.set(f.alteration_id, (altCounts.get(f.alteration_id) ?? 0) + 1);
    }
  }

  const lithoLegend: GeologyLegendEntry[] = data.lithology
    .filter((u) => (lithoCounts.get(u.id) ?? 0) > 0)
    .map((u) => ({
      id: u.id,
      code: u.unit_code,
      label: u.name,
      color: u.color_hex ?? DEFAULT_LITHO_COLOR,
      count: lithoCounts.get(u.id) ?? 0,
      sub: u.rock_type ?? u.formation ?? u.age,
    }));

  const altLegend: GeologyLegendEntry[] = data.alteration
    .filter((u) => (altCounts.get(u.id) ?? 0) > 0)
    .map((u) => ({
      id: u.id,
      code: u.zone_code,
      label: u.name,
      color: u.color_hex ?? DEFAULT_ALT_COLOR,
      count: altCounts.get(u.id) ?? 0,
      sub: u.assemblage ?? u.intensity,
    }));

  return {
    lithologyLayer: lithoLayer,
    alterationLayer: altLayer,
    lithologyLegend: lithoLegend,
    alterationLegend: altLegend,
  };
}
