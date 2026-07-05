// Búsqueda de concesiones SERNAGEOMIN v2 por nombre, titular o rol.
// El MapServer legacy (CODIGO/ROL, capas 0/1) está caído — se consulta la
// capa única Marcelo_Layer/2 filtrando por TIPO_CONCESION (ver src/lib/sngm.ts).

import { SNGM_CONCESIONES_URL, sngmQueryGeoJSON, sngmSanitizeTerm } from "@/lib/sngm";

export type CatastroHit = {
  layer: 0 | 1;
  layerLabel: "Explotación" | "Exploración";
  properties: Record<string, unknown>;
  geometry: GeoJSON.Geometry;
};

/**
 * Busca por NOMBRE, TITULAR_NOMBRE o NUMERO_ROL. Devuelve hasta `limit`
 * resultados. Sanitiza el input contra inyección SQL básica del WHERE.
 */
export async function searchCatastroByCode(rawTerm: string, limit = 10): Promise<CatastroHit[]> {
  const safe = sngmSanitizeTerm(rawTerm);
  if (safe === null) {
    if (!rawTerm.trim()) return [];
    throw new Error("Término inválido. Usa solo letras, números, guión, punto o /.");
  }

  const clauses = [
    `UPPER(NOMBRE) LIKE UPPER('%${safe}%')`,
    `UPPER(TITULAR_NOMBRE) LIKE UPPER('%${safe}%')`,
  ];
  // Si el término es numérico también puede ser el rol de la concesión
  if (/^\d+$/.test(safe)) clauses.push(`NUMERO_ROL = ${safe}`);
  const where = clauses.join(" OR ");

  const fc = await sngmQueryGeoJSON(SNGM_CONCESIONES_URL, { where, limit });
  const out: CatastroHit[] = [];
  for (const f of fc?.features ?? []) {
    if (!f.geometry) continue;
    const props = (f.properties ?? {}) as Record<string, unknown>;
    const isExplotacion = String(props.TIPO_CONCESION ?? "").toUpperCase() === "EXPLOTACION";
    out.push({
      layer: isExplotacion ? 0 : 1,
      layerLabel: isExplotacion ? "Explotación" : "Exploración",
      properties: props,
      geometry: f.geometry,
    });
    if (out.length >= limit) break;
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
  const rolNum = f("NUMERO_ROL");
  const rolDv = f("DV_ROL");
  const rol = rolNum != null ? `${rolNum}${rolDv != null ? `-${rolDv}` : ""}` : (f("ROL") ?? "—");
  return {
    codigo: (f("CODIGO") ?? rol ?? "—") as string,
    rol: rol as string,
    nombre: (f("NOMBRE") ?? "—") as string,
    titular: (f("TITULAR_NOMBRE", "TITULAR", "NOMBRE_TIT") ?? "—") as string,
    areaHa: f("HECTAREAS", "AREA_HA") as number | null,
    vigencia: (f("SITUACION_CONCESION", "VIGENCIA", "ESTADO") ?? "—") as string,
  };
}
