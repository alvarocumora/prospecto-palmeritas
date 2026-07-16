// Conector Brasil — ANM SIGMINE (ArcGIS Server), processos minerários ativos.
//
// Fuente verificada en vivo: SIGMINE/dados_anm/MapServer/0 ("Processos
// minerários ativos"). Campos: PROCESSO (código, ej. "3457/1937"), NOME
// (titular), SUBS (sustancia), USO, AREA_HA, UF (estado), FASE (fase del
// proceso: REQUERIMENTO/AUTORIZAÇÃO DE PESQUISA, CONCESSÃO DE LAVRA,
// LICENCIAMENTO, LAVRA GARIMPEIRA, REGISTRO DE EXTRAÇÃO, DISPONIBILIDADE…).
// Igual que GEOCATMIN, el servidor NO soporta paginación → recorte client-side.
// Verificado: "VALE S.A." → 651 procesos en MG.

import { arcgisQueryAttributes, sanitizeArcgisTerm } from "@/lib/cadastre/arcgis";
import { normalizeAlnum } from "@/lib/text";
import type {
  CadastreConnector,
  CanonicalConcession,
  NormalizedStatus,
} from "@/lib/cadastre/types";

export const SIGMINE_PROCESSOS_URL =
  "https://geo.anm.gov.br/arcgis/rest/services/SIGMINE/dados_anm/MapServer/0";

const VIEWER_URL = "https://geo.anm.gov.br/portal/apps/webappviewer/index.html";

/**
 * Normaliza la FASE de la ANM. La capa solo contiene procesos ACTIVOS, así que
 * no hay estado "extinct": los requerimientos y disponibilidades son pending y
 * los títulos otorgados (lavra, licenciamento, autorização…) son active.
 */
export function normalizeBrazilStatus(fase: string | null): NormalizedStatus {
  const s = normalizeAlnum(fase);
  if (!s) return "unknown";
  if (s.includes("REQUERIMENTO") || s.includes("DISPONIBILIDADE")) return "pending";
  if (
    s.includes("CONCESSAO") ||
    s.includes("LAVRA") ||
    s.includes("LICENCIAMENTO") ||
    s.includes("EXTRACAO") ||
    s.includes("PESQUISA")
  ) {
    return "active";
  }
  return "unknown";
}

/** Mapea los atributos crudos de SIGMINE al esquema canónico. Puro. */
export function mapBrazilAttributes(a: Record<string, unknown>): CanonicalConcession {
  const fase = a.FASE != null ? String(a.FASE) : null;
  return {
    country: "BR",
    code: a.PROCESSO != null ? String(a.PROCESSO) : "",
    // En Brasil los procesos no tienen nombre propio; el identificador es el PROCESSO.
    name: null,
    holder: a.NOME != null ? String(a.NOME) : null,
    // La capa pública no expone el CNPJ del titular.
    holderTaxId: null,
    areaHa: a.AREA_HA != null ? Number(a.AREA_HA) : null,
    status: fase,
    statusNormalized: normalizeBrazilStatus(fase),
    type: fase,
    commodity: a.SUBS != null ? String(a.SUBS) : null,
    location: a.UF != null ? String(a.UF) : null,
    source: "ANM SIGMINE",
    sourceUrl: VIEWER_URL,
  };
}

export const brazilConnector: CadastreConnector = {
  country: "BR",
  countryName: "Brasil",
  institution: "ANM",
  async search(term, limit) {
    const safe = sanitizeArcgisTerm(term);
    if (!safe) return [];
    const clauses = [`UPPER(NOME) LIKE UPPER('%${safe}%')`, `UPPER(SUBS) LIKE UPPER('%${safe}%')`];
    // PROCESSO tiene forma "numero/año" (ej. 3457/1937).
    if (/^[\d./]+$/.test(safe)) clauses.push(`PROCESSO LIKE '%${safe}%'`);
    const rows = await arcgisQueryAttributes(SIGMINE_PROCESSOS_URL, {
      where: clauses.join(" OR "),
      outFields: "PROCESSO,FASE,NOME,SUBS,USO,AREA_HA,UF",
      limit,
      supportsPagination: false,
      timeoutMs: 30_000,
    });
    return rows.map(mapBrazilAttributes);
  },
};
