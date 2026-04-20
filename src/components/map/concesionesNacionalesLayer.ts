import type { LeafletNS } from "./types";

/**
 * Capa nacional de concesiones mineras de Chile vía WMS de SERNAGEOMIN.
 *
 * Estilo inspirado en propiedadminera.cl:
 *   - Verde: explotación vigente
 *   - Azul: exploración vigente
 *   - Amarillo: en trámite
 *   - Rojo/Magenta: vencida o en remate
 *
 * El render visual lo hace el servicio WMS de SERNAGEOMIN; el clic disparará
 * un GetFeatureInfo que devuelve titular, RUT, comuna, región, área, datum.
 */

const WMS_CONCESIONES_URL =
  "https://catastro.sernageomin.cl/arcgis/services/Concesiones_Mineras/Concesiones_Mineras/MapServer/WMSServer";

/** Concesiones mineras de Chile (todas las activas) */
export function concesionesNacionales(L: LeafletNS) {
  return L.tileLayer.wms(WMS_CONCESIONES_URL, {
    layers: "0,1,2,3", // explotación, exploración, mensuras, manifestaciones
    format: "image/png",
    transparent: true,
    version: "1.3.0",
    opacity: 0.55,
    attribution:
      'Concesiones &copy; <a href="https://catastro.sernageomin.cl">SERNAGEOMIN</a> · Catastro Minero',
  });
}

/**
 * GetFeatureInfo helper específico para concesiones nacionales.
 * Devuelve atributos del estilo: titular, RUT, comuna, provincia, región, área, datum, vigencia.
 */
export async function fetchConcesionAtPoint(opts: {
  bbox: string;
  width: number;
  height: number;
  x: number;
  y: number;
}): Promise<Record<string, unknown> | null> {
  const params = new URLSearchParams({
    service: "WMS",
    version: "1.3.0",
    request: "GetFeatureInfo",
    layers: "0,1,2,3",
    query_layers: "0,1,2,3",
    info_format: "application/json",
    feature_count: "5",
    bbox: opts.bbox,
    width: String(opts.width),
    height: String(opts.height),
    i: String(Math.round(opts.x)),
    j: String(Math.round(opts.y)),
    crs: "EPSG:4326",
  });
  try {
    const res = await fetch(`${WMS_CONCESIONES_URL}?${params.toString()}`);
    if (!res.ok) return null;
    const json = (await res.json()) as {
      features?: Array<{ properties?: Record<string, unknown> }>;
    };
    return json.features?.[0]?.properties ?? null;
  } catch {
    return null;
  }
}
