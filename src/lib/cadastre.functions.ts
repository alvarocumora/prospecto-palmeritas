import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getCadastreConnector, listCadastreCountries } from "@/lib/cadastre/registry";
import type { CanonicalConcession } from "@/lib/cadastre/types";

// Búsqueda catastral multi-país sobre la Capa Catastral Universal.
// Datos públicos gubernamentales; sin auth. La consulta va en vivo a la fuente
// oficial de cada país vía su conector.

const searchInput = z.object({
  country: z.string().trim().length(2).toUpperCase(),
  q: z.string().trim().min(2).max(64),
  limit: z.number().int().min(1).max(50).optional(),
});

export type GlobalCadastreSearch = {
  country: string;
  institution: string;
  results: CanonicalConcession[];
  total: number;
};

export const searchGlobalCadastre = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => searchInput.parse(d))
  .handler(async ({ data }): Promise<GlobalCadastreSearch> => {
    const connector = getCadastreConnector(data.country);
    if (!connector) {
      throw new Error("CADASTRE_CONNECTOR_NOT_FOUND");
    }
    const results = await connector.search(data.q, data.limit ?? 25);
    return {
      country: connector.country,
      institution: connector.institution,
      results,
      total: results.length,
    };
  });

export const getCadastreCountries = createServerFn({ method: "GET" }).handler(async () =>
  listCadastreCountries(),
);
