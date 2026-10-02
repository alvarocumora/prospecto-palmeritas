import type { LeafletNS } from "./types";
import { SNGM_CONCESIONES_URL } from "@/lib/sngm";

/** Geological raster overlays. Macrostrat is global and reliable. */
export function buildGeologyOverlays(L: LeafletNS) {
  const macrostratGeology = L.tileLayer("https://tiles.macrostrat.org/carto/{z}/{x}/{y}.png", {
    attribution: 'Geología &copy; <a href="https://macrostrat.org">Macrostrat</a> (UW–Madison)',
    opacity: 0.75,
    maxZoom: 16,
    className: "macrostrat-overlay",
  });

  return {
    "Geología Macrostrat (global)": macrostratGeology,
  };
}

/**
 * Catastro Minero SERNAGEOMIN — public ArcGIS FeatureServer used by the
 * official viewer at https://appsngmaz.sernageomin.cl/catastro_SNGM.
 *
 * IMPORTANT: The official viewer renders ALL property types (explotación 1983,
 * explotación 1932, exploración 1983, estacamento) from layer 2
 * (`WGS84_Concesion`), discriminated by the `ORIGEN` field. Layer 1
 * (`WGS84_Pertenencia`) only holds 12 nationwide records and is NOT used by
 * the official viewer for rendering — it is essentially deprecated/empty.
 *
 * Filter `ID_SITUACION_CONCESION in (1,3)` = constituidas (active titles).
 * Filter `ID_SITUACION_CONCESION = 9`      = en proceso (in tramite).
 *
 * Mismo layer que usa el motor del dashboard (src/lib/cadastre/miningCadastreEngine.ts
 * vía src/lib/sngm.ts) — la URL base se importa de ahí (SNGM_CONCESIONES_URL)
 * en vez de hardcodearla de nuevo acá, que es justo lo que sngm.ts pide no
 * hacer en su comentario de cabecera.
 */
// Field reference (layer 2 = WGS84_Concesion):
//   ORIGEN, NUMERO_ROL, DV_ROL, NOMBRE, HECTAREAS, FECHA_VENCIMIENTO,
//   SITUACION_CONCESION, ID_SITUACION_CONCESION, TIPO_CONCESION, COMUNA,
//   TITULAR_DIVISION

export type CatastroOrigen = "EXPLOTA_1983" | "EXPLOTA_1932" | "EXPLORA_1983" | "ESTACAMENTO";

/** Single query that fetches all 4 property types in a bbox (constituidas). */
export function catastroQueryUrl(bbox: {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
}): string {
  const geometry = `${bbox.minLng},${bbox.minLat},${bbox.maxLng},${bbox.maxLat}`;
  const params = new URLSearchParams({
    where: "ID_SITUACION_CONCESION in (1,3)",
    geometry,
    geometryType: "esriGeometryEnvelope",
    inSR: "4326",
    outSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    outFields:
      "ORIGEN,NUMERO_ROL,DV_ROL,NOMBRE,HECTAREAS,FECHA_VENCIMIENTO,SITUACION_CONCESION,TITULAR_DIVISION,COMUNA",
    returnGeometry: "true",
    f: "geojson",
  });
  return `${SNGM_CONCESIONES_URL}/query?${params.toString()}`;
}

/** Colors mirror the official SERNAGEOMIN viewer. */
export const CATASTRO_STYLE: Record<
  CatastroOrigen,
  {
    color: string;
    weight: number;
    opacity: number;
    fillColor: string;
    fillOpacity: number;
    dashArray?: string;
    label: string;
  }
> = {
  EXPLOTA_1983: {
    color: "#0F69B4",
    fillColor: "#0F69B4",
    weight: 1.2,
    opacity: 0.95,
    fillOpacity: 0.35,
    label: "Explotación 1983",
  },
  EXPLOTA_1932: {
    color: "#EB465F",
    fillColor: "#EB465F",
    weight: 1.2,
    opacity: 0.95,
    fillOpacity: 0.32,
    label: "Explotación 1932",
  },
  EXPLORA_1983: {
    color: "#15D844",
    fillColor: "#15D844",
    weight: 1.2,
    opacity: 0.95,
    fillOpacity: 0.3,
    label: "Exploración 1983",
  },
  ESTACAMENTO: {
    color: "#ABFADB",
    fillColor: "#ABFADB",
    weight: 1.2,
    opacity: 0.95,
    fillOpacity: 0.3,
    label: "Estacamento salitrero",
  },
};

export function catastroPopupHtml(p: Record<string, unknown>): string {
  const origen = (p.ORIGEN as CatastroOrigen) ?? "EXPLOTA_1983";
  const style = CATASTRO_STYLE[origen] ?? CATASTRO_STYLE.EXPLOTA_1983;
  const rol = p.NUMERO_ROL ? `${p.NUMERO_ROL}${p.DV_ROL ? `-${p.DV_ROL}` : ""}` : "—";
  const area = p.HECTAREAS != null ? `${Number(p.HECTAREAS).toFixed(1)} ha` : "—";
  const venc = p.FECHA_VENCIMIENTO
    ? new Date(Number(p.FECHA_VENCIMIENTO)).toLocaleDateString("es-CL")
    : "—";
  const titular = (p.TITULAR_DIVISION as string | undefined) ?? "—";
  const comuna = (p.COMUNA as string | undefined) ?? "—";
  const situacion = (p.SITUACION_CONCESION as string | undefined) ?? "—";
  return `<div style="font-family:'IBM Plex Mono',monospace;font-size:11px;line-height:1.5;max-width:260px;">
    <strong style="color:${style.color};">${p.NOMBRE ?? "Sin nombre"}</strong><br/>
    <span style="color:#A89080;">${style.label}</span><br/>
    ROL: <strong>${rol}</strong><br/>
    Situación: ${situacion}<br/>
    Titular: ${titular}<br/>
    Comuna: ${comuna} · ${area}<br/>
    Vence: ${venc}
    <div style="margin-top:6px;padding-top:6px;border-top:1px solid #3a322c;color:#A89080;font-size:10px;">📎 SERNAGEOMIN · Catastro Minero (ArcGIS REST · capa WGS84_Concesion)</div>
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
  lng: number,
): string {
  if (!unit) {
    return `<div style="font-family:'IBM Plex Mono',monospace;font-size:11px;color:#A89080;">
      Sin unidad geológica reportada<br/>${lat.toFixed(5)}, ${lng.toFixed(5)}
    </div>`;
  }
  const name = (unit.name as string) ?? (unit.strat_name as string) ?? "Unidad geológica";
  const age =
    (unit.age as string) ?? (unit.b_age && unit.t_age ? `${unit.b_age}–${unit.t_age} Ma` : "—");
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
