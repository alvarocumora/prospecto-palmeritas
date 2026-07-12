// Conector Chile — SERNAGEOMIN v2 (ArcGIS Online, Marcelo_Layer/2).
// Reutiliza los endpoints canónicos de sngm.ts y mapea al esquema universal.

import { SNGM_CONCESIONES_URL } from "@/lib/sngm";
import { arcgisQueryAttributes, sanitizeArcgisTerm } from "@/lib/cadastre/arcgis";
import { normalizeAlnum } from "@/lib/text";
import type {
  CadastreConnector,
  CanonicalConcession,
  NormalizedStatus,
} from "@/lib/cadastre/types";

const VIEWER_URL = "https://appsngmaz.sernageomin.cl/catastro_SNGM/home/index";

export function normalizeChileStatus(situacion: string | null): NormalizedStatus {
  const s = normalizeAlnum(situacion);
  if (s.includes("CONSTITU")) return "active";
  if (s.includes("TRAMITE")) return "pending";
  if (s.includes("ELIMIN") || s.includes("CADUC")) return "extinct";
  return "unknown";
}

/** Mapea los atributos crudos de Marcelo_Layer/2 al esquema canónico. Puro. */
export function mapChileAttributes(a: Record<string, unknown>): CanonicalConcession {
  const rol = a.NUMERO_ROL != null ? String(a.NUMERO_ROL) : null;
  const dv = a.DV_ROL != null ? String(a.DV_ROL) : null;
  const rut = a.TITULAR_RUT != null ? String(a.TITULAR_RUT) : null;
  const rutDv = a.TITULAR_DV != null ? String(a.TITULAR_DV) : null;
  const status = a.SITUACION_CONCESION != null ? String(a.SITUACION_CONCESION) : null;
  return {
    country: "CL",
    code: rol ? `${rol}${dv ? `-${dv}` : ""}` : String(a.NOMBRE ?? ""),
    name: a.NOMBRE != null ? String(a.NOMBRE) : null,
    holder: a.TITULAR_NOMBRE != null ? String(a.TITULAR_NOMBRE) : null,
    holderTaxId: rut ? `${rut}${rutDv ? `-${rutDv}` : ""}` : null,
    areaHa: a.HECTAREAS != null ? Number(a.HECTAREAS) : null,
    status,
    statusNormalized: normalizeChileStatus(status),
    type: a.TIPO_CONCESION != null ? String(a.TIPO_CONCESION) : null,
    location: a.COMUNA != null ? String(a.COMUNA) : null,
    source: "SERNAGEOMIN",
    sourceUrl: VIEWER_URL,
  };
}

export const chileConnector: CadastreConnector = {
  country: "CL",
  countryName: "Chile",
  institution: "SERNAGEOMIN",
  async search(term, limit) {
    const safe = sanitizeArcgisTerm(term);
    if (!safe) return [];
    const clauses = [
      `UPPER(NOMBRE) LIKE UPPER('%${safe}%')`,
      `UPPER(TITULAR_NOMBRE) LIKE UPPER('%${safe}%')`,
    ];
    if (/^\d+$/.test(safe)) clauses.push(`NUMERO_ROL = ${safe}`);
    const rows = await arcgisQueryAttributes(SNGM_CONCESIONES_URL, {
      where: clauses.join(" OR "),
      outFields:
        "NUMERO_ROL,DV_ROL,NOMBRE,TITULAR_NOMBRE,TITULAR_RUT,TITULAR_DV,HECTAREAS,SITUACION_CONCESION,TIPO_CONCESION,COMUNA",
      limit,
    });
    return rows.map(mapChileAttributes);
  },
};
