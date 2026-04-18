import type { LeafletNS } from "./types";

/** Geological raster overlays. Macrostrat is global and reliable. */
export function buildGeologyOverlays(L: LeafletNS) {
  const macrostratGeology = L.tileLayer(
    "https://tiles.macrostrat.org/carto/{z}/{x}/{y}.png",
    {
      attribution:
        'Geología &copy; <a href="https://macrostrat.org">Macrostrat</a> (UW–Madison)',
      opacity: 0.75,
      maxZoom: 16,
      className: "macrostrat-overlay",
    }
  );

  return {
    "Geología Macrostrat (global)": macrostratGeology,
  };
}

/**
 * Catastro Minero SERNAGEOMIN — public ArcGIS FeatureServer used by the
 * official viewer at https://appsngmaz.sernageomin.cl/catastro_SNGM.
 * Layer 1 = WGS84_Pertenencia (concesiones de explotación).
 * Layer 2 = WGS84_Concesion   (concesiones de exploración).
 */
const CATASTRO_BASE =
  "https://services1.arcgis.com/OyjvVdFTl5hfSdX3/ArcGIS/rest/services/Marcelo_Layer/FeatureServer";

// Each FeatureServer layer has different fields, so we request all (*).
// Layer 1 (Pertenencia): OBJECTID, SUPERFICIE, VERTICES, NOMBRE, EstadoRegistro, ID_CONCESION, FECHA_*
// Layer 2 (Concesion):   NUMERO_ROL, DV_ROL, NOMBRE, HECTAREAS, FECHA_VENCIMIENTO, SITUACION_CONCESION, TIPO_CONCESION, COMUNA, TITULAR_DIVISION

export type CatastroKind = "explotacion" | "exploracion";

export function catastroQueryUrl(
  kind: CatastroKind,
  bbox: { minLng: number; minLat: number; maxLng: number; maxLat: number }
): string {
  const layer = kind === "explotacion" ? 1 : 2;
  const geometry = `${bbox.minLng},${bbox.minLat},${bbox.maxLng},${bbox.maxLat}`;
  const params = new URLSearchParams({
    where: "1=1",
    geometry,
    geometryType: "esriGeometryEnvelope",
    inSR: "4326",
    outSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    outFields: "*",
    returnGeometry: "true",
    f: "geojson",
  });
  return `${CATASTRO_BASE}/${layer}/query?${params.toString()}`;
}

export const CATASTRO_STYLE = {
  explotacion: {
    color: "#C8922A",
    weight: 1.5,
    opacity: 0.9,
    fillColor: "#C8922A",
    fillOpacity: 0.18,
    dashArray: undefined as string | undefined,
  },
  exploracion: {
    color: "#5DA3DD",
    weight: 1.5,
    opacity: 0.9,
    fillColor: "#5DA3DD",
    fillOpacity: 0.12,
    dashArray: "4 3",
  },
} as const;

export function catastroPopupHtml(
  kind: CatastroKind,
  p: Record<string, unknown>
): string {
  const titleColor = kind === "explotacion" ? "#C8922A" : "#5DA3DD";
  const label = kind === "explotacion" ? "Pertenencia (explotación)" : "Concesión (exploración)";
  const rol = `${p.NUMERO_ROL ?? "—"}${p.DV_ROL ? `-${p.DV_ROL}` : ""}`;
  const venc = p.FECHA_VENCIMIENTO
    ? new Date(Number(p.FECHA_VENCIMIENTO)).toLocaleDateString("es-CL")
    : "—";
  return `<div style="font-family:'IBM Plex Mono',monospace;font-size:11px;line-height:1.5;max-width:240px;">
    <strong style="color:${titleColor};">${p.NOMBRE ?? "Sin nombre"}</strong><br/>
    <span style="color:#A89080;">${label}</span><br/>
    ROL: <strong>${rol}</strong><br/>
    Titular: ${p.TITULAR_DIVISION ?? "—"}<br/>
    Comuna: ${p.COMUNA ?? "—"} · ${p.HECTAREAS ?? "?"} ha<br/>
    Vence: ${venc}<br/>
    <div style="margin-top:6px;padding-top:6px;border-top:1px solid #3a322c;color:#A89080;font-size:10px;">📎 SERNAGEOMIN · Catastro Minero (ArcGIS REST)</div>
  </div>`;
}

/** Macrostrat REST API: returns the geologic unit at a lat/lng. */
export async function fetchMacrostratUnit(lat: number, lng: number) {
  const url = `https://macrostrat.org/api/v2/geologic_units/map?lat=${lat}&lng=${lng}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Macrostrat ${r.status}`);
  const j = (await r.json()) as {
    success?: { data?: Array<Record<string, unknown>> };
  };
  return j.success?.data?.[0];
}

export function macrostratPopupHtml(
  unit: Record<string, unknown> | undefined,
  lat: number,
  lng: number
): string {
  if (!unit) {
    return `<div style="font-family:'IBM Plex Mono',monospace;font-size:11px;color:#A89080;">
      Sin unidad geológica reportada<br/>${lat.toFixed(5)}, ${lng.toFixed(5)}
    </div>`;
  }
  const name = (unit.name as string) ?? (unit.strat_name as string) ?? "Unidad geológica";
  const age = (unit.age as string) ?? (unit.b_age && unit.t_age ? `${unit.b_age}–${unit.t_age} Ma` : "—");
  const lith = (unit.lith as string) ?? "—";
  const descrip = (unit.descrip as string) ?? "";
  return `<div style="font-family:'IBM Plex Mono',monospace;font-size:11px;line-height:1.5;max-width:260px;">
    <strong style="color:#F0C96B;">${name}</strong><br/>
    Edad: ${age}<br/>
    Litología: ${lith}<br/>
    ${descrip ? `<div style="margin-top:4px;color:#A89080;font-size:10px;">${descrip.slice(0, 200)}${descrip.length > 200 ? "…" : ""}</div>` : ""}
    <div style="margin-top:6px;padding-top:6px;border-top:1px solid #3a322c;color:#A89080;font-size:10px;">📎 Macrostrat · ${lat.toFixed(4)}, ${lng.toFixed(4)}</div>
  </div>`;
}
