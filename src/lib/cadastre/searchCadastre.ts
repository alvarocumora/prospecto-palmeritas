import type { CadastreCountry, CanonicalConcession } from "@/lib/cadastre/types";
import { getCadastreConnector } from "@/lib/cadastre/registry";
import { searchMiningCadastre, type CadastreSearch } from "@/lib/cadastre/miningCadastreEngine";

export type GlobalCadastreScope =
  | { kind: "country"; code: CadastreCountry; query: string }
  | { kind: "bbox"; country: CadastreCountry; bbox: [number, number, number, number] }
  | { kind: "project"; country: CadastreCountry; projectId: string; bbox?: [number, number, number, number] }
  | { kind: "role"; country: CadastreCountry; role: string };

export type GlobalCadastreSourceState = "available" | "unavailable";

export type GlobalCadastreResult =
  | {
      ok: true;
      sourceState: "available";
      country: CadastreCountry;
      authority: string;
      queriedAt: string;
      concessions: CanonicalConcession[];
      features?: GeoJSON.FeatureCollection;
      total: number;
    }
  | {
      ok: false;
      sourceState: "unavailable";
      country: CadastreCountry;
      authority: string;
      queriedAt: string;
      concessions: [];
      total: 0;
      error: string;
    };

export type SearchCadastreInput = {
  scope: GlobalCadastreScope;
  limit?: number;
  filters?: Pick<CadastreSearch, "term" | "holder" | "type" | "status">;
};

function unavailable(country: CadastreCountry, authority: string, error: unknown): GlobalCadastreResult {
  return {
    ok: false,
    sourceState: "unavailable",
    country,
    authority,
    queriedAt: new Date().toISOString(),
    concessions: [],
    total: 0,
    error: error instanceof Error ? error.message : String(error),
  };
}

/**
 * Global Cadastre Core v1.
 *
 * This is the canonical read contract for every GeoCapitals cadastre surface.
 * Routes and projects must migrate toward this API instead of querying a
 * country service directly. A successful response with total=0 means a real
 * empty result; sourceState=unavailable means the authority could not answer.
 *
 * Persistence/write-through to cadastre_national is intentionally introduced
 * behind this contract in the next migration so consumers do not change again.
 */
export async function searchCadastre(input: SearchCadastreInput): Promise<GlobalCadastreResult> {
  const { scope } = input;
  const country = scope.kind === "country" ? scope.code : scope.country;
  const connector = getCadastreConnector(country);
  const authority = connector?.institution ?? "UNKNOWN";

  try {
    if (scope.kind === "country") {
      if (!connector) return unavailable(country, authority, "CADASTRE_CONNECTOR_NOT_FOUND");
      const concessions = await connector.search(scope.query, input.limit ?? 50);
      return {
        ok: true,
        sourceState: "available",
        country,
        authority,
        queriedAt: new Date().toISOString(),
        concessions,
        total: concessions.length,
      };
    }

    if (scope.country !== "CL") {
      if (!connector) return unavailable(country, authority, "CADASTRE_CONNECTOR_NOT_FOUND");
      const term = scope.kind === "role" ? scope.role : input.filters?.term;
      if (!term) return unavailable(country, authority, "SCOPE_NOT_SUPPORTED_BY_CONNECTOR");
      const concessions = await connector.search(term, input.limit ?? 50);
      return {
        ok: true,
        sourceState: "available",
        country,
        authority,
        queriedAt: new Date().toISOString(),
        concessions,
        total: concessions.length,
      };
    }

    const bbox = scope.kind === "bbox" || scope.kind === "project" ? scope.bbox : undefined;
    if (scope.kind === "project" && !bbox) {
      return unavailable(country, authority, "PROJECT_SCOPE_REQUIRES_BBOX_UNTIL_PROJECT_GEOMETRY_ADAPTER");
    }

    const result = await searchMiningCadastre({
      ...input.filters,
      role: scope.kind === "role" ? scope.role : undefined,
      bbox,
      limit: input.limit ?? 1000,
    });

    return {
      ok: true,
      sourceState: "available",
      country: "CL",
      authority: result.source,
      queriedAt: result.queriedAt,
      concessions: [],
      features: result.features,
      total: result.count,
    };
  } catch (error) {
    return unavailable(country, authority, error);
  }
}
