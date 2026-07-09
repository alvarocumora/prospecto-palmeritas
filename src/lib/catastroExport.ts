// Exportación de las concesiones visibles del mapa del catastro a GeoJSON y CSV.
// Lógica pura (sin DOM ni Leaflet) para poder testearla; el route recolecta las
// features visibles (layer.feature) y llama a estas funciones.

export type ConcesionFeature = {
  type: "Feature";
  geometry: unknown;
  properties: Record<string, unknown>;
};

const CSV_COLUMNS = [
  "ROL",
  "NOMBRE",
  "TITULAR",
  "RUT",
  "COMUNA",
  "REGION",
  "HECTAREAS",
  "TIPO",
  "SITUACION",
] as const;

function rol(p: Record<string, unknown>): string {
  const n = p.NUMERO_ROL ?? "";
  const dv = p.DV_ROL ? `-${p.DV_ROL}` : "";
  return n === "" ? "" : `${n}${dv}`;
}

function rut(p: Record<string, unknown>): string {
  const n = p.TITULAR_RUT ?? "";
  const dv = p.TITULAR_DV ? `-${p.TITULAR_DV}` : "";
  return n === "" ? "" : `${n}${dv}`;
}

/** Fila plana de una concesión para CSV / tabla. */
export function propsToRow(
  p: Record<string, unknown>,
): Record<(typeof CSV_COLUMNS)[number], string> {
  const s = (v: unknown) => (v == null ? "" : String(v));
  return {
    ROL: rol(p),
    NOMBRE: s(p.NOMBRE),
    TITULAR: s(p.TITULAR_NOMBRE),
    RUT: rut(p),
    COMUNA: s(p.COMUNA),
    REGION: s(p.REGION),
    HECTAREAS: s(p.HECTAREAS),
    TIPO: s(p.TIPO_CONCESION),
    SITUACION: s(p.SITUACION_CONCESION),
  };
}

/** Escapa un valor para CSV (comillas dobles si contiene , " o salto de línea). */
function csvCell(v: string): string {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export function featuresToCSV(features: ConcesionFeature[]): string {
  const header = CSV_COLUMNS.join(",");
  const lines = features.map((f) => {
    const row = propsToRow(f.properties ?? {});
    return CSV_COLUMNS.map((c) => csvCell(row[c])).join(",");
  });
  return [header, ...lines].join("\n");
}

export function featuresToGeoJSON(features: ConcesionFeature[]): string {
  return JSON.stringify(
    {
      type: "FeatureCollection",
      features: features.map((f) => ({
        type: "Feature" as const,
        geometry: f.geometry ?? null,
        properties: f.properties ?? {},
      })),
    },
    null,
    2,
  );
}
