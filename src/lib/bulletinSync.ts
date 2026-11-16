// Sincronización del Boletín Oficial de Minería a partir de SERNAGEOMIN v2.
//
// Diseño watch-driven: en vez de ingerir las ~600k concesiones del país, el
// sync solo consulta la actividad de los titulares que los usuarios vigilan
// (bulletin_watch_holders). Por cada titular trae:
//  - EN TRAMITE  → nueva manifestación/mensura (publicación de boletín)
//  - ELIMINADA   → caducidad/remate (terreno liberado, oportunidad)
// Las filas nuevas se insertan en mining_bulletins (dedupe por content_hash) y
// generan bulletin_alerts para el proyecto que vigila.
import { SNGM_CONCESIONES_URL, sngmQueryGeoJSON, sngmSanitizeTerm } from "@/lib/sngm";
import { hash32 } from "@/lib/text";

export type BulletinRow = {
  concession_code: string | null;
  concession_name: string | null;
  holder_name: string | null;
  holder_rut: string | null;
  publication_type: string;
  region: string | null;
  provincia: string | null;
  comuna: string | null;
  area_ha: number | null;
  centroid_lat: number | null;
  centroid_lng: number | null;
  content_hash: string;
  source: string;
  source_url: string | null;
  raw_payload: Record<string, unknown>;
};

const TYPE_BY_SITUACION: Record<string, string> = {
  "EN TRAMITE": "manifestacion",
  ELIMINADA: "caducidad",
};

/**
 * Consulta a SERNAGEOMIN v2 las concesiones de un titular con situación de
 * interés (en trámite o eliminada) y las mapea a filas de boletín.
 */
export async function fetchHolderBulletins(
  holderRut: string | null,
  holderName: string | null,
  limit = 50,
): Promise<BulletinRow[]> {
  // El nombre es el match más fiable; el RUT en SERNAGEOMIN viene padded con
  // ceros a la izquierda (ej. "006134871"), así que se matchea con LIKE sobre
  // los dígitos del cuerpo (sin DV) para absorber el padding.
  const nameSafe = holderName ? sngmSanitizeTerm(holderName) : null;
  const rutDigits = holderRut ? holderRut.replace(/[.\-\s]/g, "").replace(/[kK]$/, "") : "";
  // Cuerpo sin DV: si termina en dígito, ese último puede ser el DV.
  const rutBody = rutDigits.length >= 8 ? rutDigits.slice(0, -1) : rutDigits;
  const rutSafe = rutBody && /^\d+$/.test(rutBody) ? rutBody : null;
  if (!nameSafe && !rutSafe) return [];

  const idClause = nameSafe
    ? `UPPER(TITULAR_NOMBRE) LIKE UPPER('%${nameSafe}%')`
    : `TITULAR_RUT LIKE '%${rutSafe}'`;
  const where = `(${idClause}) AND SITUACION_CONCESION IN ('EN TRAMITE','ELIMINADA')`;

  const fc = await sngmQueryGeoJSON(SNGM_CONCESIONES_URL, {
    where,
    limit,
    returnGeometry: false,
    outFields:
      "NUMERO_ROL,DV_ROL,NOMBRE,TITULAR_NOMBRE,TITULAR_RUT,TITULAR_DV,COMUNA,HECTAREAS,SITUACION_CONCESION,TIPO_CONCESION,FECHA_VENCIMIENTO",
  });

  return (fc?.features ?? []).map((f) => {
    const p = (f.properties ?? {}) as Record<string, unknown>;
    const rol =
      p.NUMERO_ROL != null
        ? `${p.NUMERO_ROL}${p.DV_ROL != null ? `-${p.DV_ROL}` : ""}`
        : String(p.NOMBRE ?? "");
    const situacion = String(p.SITUACION_CONCESION ?? "").toUpperCase();
    const rut =
      p.TITULAR_RUT != null
        ? `${p.TITULAR_RUT}${p.TITULAR_DV != null ? `-${p.TITULAR_DV}` : ""}`
        : null;
    return {
      concession_code: rol || null,
      concession_name: (p.NOMBRE as string) ?? null,
      holder_name: (p.TITULAR_NOMBRE as string) ?? null,
      holder_rut: rut,
      publication_type: TYPE_BY_SITUACION[situacion] ?? "otro",
      region: (p.REGION as string) ?? null,
      provincia: (p.PROVINCIA as string) ?? null,
      comuna: (p.COMUNA as string) ?? null,
      area_ha: p.HECTAREAS != null ? Number(p.HECTAREAS) : null,
      centroid_lat: null,
      centroid_lng: null,
      // El hash incluye situación: si una concesión pasa de trámite a eliminada,
      // se registra como un evento de boletín distinto.
      content_hash: hash32(`${rol}|${situacion}`),
      source: "sernageomin-v2",
      source_url: rol ? `https://appsngmaz.sernageomin.cl/catastro_SNGM/home/index` : null,
      raw_payload: p,
    };
  });
}

// ---------------------------------------------------------------------------
// Ingesta nacional: todas las concesiones EN TRÁMITE del catastro SERNAGEOMIN
// (~19k). Es el reflejo oficial de pedimentos/manifestaciones ya ingresados;
// NO reemplaza al Boletín provincial ni a la fecha de ingreso OJV (prelación).
// Paginado por OBJECTID; el centroide lo calcula ArcGIS (returnCentroid).
// ---------------------------------------------------------------------------
export const NATIONAL_PAGE_SIZE = 2000;

export async function fetchNationalTramitePage(
  offset: number,
): Promise<{ rows: BulletinRow[]; more: boolean }> {
  const params = new URLSearchParams({
    where: "SITUACION_CONCESION='EN TRAMITE'",
    outFields:
      "OBJECTID,NUMERO_ROL,DV_ROL,NOMBRE,TITULAR_NOMBRE,TITULAR_RUT,TITULAR_DV,COMUNA,HECTAREAS,SITUACION_CONCESION,TIPO_CONCESION",
    returnGeometry: "false",
    returnCentroid: "true",
    orderByFields: "OBJECTID",
    resultOffset: String(offset),
    resultRecordCount: String(NATIONAL_PAGE_SIZE),
    f: "json",
  });
  const res = await fetch(`${SNGM_CONCESIONES_URL}/query?${params}`);
  if (!res.ok) throw new Error(`SERNAGEOMIN HTTP ${res.status}`);
  const j = (await res.json()) as {
    features?: { attributes: Record<string, unknown>; centroid?: { x: number; y: number } }[];
    exceededTransferLimit?: boolean;
    error?: { message?: string };
  };
  if (j.error) throw new Error(`SERNAGEOMIN: ${j.error.message ?? "error"}`);
  const feats = j.features ?? [];
  const rows = feats.map(({ attributes: p, centroid }) => {
    const rol =
      p.NUMERO_ROL != null
        ? `${p.NUMERO_ROL}${p.DV_ROL != null ? `-${p.DV_ROL}` : ""}`
        : String(p.NOMBRE ?? p.OBJECTID);
    const tipo = String(p.TIPO_CONCESION ?? "").toUpperCase();
    const rut =
      p.TITULAR_RUT != null
        ? `${p.TITULAR_RUT}${p.TITULAR_DV != null ? `-${p.TITULAR_DV}` : ""}`
        : null;
    return {
      concession_code: rol || null,
      concession_name: (p.NOMBRE as string) ?? null,
      holder_name: (p.TITULAR_NOMBRE as string) ?? null,
      holder_rut: rut,
      // Exploración en trámite = pedimento; explotación en trámite = manifestación.
      publication_type: tipo === "EXPLORACION" ? "pedimento" : "manifestacion",
      region: (p.REGION as string) ?? null,
      provincia: (p.PROVINCIA as string) ?? null,
      comuna: (p.COMUNA as string) ?? null,
      area_ha: p.HECTAREAS != null ? Number(p.HECTAREAS) : null,
      centroid_lat: centroid?.y ?? null,
      centroid_lng: centroid?.x ?? null,
      // Mismo esquema de hash que fetchHolderBulletins → sin duplicados.
      content_hash: hash32(`${rol}|EN TRAMITE`),
      source: "sernageomin-v2",
      source_url: "https://appsngmaz.sernageomin.cl/catastro_SNGM/home/index",
      raw_payload: { ...p, provenance: "catastro SERNAGEOMIN (EN TRAMITE) · no es publicación de Boletín" },
    } satisfies BulletinRow;
  });
  const uniq = [...new Map(rows.map((r) => [r.content_hash, r])).values()];
  return { rows: uniq, more: !!j.exceededTransferLimit || feats.length === NATIONAL_PAGE_SIZE };
}
