// Conector Perú — INGEMMET GEOCATMIN (ArcGIS Server), capa Catastro Minero.
//
// Fuente verificada en vivo: SERV_CATASTRO_MINERO_WGS84/MapServer/0
// (~65.000 derechos mineros). Campos: CODIGOU (código único), CONCESION
// (nombre), TIT_CONCES (titular), HECTAGIS (hectáreas), D_ESTADO (estado
// descriptivo, ej. "D.M. Titulado D.L. 708" / "D.M. en Trámite D.L. 708"),
// ZONA (huso UTM). OJO: este servidor NO soporta paginación
// (resultRecordCount → error 400), por eso supportsPagination: false y el
// recorte se hace client-side.

import { arcgisQueryAttributes, sanitizeArcgisTerm } from "@/lib/cadastre/arcgis";
import { normalizeAlnum } from "@/lib/text";
import type {
  CadastreConnector,
  CanonicalConcession,
  NormalizedStatus,
} from "@/lib/cadastre/types";

export const GEOCATMIN_CATASTRO_URL =
  "https://geocatmin.ingemmet.gob.pe/arcgis/rest/services/SERV_CATASTRO_MINERO_WGS84/MapServer/0";

const VIEWER_URL = "https://geocatmin.ingemmet.gob.pe/geocatmin/";

export function normalizePeruStatus(dEstado: string | null): NormalizedStatus {
  const s = normalizeAlnum(dEstado);
  if (s.includes("TITULADO")) return "active";
  if (s.includes("TRAMITE")) return "pending";
  if (s.includes("EXTIN") || s.includes("CADUC")) return "extinct";
  return "unknown";
}

/** Mapea los atributos crudos del Catastro Minero peruano al esquema canónico. Puro. */
export function mapPeruAttributes(a: Record<string, unknown>): CanonicalConcession {
  const status = a.D_ESTADO != null ? String(a.D_ESTADO) : null;
  return {
    country: "PE",
    code: a.CODIGOU != null ? String(a.CODIGOU) : String(a.CONCESION ?? ""),
    name: a.CONCESION != null ? String(a.CONCESION) : null,
    holder: a.TIT_CONCES != null ? String(a.TIT_CONCES) : null,
    // La capa pública no expone el RUC del titular.
    holderTaxId: null,
    areaHa: a.HECTAGIS != null ? Number(a.HECTAGIS) : null,
    status,
    statusNormalized: normalizePeruStatus(status),
    type: null,
    location: a.ZONA != null ? `Zona UTM ${a.ZONA}` : null,
    source: "INGEMMET GEOCATMIN",
    sourceUrl: VIEWER_URL,
  };
}

export const peruConnector: CadastreConnector = {
  country: "PE",
  countryName: "Perú",
  institution: "INGEMMET",
  async search(term, limit) {
    const safe = sanitizeArcgisTerm(term);
    if (!safe) return [];
    const clauses = [
      `UPPER(CONCESION) LIKE UPPER('%${safe}%')`,
      `UPPER(TIT_CONCES) LIKE UPPER('%${safe}%')`,
    ];
    // CODIGOU es texto numérico zero-padded (ej. "010462025").
    if (/^\d+$/.test(safe)) clauses.push(`CODIGOU LIKE '%${safe}%'`);
    const rows = await arcgisQueryAttributes(GEOCATMIN_CATASTRO_URL, {
      where: clauses.join(" OR "),
      outFields: "CODIGOU,CONCESION,TIT_CONCES,HECTAGIS,D_ESTADO,ZONA",
      limit,
      supportsPagination: false,
      timeoutMs: 30_000,
    });
    return rows.map(mapPeruAttributes);
  },
};
