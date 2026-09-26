import type { LeafletNS } from "./types";
import { SNGM_CONCESIONES_URL, sngmQueryGeoJSON } from "@/lib/sngm";

export type CadastreMatch = "official" | "project_exact" | "project_candidate";


function roleOf(p: Record<string, unknown>) {
  const n = String(p.NUMERO_ROL ?? "").trim();
  const dv = String(p.DV_ROL ?? "").trim();
  return dv ? `${n}-${dv}` : n || "—";
}

export async function queryOfficialCadastreByBounds(bounds: {
  west: number;
  south: number;
  east: number;
  north: number;
}) {
  return sngmQueryGeoJSON(SNGM_CONCESIONES_URL, {
    bbox: [bounds.west, bounds.south, bounds.east, bounds.north],
    limit: 2000,
    outFields:
      "OBJECTID,NUMERO_ROL,DV_ROL,NOMBRE,HECTAREAS,FECHA_VENCIMIENTO,SITUACION_CONCESION,TIPO_CONCESION,COMUNA,TITULAR_NOMBRE,TITULAR_RUT,TITULAR_DV,DATUM,HUSO",
  });
}

export function buildOfficialCadastreLayer(
  L: LeafletNS,
  fc: GeoJSON.FeatureCollection,
  projectNames: Set<string> = new Set(),
) {
  return L.geoJSON(fc as never, {
    style: (feature) => {
      const p = (feature?.properties ?? {}) as Record<string, unknown>;
      const name = String(p.NOMBRE ?? "")
        .trim()
        .toUpperCase();
      const exact = projectNames.has(name);
      const exploration = String(p.TIPO_CONCESION ?? "").toUpperCase() === "EXPLORACION";
      const color = exact ? "#22c55e" : exploration ? "#38bdf8" : "#f59e0b";
      return {
        color,
        weight: exact ? 2.8 : 1.4,
        fillColor: color,
        fillOpacity: exact ? 0.16 : 0.055,
      };
    },
    onEachFeature: (feature, layer) => {
      const p = (feature.properties ?? {}) as Record<string, unknown>;
      const name = String(p.NOMBRE ?? "Concesión");
      const exact = projectNames.has(name.trim().toUpperCase());
      const el = document.createElement("div");
      el.style.cssText = "font-family:ui-monospace,monospace;font-size:11px;line-height:1.5";
      const rows = [
        [exact ? "MATCH PROYECTO · SERNAGEOMIN" : "CATASTRO OFICIAL SERNAGEOMIN", name],
        ["Rol", roleOf(p)],
        ["Titular", p.TITULAR_NOMBRE],
        ["Tipo", p.TIPO_CONCESION],
        ["Situación", p.SITUACION_CONCESION],
        ["Superficie", p.HECTAREAS != null ? `${p.HECTAREAS} ha` : "—"],
        ["Comuna", p.COMUNA],
        ["Datum / huso original", `${p.DATUM ?? "—"} / ${p.HUSO ?? "—"}`],
      ];
      rows.forEach(([k, v], i) => {
        const row = document.createElement(i === 0 ? "strong" : "div");
        row.textContent = i === 0 ? `${k}: ${v}` : `${k}: ${v ?? "—"}`;
        el.appendChild(row);
      });
      layer.bindPopup(el);
    },
    attribution:
      'Catastro de Concesiones Mineras &copy; <a href="https://www.sernageomin.cl">SERNAGEOMIN</a>',
  });
}

export function normalizedProjectNames(fc: GeoJSON.FeatureCollection) {
  const names = new Set<string>();
  for (const f of fc.features) {
    const p = (f.properties ?? {}) as Record<string, unknown>;
    for (const key of ["name", "NOMBRE", "nombre", "concesion"]) {
      const value = String(p[key] ?? "").trim();
      if (value) names.add(value.toUpperCase());
    }
  }
  return names;
}
