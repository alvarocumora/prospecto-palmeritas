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
  const where =
    [
      clause("NOMBRE", input.term),
      clause("TITULAR_NOMBRE", input.holder),
      clause("NUMERO_ROL", input.role),
      input.type ? `TIPO_CONCESION='${input.type}'` : null,
      input.status ? `SITUACION_CONCESION='${input.status}'` : null,
    ]
      .filter(Boolean)
      .join(" AND ") || "1=1";

  const features = await sngmQueryGeoJSON(SNGM_CONCESIONES_URL, {
    where,
    bbox: input.bbox,
    limit: Math.min(input.limit ?? 1000, 2000),
    outFields:
      "OBJECTID,NUMERO_ROL,DV_ROL,NOMBRE,HECTAREAS,FECHA_VENCIMIENTO,SITUACION_CONCESION,TIPO_CONCESION,COMUNA,TITULAR_NOMBRE,TITULAR_RUT,TITULAR_DV,DATUM,HUSO",
  });

  if (!features) throw new Error("SERNAGEOMIN_UNAVAILABLE");
  return {
    features,
    source: "SERNAGEOMIN",
    queriedAt: new Date().toISOString(),
    count: features.features.length,
  };
}

export type CadastreFeatureRecord = {
  id: string;
  role: string;
  name: string;
  holder: string;
  type: string;
  status: string;
  hectares: number | null;
  commune: string;
  datum: string;
  zone: string;
  feature: GeoJSON.Feature;
};

export function cadastreRecords(fc: GeoJSON.FeatureCollection): CadastreFeatureRecord[] {
  return fc.features.map((feature, index) => {
    const p = (feature.properties ?? {}) as Record<string, unknown>;
    const number = String(p.NUMERO_ROL ?? "").trim();
    const dv = String(p.DV_ROL ?? "").trim();
    const rawHa = Number(p.HECTAREAS);
    return {
      id: String(p.OBJECTID ?? index),
      role: dv ? `${number}-${dv}` : number || "—",
      name: String(p.NOMBRE ?? "Sin nombre"),
      holder: String(p.TITULAR_NOMBRE ?? "—"),
      type: String(p.TIPO_CONCESION ?? "—"),
      status: String(p.SITUACION_CONCESION ?? "—"),
      hectares: Number.isFinite(rawHa) ? rawHa : null,
      commune: String(p.COMUNA ?? "—"),
      datum: String(p.DATUM ?? "—"),
      zone: String(p.HUSO ?? "—"),
      feature,
    };
  });
}

export function summarizeCadastre(records: CadastreFeatureRecord[]) {
  const hectares = records.reduce((sum, r) => sum + (r.hectares ?? 0), 0);
  return {
    count: records.length,
    hectares,
    exploration: records.filter((r) => r.type.toUpperCase() === "EXPLORACION").length,
    exploitation: records.filter((r) => r.type.toUpperCase() === "EXPLOTACION").length,
    constituted: records.filter((r) => r.status.toUpperCase() === "CONSTITUIDA").length,
    pending: records.filter((r) => r.status.toUpperCase() === "EN TRAMITE").length,
  };
}
