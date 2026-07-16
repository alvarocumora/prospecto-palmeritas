// Conector-fábrica Landfolio/FlexiCadastre (Trimble) — el patrón de catastro
// minero usado por ~15 países de África y otros mercados emergentes.
//
// A diferencia de los conectores nacionales (SERNAGEOMIN, GEOCATMIN, SIGMINE),
// aquí el esquema pertenece al PRODUCTO, no al país: Code, Parties (titular),
// TypeGroup/Type, StatusGrp/Status, AreaValue/AreaUnit, Commodities, Region,
// DteExpires (epoch ms). Un solo mapper sirve para todos los países Landfolio;
// agregar un país nuevo = una entrada de configuración con su service URL.
//
// Fuente verificada en vivo (Zambia, ags1.landfolio.com ProdPortal/ZambiaPortal
// capa 0 "All Licenses"): First Quantum → licencias reales con commodity
// (Cobalt), 45.712 ha, StatusGrp/Status y fechas. Este ArcGIS moderno SÍ
// soporta paginación (maxRecordCount 1000).

import { arcgisQueryAttributes, sanitizeArcgisTerm } from "@/lib/cadastre/arcgis";
import { normalizeAlnum } from "@/lib/text";
import type {
  CadastreConnector,
  CadastreCountry,
  CanonicalConcession,
  NormalizedStatus,
} from "@/lib/cadastre/types";

export type LandfolioConfig = {
  country: CadastreCountry;
  countryName: string;
  institution: string;
  /** URL de la capa de licencias ("All Licenses"). */
  layerUrl: string;
  /** Visor oficial del portal del país. */
  viewerUrl: string;
};

/**
 * Normaliza StatusGrp de Landfolio: Active → vigente, Application → trámite,
 * Inactive (expired/cancelled/relinquished) → extinta.
 */
export function normalizeLandfolioStatus(statusGrp: string | null): NormalizedStatus {
  const s = normalizeAlnum(statusGrp);
  if (!s) return "unknown";
  if (s.includes("ACTIVE") && !s.includes("INACTIVE")) return "active";
  if (s.includes("APPLICATION") || s.includes("PENDING")) return "pending";
  if (s.includes("INACTIVE")) return "extinct";
  return "unknown";
}

function toAreaHa(value: unknown, unit: unknown): number | null {
  if (value == null) return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const u = normalizeAlnum(unit != null ? String(unit) : "");
  if (u.includes("HECTARE")) return n;
  if (u.includes("KILOMET") || u.includes("KM")) return n * 100; // km² → ha
  return n; // unidad desconocida: valor crudo
}

function toIsoDate(epochMs: unknown): string | null {
  if (epochMs == null) return null;
  const n = Number(epochMs);
  if (!Number.isFinite(n) || n <= 0) return null;
  try {
    return new Date(n).toISOString().slice(0, 10);
  } catch {
    return null;
  }
}

/** Mapea los atributos crudos de una capa Landfolio al esquema canónico. Puro. */
export function mapLandfolioAttributes(
  a: Record<string, unknown>,
  cfg: Pick<LandfolioConfig, "country" | "institution" | "viewerUrl">,
): CanonicalConcession {
  const statusGrp = a.StatusGrp != null ? String(a.StatusGrp) : null;
  const status = a.Status != null ? String(a.Status) : null;
  return {
    country: cfg.country,
    code: a.Code != null ? String(a.Code).trim() : "",
    name: a.Name != null && String(a.Name).trim() !== "" ? String(a.Name).trim() : null,
    holder: a.Parties != null ? String(a.Parties) : null,
    holderTaxId: null,
    areaHa: toAreaHa(a.AreaValue, a.AreaUnit),
    // Estado crudo: "Active · Granted", etc.
    status: [statusGrp, status].filter(Boolean).join(" · ") || null,
    statusNormalized: normalizeLandfolioStatus(statusGrp),
    type: a.Type != null ? String(a.Type) : null,
    commodity: a.Commodities != null ? String(a.Commodities) : null,
    expiresAt: toIsoDate(a.DteExpires),
    location: a.MapRef != null ? String(a.MapRef) : a.Region != null ? String(a.Region) : null,
    source: `${cfg.institution} (Landfolio)`,
    sourceUrl: cfg.viewerUrl,
  };
}

const OUT_FIELDS =
  "Code,Name,Parties,TypeGroup,Type,StatusGrp,Status,AreaValue,AreaUnit,Commodities,Region,MapRef,DteExpires";

/** Crea un conector de catastro para un país que corre sobre Landfolio. */
export function makeLandfolioConnector(cfg: LandfolioConfig): CadastreConnector {
  return {
    country: cfg.country,
    countryName: cfg.countryName,
    institution: cfg.institution,
    async search(term, limit) {
      const safe = sanitizeArcgisTerm(term);
      if (!safe) return [];
      const clauses = [
        `UPPER(Parties) LIKE UPPER('%${safe}%')`,
        `UPPER(Code) LIKE UPPER('%${safe}%')`,
        `UPPER(Commodities) LIKE UPPER('%${safe}%')`,
      ];
      const rows = await arcgisQueryAttributes(cfg.layerUrl, {
        where: clauses.join(" OR "),
        outFields: OUT_FIELDS,
        limit,
        timeoutMs: 30_000,
      });
      return rows.map((r) => mapLandfolioAttributes(r, cfg));
    },
  };
}

/** Zambia — Mining Cadastre (Ministry of Mines, portal Landfolio). Verificado. */
export const zambiaConnector = makeLandfolioConnector({
  country: "ZM",
  countryName: "Zambia",
  institution: "Zambia Mining Cadastre",
  layerUrl: "https://ags1.landfolio.com/arcgis/rest/services/ProdPortal/ZambiaPortal/MapServer/0",
  viewerUrl: "https://portals.landfolio.com/zambia/",
});
