import type { LeafletNS } from "./types";

/**
 * Capas oficiales de SERNAGEOMIN (Servicio Nacional de Geología y Minería de Chile).
 * Todas son endpoints WMS / Tile públicos del IDE Minero, sin API key.
 *
 * Validados a fecha 2026-04 — si alguno cae, ver:
 *   https://catastro.sernageomin.cl/  ·  https://www.ide.cl/
 */

/** Carta Geológica de Chile 1:1.000.000 — litología real para todo Chile. */
function geologiaBase1M(L: LeafletNS) {
  return L.tileLayer.wms(
    "https://catastro.sernageomin.cl/arcgis/services/Geologia/Geologia_Base_1M/MapServer/WMSServer",
    {
      layers: "0",
      format: "image/png",
      transparent: true,
      version: "1.3.0",
      opacity: 0.7,
      attribution:
        'Geología 1:1M &copy; <a href="https://www.sernageomin.cl">SERNAGEOMIN</a> · Carta Geológica de Chile',
    },
  );
}

/** Yacimientos y faenas mineras conocidas de Chile (puntos con metal/estado). */
function yacimientos(L: LeafletNS) {
  return L.tileLayer.wms(
    "https://catastro.sernageomin.cl/arcgis/services/Mineria/Yacimientos/MapServer/WMSServer",
    {
      layers: "0",
      format: "image/png",
      transparent: true,
      version: "1.3.0",
      opacity: 0.95,
      attribution: 'Yacimientos &copy; <a href="https://www.sernageomin.cl">SERNAGEOMIN</a>',
    },
  );
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
