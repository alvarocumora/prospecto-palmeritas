// Cliente SERNAGEOMIN v2 — ArcGIS Online (Marcelo_Layer)
// Reemplaza al endpoint legacy catastro.sernageomin.cl/arcgis/.../MapServer
// que quedó degradado tras la migración al portal appsngmaz (catastro_SNGM).
//
// FeatureServer descubierto via /catastro_SNGM/js/map.js:
//   /FeatureServer/0  → WGS84_Vertice  (2.5M puntos / hitos)
//   /FeatureServer/2  → WGS84_Concesion (104k polígonos)
//
// Endpoint público (sin API key). Rate limit ~10 req/s. Esri Online
// devuelve máx ~2000 features por página → paginar con resultOffset.

export const SNGM_BASE =
  "https://services1.arcgis.com/OyjvVdFTl5hfSdX3/arcgis/rest/services/Marcelo_Layer/FeatureServer";
export const LAYER_CONCESION = 2;
export const LAYER_VERTICE = 0;
export const PAGE_SIZE = 2000;
export const REQUEST_TIMEOUT_MS = 20_000;

export type ArcFeature = {
  attributes: Record<string, unknown>;
  geometry?: { rings?: number[][][] };
};

// Esquema canónico interno, normalizado desde los campos del FeatureServer v2.
export type CanonicalConcession = {
  id_concesion: number | null;       // ID estable nacional (nuevo en v2)
  rol: string | null;                // NUMERO_ROL[-DV_ROL]
  numero_rol: number | null;
  dv_rol: string | null;
  name: string | null;
  hectareas: number | null;
  status: string;                    // vigente|en_tramite|vencida|cancelada
  status_raw: string | null;
  tipo: string;                      // explotacion|exploracion
  tipo_raw: string | null;
  comuna: string | null;
  holder_name: string | null;
  holder_rut: string | null;         // RUT-DV formateado
  holder_division: string | null;
  nro_inscripcion: number | null;
  fojas: number | null;
  ano_inscripcion: number | null;
  origen: string | null;
  datum: string | null;
  huso: number | null;
  fecha_vencimiento: string | null;  // YYYY-MM-DD
  fecha_actualizacion: string | null; // ISO timestamp (delta sync)
  fecha_creacion: string | null;
  geometry: GeoJSON.Geometry | null;
};

function pickStr(a: Record<string, unknown>, ...keys: string[]): string | null {
  for (const k of keys) {
    const v = a[k];
    if (v != null && String(v).trim() !== "") return String(v).trim();
  }
  return null;
}
function pickNum(a: Record<string, unknown>, ...keys: string[]): number | null {
  for (const k of keys) {
    const v = a[k];
    if (v == null || v === "") continue;
    const n = Number(v);
    if (!Number.isNaN(n)) return n;
  }
  return null;
}
function pickEpoch(a: Record<string, unknown>, ...keys: string[]): string | null {
  for (const k of keys) {
    const v = a[k];
    if (v == null || v === "") continue;
    // ArcGIS devuelve fechas como epoch ms
    const n = typeof v === "number" ? v : Number(v);
    if (!Number.isNaN(n) && n > 0) {
      const d = new Date(n);
      if (!isNaN(d.getTime())) return d.toISOString();
    }
    const d = new Date(String(v));
    if (!isNaN(d.getTime())) return d.toISOString();
  }
  return null;
}

function ringsToGeoJson(rings?: number[][][]): GeoJSON.Geometry | null {
  if (!rings?.length) return null;
  if (rings.length === 1) return { type: "Polygon", coordinates: rings };
  return { type: "MultiPolygon", coordinates: rings.map((r) => [r]) };
}

function mapStatus(raw: string | null): string {
  const s = (raw ?? "").toLowerCase();
  if (s.includes("vig")) return "vigente";
  if (s.includes("tram") || s.includes("constit")) return "en_tramite";
  if (s.includes("venc") || s.includes("cadu")) return "vencida";
  if (s.includes("cancel") || s.includes("renun")) return "cancelada";
  return "vigente";
}
function mapTipo(raw: string | null): string {
  const s = (raw ?? "").toLowerCase();
  if (s.includes("explor")) return "exploracion";
  if (s.includes("explot")) return "explotacion";
  return "explotacion";
}

export function normalizeConcession(f: ArcFeature): CanonicalConcession {
  const a = f.attributes;
  const numero = pickNum(a, "NUMERO_ROL");
  const dv = pickStr(a, "DV_ROL");
  const rol = numero != null ? (dv ? `${numero}-${dv}` : String(numero)) : null;
  const rut = pickStr(a, "TITULAR_RUT");
  const rutDv = pickStr(a, "TITULAR_DV");
  const holderRut = rut ? (rutDv ? `${rut}-${rutDv}` : rut) : null;
  const tipoRaw = pickStr(a, "TIPO_CONCESION");
  const statusRaw = pickStr(a, "SITUACION_CONCESION");
  return {
    id_concesion: pickNum(a, "ID_CONCESION"),
    rol,
    numero_rol: numero,
    dv_rol: dv,
    name: pickStr(a, "NOMBRE"),
    hectareas: pickNum(a, "HECTAREAS"),
    status: mapStatus(statusRaw),
    status_raw: statusRaw,
    tipo: mapTipo(tipoRaw),
    tipo_raw: tipoRaw,
    comuna: pickStr(a, "COMUNA"),
    holder_name: pickStr(a, "TITULAR_NOMBRE"),
    holder_rut: holderRut,
    holder_division: pickStr(a, "TITULAR_DIVISION"),
    nro_inscripcion: pickNum(a, "NRO_INSCRIPCION"),
    fojas: pickNum(a, "FOJAS"),
    ano_inscripcion: pickNum(a, "ANO_INSCRIPCION"),
    origen: pickStr(a, "ORIGEN"),
    datum: pickStr(a, "DATUM"),
    huso: pickNum(a, "HUSO"),
    fecha_vencimiento: pickEpoch(a, "FECHA_VENCIMIENTO")?.slice(0, 10) ?? null,
    fecha_actualizacion: pickEpoch(a, "FECHA_ACTUALIZACION"),
    fecha_creacion: pickEpoch(a, "FECHA_CREACION"),
    geometry: ringsToGeoJson(f.geometry?.rings),
  };
}

async function fetchWithTimeout(url: string): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

async function queryPage(
  layer: number,
  params: URLSearchParams,
  attempt = 0,
): Promise<{ features: ArcFeature[]; exceededTransferLimit: boolean }> {
  const url = `${SNGM_BASE}/${layer}/query?${params.toString()}`;
  try {
    const res = await fetchWithTimeout(url);
    if (!res.ok) {
      if (attempt < 2) {
        await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
        return queryPage(layer, params, attempt + 1);
      }
      throw new Error(`SNGM layer ${layer} HTTP ${res.status}`);
    }
    const json = (await res.json()) as {
      features?: ArcFeature[];
      exceededTransferLimit?: boolean;
      error?: { message?: string };
    };
    if (json.error) throw new Error(`SNGM error: ${json.error.message ?? "unknown"}`);
    return {
      features: json.features ?? [],
      exceededTransferLimit: !!json.exceededTransferLimit,
    };
  } catch (e) {
    if (attempt < 2) {
      await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
      return queryPage(layer, params, attempt + 1);
    }
    throw e;
  }
}

export type ConcessionQuery = {
  where?: string;
  bbox?: { xmin: number; ymin: number; xmax: number; ymax: number };
  returnGeometry?: boolean;
  maxFeatures?: number;
};

export async function queryConcessions(
  q: ConcessionQuery,
): Promise<CanonicalConcession[]> {
  const out: CanonicalConcession[] = [];
  let offset = 0;
  const max = q.maxFeatures ?? 20_000;
  while (true) {
    const params = new URLSearchParams({
      where: q.where ?? "1=1",
      outFields: "*",
      outSR: "4326",
      returnGeometry: String(q.returnGeometry ?? true),
      f: "json",
      resultOffset: String(offset),
      resultRecordCount: String(PAGE_SIZE),
    });
    if (q.bbox) {
      params.set("geometry", JSON.stringify({ ...q.bbox, spatialReference: { wkid: 4326 } }));
      params.set("geometryType", "esriGeometryEnvelope");
      params.set("inSR", "4326");
      params.set("spatialRel", "esriSpatialRelIntersects");
    }
    const { features, exceededTransferLimit } = await queryPage(LAYER_CONCESION, params);
    for (const f of features) out.push(normalizeConcession(f));
    if (!exceededTransferLimit || features.length === 0) break;
    offset += features.length;
    if (out.length >= max) break;
  }
  return out;
}

// Busca una concesión por ROL o nombre. Devuelve la primera coincidencia.
export async function findConcessionByCode(
  code: string,
): Promise<CanonicalConcession | null> {
  const safe = code.replace(/'/g, "''");
  // Probar como NUMERO_ROL puro (extraer dígitos)
  const digits = code.replace(/\D+/g, "");
  const wheres: string[] = [];
  if (digits) wheres.push(`NUMERO_ROL = ${digits}`);
  wheres.push(`NOMBRE = '${safe}'`);
  wheres.push(`UPPER(NOMBRE) LIKE UPPER('%${safe}%')`);
  for (const where of wheres) {
    const params = new URLSearchParams({
      where,
      outFields: "*",
      outSR: "4326",
      returnGeometry: "true",
      f: "json",
      resultRecordCount: "1",
    });
    const { features } = await queryPage(LAYER_CONCESION, params);
    if (features[0]) return normalizeConcession(features[0]);
  }
  return null;
}

// Health check rápido para el panel de estado de fuentes externas.
export async function healthCheck(): Promise<{
  ok: boolean;
  total: number | null;
  latencyMs: number;
  error?: string;
}> {
  const t0 = Date.now();
  try {
    const params = new URLSearchParams({ where: "1=1", returnCountOnly: "true", f: "json" });
    const res = await fetchWithTimeout(`${SNGM_BASE}/${LAYER_CONCESION}/query?${params.toString()}`);
    const json = (await res.json()) as { count?: number };
    return { ok: res.ok, total: json.count ?? null, latencyMs: Date.now() - t0 };
  } catch (e) {
    return {
      ok: false,
      total: null,
      latencyMs: Date.now() - t0,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}
