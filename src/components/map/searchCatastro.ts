// Búsqueda de concesiones SERNAGEOMIN por CODIGO o ROL.
// Consulta el ArcGIS REST público en la capa 0 (explotación) y 1 (exploración).

const ARCGIS_BASE =
  "https://catastro.sernageomin.cl/arcgis/rest/services/Concesiones_Mineras/Concesiones_Mineras/MapServer";

export type CatastroHit = {
  layer: 0 | 1;
  layerLabel: "Explotación" | "Exploración";
  properties: Record<string, unknown>;
  geometry: GeoJSON.Geometry;
};

/**
 * Busca por CODIGO o ROL en ambas capas. Devuelve hasta `limit` resultados.
 * Sanitiza el input contra inyección SQL básica del WHERE de ArcGIS.
 */
export async function searchCatastroByCode(rawTerm: string, limit = 10): Promise<CatastroHit[]> {
  const term = rawTerm.trim();
  if (!term) return [];
  // Solo letras, números, espacio, guion, punto, slash — campos típicos de
  // CODIGO/ROL chilenos. Bloquea comillas y operadores SQL.
  if (!/^[A-Za-z0-9 \-./]{1,64}$/.test(term)) {
    throw new Error("Término inválido. Usa solo letras, números, guión, punto o /.");
  }

  const safe = term.replace(/'/g, "''");
  // LIKE permite búsqueda parcial; UPPER hace case-insensitive.
  const where = `UPPER(CODIGO) LIKE UPPER('%${safe}%') OR UPPER(ROL) LIKE UPPER('%${safe}%')`;

  const params = new URLSearchParams({
    where,
    outFields: "*",
    outSR: "4326",
    f: "geojson",
    resultRecordCount: String(limit),
  });

  const out: CatastroHit[] = [];
  for (const layer of [0, 1] as const) {
    try {
      const res = await fetch(`${ARCGIS_BASE}/${layer}/query?${params}`);
      if (!res.ok) continue;
      const fc = (await res.json()) as GeoJSON.FeatureCollection;
      for (const f of fc.features ?? []) {
        if (!f.geometry) continue;
        out.push({
          layer,
          layerLabel: layer === 0 ? "Explotación" : "Exploración",
          properties: (f.properties ?? {}) as Record<string, unknown>,
          geometry: f.geometry,
        });
        if (out.length >= limit) return out;
      }
    } catch {
      // continuar con la siguiente capa
    }
  }
  return out;
}

/** Extrae los campos clave del feature ArcGIS con tolerancia a aliases. */
export function summarizeHit(hit: CatastroHit) {
  const p = hit.properties;
  const f = (...keys: string[]) => {
    for (const k of keys) {
      const v = p[k];
      if (v != null && v !== "") return v;
    }
    return null;
  };
  return {
    codigo: (f("CODIGO") ?? "—") as string,
    rol: (f("ROL") ?? "—") as string,
    nombre: (f("NOMBRE") ?? "—") as string,
    titular: (f("TITULAR", "NOMBRE_TIT") ?? "—") as string,
    areaHa: f("AREA_HA", "HECTAREAS") as number | null,
    vigencia: (f("VIGENCIA", "ESTADO") ?? "—") as string,
  };
}
