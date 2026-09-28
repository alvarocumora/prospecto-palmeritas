/**
 * Subconjunto mínimo de un STAC Item (spec 1.1.0) — solo lo que
 * `stacAdapter.ts` necesita para construir un GeoscienceDatasetDraft. No es
 * el modelo STAC completo; se amplía en GEO-02 cuando exista un cliente HTTP
 * real (Copernicus Data Space / Planetary Computer).
 */
export type StacItem = {
  id: string;
  collection?: string;
  bbox?: number[];
  geometry?: { type: string; coordinates: unknown } | null;
  properties: {
    datetime?: string | null;
    start_datetime?: string | null;
    end_datetime?: string | null;
    gsd?: number;
    platform?: string;
    instruments?: string[];
    "eo:cloud_cover"?: number;
    [key: string]: unknown;
  };
  assets?: Record<string, { href: string; type?: string; title?: string }>;
};
