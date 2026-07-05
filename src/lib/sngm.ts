// Endpoints canónicos del catastro SERNAGEOMIN v2 (ArcGIS Online).
//
// El servidor legacy catastro.sernageomin.cl está CAÍDO (HTTP 000 desde
// 2026-Q1). SERNAGEOMIN migró su visor oficial
// (appsngmaz.sernageomin.cl/catastro_SNGM) a ArcGIS Online. Este módulo es la
// única fuente de verdad de esos endpoints — no hardcodear URLs en consumidores.
//
// Servicios verificados en la organización (203 FeatureServers):
//  - Marcelo_Layer/2        → concesiones vigentes (~103.000 polígonos, WGS84)
//  - Marcelo_Layer/0        → vértices de concesión (puntos)
//  - Marceloeliminadas      → concesiones eliminadas (histórico)
//  - ACCESO_YACIMIENTOS     → yacimientos
//  - Geología_10k           → geología escala 1:10.000
//  - ACCESO_RELAVES_ACTIVOS / _ABANDONADOS → relaves
//
// Campos de Marcelo_Layer/2: OBJECTID, NUMERO_ROL, DV_ROL, NOMBRE, HECTAREAS,
// FECHA_VENCIMIENTO, SITUACION_CONCESION (CONSTITUIDA|EN TRAMITE|ELIMINADA),
// TIPO_CONCESION (EXPLORACION|EXPLOTACION), COMUNA, TITULAR_NOMBRE,
// TITULAR_RUT, TITULAR_DV, DATUM, HUSO. maxRecordCount=2000 por página.

export const SNGM_SERVICES_ROOT =
  "https://services1.arcgis.com/OyjvVdFTl5hfSdX3/arcgis/rest/services";

export const SNGM_CONCESIONES_URL = `${SNGM_SERVICES_ROOT}/Marcelo_Layer/FeatureServer/2`;
export const SNGM_VERTICES_URL = `${SNGM_SERVICES_ROOT}/Marcelo_Layer/FeatureServer/0`;
export const SNGM_CONCESIONES_ELIMINADAS_URL = `${SNGM_SERVICES_ROOT}/Marceloeliminadas/FeatureServer/0`;
/** Faenas e instalaciones mineras (130 puntos: empresa, faena, recurso). */
export const SNGM_YACIMIENTOS_URL = `${SNGM_SERVICES_ROOT}/ACCESO_YACIMIENTOS/FeatureServer/1`;
/** Geología 1:10.000 (642 polígonos: UNIDAD, Clase_Geol). Nombre con í percent-encoded. */
export const SNGM_GEOLOGIA_10K_URL = `${SNGM_SERVICES_ROOT}/Geolog%C3%ADa_10k/FeatureServer/0`;

/**
 * Tipos legacy de la plataforma → filtro v2. En derecho minero chileno la
 * "mensura" es la explotación en trámite y la "manifestación" la exploración
 * en trámite, así que el modelo de 4 tipos se preserva como TIPO×SITUACIÓN.
 */
export type ConcesionTipo = "explotacion" | "exploracion" | "mensura" | "manifestacion";

export const SNGM_WHERE_BY_TIPO: Record<ConcesionTipo, string> = {
  explotacion: "TIPO_CONCESION='EXPLOTACION' AND SITUACION_CONCESION='CONSTITUIDA'",
  exploracion: "TIPO_CONCESION='EXPLORACION' AND SITUACION_CONCESION='CONSTITUIDA'",
  mensura: "TIPO_CONCESION='EXPLOTACION' AND SITUACION_CONCESION='EN TRAMITE'",
  manifestacion: "TIPO_CONCESION='EXPLORACION' AND SITUACION_CONCESION='EN TRAMITE'",
};

export type SngmQueryOptions = {
  where?: string;
  /** [minLng, minLat, maxLng, maxLat] en EPSG:4326 */
  bbox?: [number, number, number, number];
  outFields?: string;
  limit?: number;
  offset?: number;
  returnGeometry?: boolean;
};

/** Query GeoJSON contra un FeatureServer SNGM. Devuelve null en error. */
export async function sngmQueryGeoJSON(
  layerUrl: string,
  opts: SngmQueryOptions = {},
): Promise<GeoJSON.FeatureCollection | null> {
  const params = new URLSearchParams({
    where: opts.where ?? "1=1",
    outFields: opts.outFields ?? "*",
    outSR: "4326",
    f: "geojson",
    resultRecordCount: String(Math.min(opts.limit ?? 1000, 2000)),
  });
  if (opts.offset) params.set("resultOffset", String(opts.offset));
  if (opts.returnGeometry === false) params.set("returnGeometry", "false");
  if (opts.bbox) {
    const [minX, minY, maxX, maxY] = opts.bbox;
    params.set("geometry", `${minX},${minY},${maxX},${maxY}`);
    params.set("geometryType", "esriGeometryEnvelope");
    params.set("inSR", "4326");
    params.set("spatialRel", "esriSpatialRelIntersects");
  }
  try {
    const res = await fetch(`${layerUrl}/query?${params.toString()}`);
    if (!res.ok) return null;
    const fc = (await res.json()) as GeoJSON.FeatureCollection & { error?: unknown };
    if ("error" in fc && fc.error) return null;
    return fc;
  } catch {
    return null;
  }
}

/**
 * Identify por click: atributos del primer feature que intersecta el punto
 * (reemplaza al WMS GetFeatureInfo del host legacy caído).
 */
export async function sngmIdentify(
  layerUrl: string,
  lng: number,
  lat: number,
): Promise<Record<string, unknown> | null> {
  const params = new URLSearchParams({
    where: "1=1",
    outFields: "*",
    geometry: `${lng},${lat}`,
    geometryType: "esriGeometryPoint",
    inSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    returnGeometry: "false",
    resultRecordCount: "1",
    f: "geojson",
  });
  try {
    const res = await fetch(`${layerUrl}/query?${params.toString()}`);
    if (!res.ok) return null;
    const fc = (await res.json()) as GeoJSON.FeatureCollection & { error?: unknown };
    if ("error" in fc && fc.error) return null;
    return (fc.features?.[0]?.properties as Record<string, unknown>) ?? null;
  } catch {
    return null;
  }
}

/** Sanitiza un término para usar dentro de un WHERE de ArcGIS. */
export function sngmSanitizeTerm(rawTerm: string): string | null {
  const term = rawTerm.trim();
  if (!term) return null;
  if (!/^[A-Za-z0-9ÁÉÍÓÚÑáéíóúñ \-./]{1,64}$/.test(term)) return null;
  return term.replace(/'/g, "''");
}
