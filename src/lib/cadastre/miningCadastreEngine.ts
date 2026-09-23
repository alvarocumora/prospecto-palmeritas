import { SNGM_CONCESIONES_URL, sngmQueryGeoJSON, sngmSanitizeTerm } from "@/lib/sngm";

export type CadastreSearch = {
  term?: string;
  holder?: string;
  role?: string;
  type?: "EXPLORACION" | "EXPLOTACION";
  status?: "CONSTITUIDA" | "EN TRAMITE";
  bbox?: [number, number, number, number];
  limit?: number;
};

export type CadastreSummary = {
  features: GeoJSON.FeatureCollection;
  source: "SERNAGEOMIN";
  queriedAt: string;
  count: number;
};

function clause(field: string, raw?: string) {
  if (!raw) return null;
  const v = sngmSanitizeTerm(raw);
  return v ? `UPPER(${field}) LIKE UPPER('%${v}%')` : null;
}

export async function searchMiningCadastre(input: CadastreSearch = {}): Promise<CadastreSummary> {
  const where = [
    clause("NOMBRE", input.term),
    clause("TITULAR_NOMBRE", input.holder),
    clause("NUMERO_ROL", input.role),
    input.type ? `TIPO_CONCESION='${input.type}'` : null,
    input.status ? `SITUACION_CONCESION='${input.status}'` : null,
  ].filter(Boolean).join(" AND ") || "1=1";

  const features = await sngmQueryGeoJSON(SNGM_CONCESIONES_URL, {
    where,
    bbox: input.bbox,
    limit: Math.min(input.limit ?? 1000, 2000),
    outFields: "OBJECTID,NUMERO_ROL,DV_ROL,NOMBRE,HECTAREAS,FECHA_VENCIMIENTO,SITUACION_CONCESION,TIPO_CONCESION,COMUNA,TITULAR_NOMBRE,TITULAR_RUT,TITULAR_DV,DATUM,HUSO",
  });

  const fc = features ?? { type: "FeatureCollection", features: [] };
  return { features: fc, source: "SERNAGEOMIN", queriedAt: new Date().toISOString(), count: fc.features.length };
}
