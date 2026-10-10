// Helper ArcGIS genérico para conectores de catastro.
//
// A diferencia de sngmQueryGeoJSON (pensado para ArcGIS Online, siempre envía
// resultRecordCount y f=geojson), los servidores gubernamentales antiguos
// (p. ej. GEOCATMIN de INGEMMET) rechazan la paginación con "Pagination is not
// supported" y no todos sirven GeoJSON. Este helper consulta con f=json,
// returnGeometry=false y paginación OPCIONAL, y devuelve solo los atributos;
// cuando la fuente no pagina, el recorte al límite se hace client-side.

export type ArcgisAttributesQuery = {
  where: string;
  outFields: string;
  limit: number;
  /** false para servidores que rechazan resultRecordCount (ArcGIS Server viejo). */
  supportsPagination?: boolean;
  timeoutMs?: number;
};

export async function arcgisQueryAttributes(
  layerUrl: string,
  opts: ArcgisAttributesQuery,
): Promise<Array<Record<string, unknown>>> {
  const params = new URLSearchParams({
    where: opts.where,
    outFields: opts.outFields,
    returnGeometry: "false",
    f: "json",
  });
  if (opts.supportsPagination !== false) {
    params.set("resultRecordCount", String(opts.limit));
  }
  try {
    const res = await fetch(`${layerUrl}/query?${params.toString()}`, {
      signal: AbortSignal.timeout(opts.timeoutMs ?? 20_000),
    });
    if (!res.ok) throw new Error(`CADASTRE_SOURCE_HTTP_${res.status}`);
    const json = (await res.json()) as {
      error?: unknown;
      features?: Array<{ attributes?: Record<string, unknown> }>;
    };
    if (json.error) throw new Error("CADASTRE_SOURCE_QUERY_FAILED");
    if (!Array.isArray(json.features)) throw new Error("CADASTRE_SOURCE_INVALID_RESPONSE");
    const rows = (json.features ?? [])
      .map((f) => f.attributes)
      .filter((a): a is Record<string, unknown> => !!a);
    return rows.slice(0, opts.limit);
  } catch (error) {
    throw error instanceof Error ? error : new Error("CADASTRE_SOURCE_UNAVAILABLE");
  }
}

/** Sanitiza un término para interpolar en un WHERE de ArcGIS (anti-inyección). */
export function sanitizeArcgisTerm(rawTerm: string): string | null {
  const term = rawTerm.trim();
  if (!term) return null;
  if (!/^[A-Za-z0-9ÁÉÍÓÚÑÇÃÕÂÊÔáéíóúñçãõâêô \-./]{1,64}$/.test(term)) return null;
  return term.replace(/'/g, "''");
}
