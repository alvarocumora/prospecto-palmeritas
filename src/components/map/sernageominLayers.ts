import type { LeafletNS } from "./types";
import { SNGM_GEOLOGIA_10K_URL, SNGM_YACIMIENTOS_URL, sngmQueryGeoJSON } from "@/lib/sngm";

/**
 * Capas oficiales de SERNAGEOMIN (Servicio Nacional de Geología y Minería de Chile).
 *
 * El host WMS legacy catastro.sernageomin.cl está CAÍDO (2026-Q1). Geología y
 * yacimientos se consumen ahora como GeoJSON vivo desde ArcGIS Online (ver
 * src/lib/sngm.ts): la capa se crea vacía de forma síncrona y se llena en
 * cuanto llega la respuesta (642 polígonos / 130 puntos — livianas).
 *
 * Nota de cobertura: Geología_10k es la capa 1:10.000 publicada por SNGM en
 * AGOL (no la Carta 1:1M nacional, que cayó junto al host legacy).
 */

/** Paleta determinística por clase geológica. */
const GEOL_PALETTE = [
  "#8b5cf6",
  "#06b6d4",
  "#84cc16",
  "#f43f5e",
  "#eab308",
  "#3b82f6",
  "#f97316",
  "#14b8a6",
];
function geolColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return GEOL_PALETTE[Math.abs(h) % GEOL_PALETTE.length];
}

/** Geología 1:10.000 SNGM (polígonos por unidad, coloreados por clase). */
function geologiaBase1M(L: LeafletNS) {
  const layer = L.geoJSON(undefined, {
    style: (feature) => {
      const clase = String(feature?.properties?.Clase_Geol ?? feature?.properties?.UNIDAD ?? "");
      const color = geolColor(clase);
      return { color, weight: 0.8, opacity: 0.85, fillColor: color, fillOpacity: 0.25 };
    },
    onEachFeature: (feature, lyr) => {
      const p = (feature.properties ?? {}) as Record<string, unknown>;
      lyr.bindPopup(
        `<div style="font-family:ui-monospace,monospace;font-size:11px;line-height:1.5">
          <strong>${p.UNIDAD ?? "Unidad geológica"}</strong><br/>
          Clase: ${p.Clase_Geol ?? "—"}<br/>
          <span style="opacity:.6">SERNAGEOMIN · Geología 1:10k</span>
        </div>`,
      );
    },
    attribution:
      'Geología 1:10k &copy; <a href="https://www.sernageomin.cl">SERNAGEOMIN</a> (ArcGIS Online)',
  });
  void sngmQueryGeoJSON(SNGM_GEOLOGIA_10K_URL, { limit: 2000 }).then((fc) => {
    if (fc) layer.addData(fc as never);
  });
  return layer;
}

/** Faenas e instalaciones mineras SNGM (puntos: empresa, faena, recurso). */
function yacimientos(L: LeafletNS) {
  const layer = L.geoJSON(undefined, {
    pointToLayer: (_feature, latlng) =>
      L.circleMarker(latlng, {
        radius: 5,
        color: "#0b2a5b",
        weight: 1.2,
        fillColor: "#fcd34d",
        fillOpacity: 0.9,
      }),
    onEachFeature: (feature, lyr) => {
      const p = (feature.properties ?? {}) as Record<string, unknown>;
      lyr.bindPopup(
        `<div style="font-family:ui-monospace,monospace;font-size:11px;line-height:1.5">
          <strong>${p.NOMBRE_FAE ?? p.NOMBRE_INS ?? "Faena minera"}</strong><br/>
          Empresa: ${p.NOMBRE_EMP ?? "—"}<br/>
          Recurso: ${p.RECURSO_MI ?? p.RECURSO_PR ?? "—"}<br/>
          Tipo: ${p.TIPO_INSTA ?? "—"} · ${p.COMUNA_INS ?? "—"}<br/>
          <span style="opacity:.6">SERNAGEOMIN · Faenas mineras</span>
        </div>`,
      );
    },
    attribution: 'Faenas &copy; <a href="https://www.sernageomin.cl">SERNAGEOMIN</a>',
  });
  void sngmQueryGeoJSON(SNGM_YACIMIENTOS_URL, { limit: 500 }).then((fc) => {
    if (fc) layer.addData(fc as never);
  });
  return layer;
}

/** Áreas protegidas SNASPE / CONAF — relevante para módulo HSE & permisos. */
function areasProtegidas(L: LeafletNS) {
  return L.tileLayer.wms("https://ide.mma.gob.cl/geoserver/wms", {
    layers: "areas_protegidas:snaspe",
    format: "image/png",
    transparent: true,
    version: "1.1.1",
    opacity: 0.5,
    attribution: 'Áreas Protegidas &copy; <a href="https://ide.mma.gob.cl">MMA / CONAF</a>',
  });
}

export function buildSernageominLayers(L: LeafletNS) {
  return {
    geologia1M: geologiaBase1M(L),
    yacimientos: yacimientos(L),
    areasProtegidas: areasProtegidas(L),
  };
}

/**
 * GetFeatureInfo helper: consulta una capa WMS para extraer atributos en el punto clickeado.
 * Devuelve un string HTML legible o null si no hay respuesta.
 */
export async function wmsGetFeatureInfo(opts: {
  baseUrl: string;
  layer: string;
  bbox: string;
  width: number;
  height: number;
  x: number;
  y: number;
  version?: "1.1.1" | "1.3.0";
  srs?: string;
}): Promise<Record<string, unknown> | null> {
  const version = opts.version ?? "1.3.0";
  const params = new URLSearchParams({
    service: "WMS",
    version,
    request: "GetFeatureInfo",
    layers: opts.layer,
    query_layers: opts.layer,
    info_format: "application/json",
    feature_count: "5",
    bbox: opts.bbox,
    width: String(opts.width),
    height: String(opts.height),
    [version === "1.3.0" ? "i" : "x"]: String(Math.round(opts.x)),
    [version === "1.3.0" ? "j" : "y"]: String(Math.round(opts.y)),
    [version === "1.3.0" ? "crs" : "srs"]: opts.srs ?? "EPSG:4326",
  });
  try {
    const res = await fetch(`${opts.baseUrl}?${params.toString()}`);
    if (!res.ok) return null;
    const json = (await res.json()) as {
      features?: Array<{ properties?: Record<string, unknown> }>;
    };
    return json.features?.[0]?.properties ?? null;
  } catch {
    return null;
  }
}
