// Registro de conectores de catastro por país. Punto único de extensión:
// para sumar un país se implementa su conector y se agrega aquí.

import { chileConnector } from "@/lib/cadastre/connectors/chile";
import { peruConnector } from "@/lib/cadastre/connectors/peru";
import type { CadastreConnector, CadastreCountry } from "@/lib/cadastre/types";

export const CADASTRE_CONNECTORS: Record<CadastreCountry, CadastreConnector> = {
  CL: chileConnector,
  PE: peruConnector,
};

export function getCadastreConnector(country: string): CadastreConnector | null {
  return CADASTRE_CONNECTORS[country as CadastreCountry] ?? null;
}

/** Países disponibles para la UI (orden de despliegue). */
export function listCadastreCountries(): Array<{
  country: CadastreCountry;
  countryName: string;
  institution: string;
}> {
  return Object.values(CADASTRE_CONNECTORS).map((c) => ({
    country: c.country,
    countryName: c.countryName,
    institution: c.institution,
  }));
}
