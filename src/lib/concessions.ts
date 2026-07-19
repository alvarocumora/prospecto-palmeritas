// Catastro / concesiones mineras (lógica pura): tipos y estados, validación de
// polígono GeoJSON y agregación de superficie. Los vértices se guardan como
// GeoJSON en WGS84 (lng/lat), igual que el resto del motor de mapas.

export const CONCESSION_TYPES = [
  "exploracion",
  "explotacion",
  "cateo",
  "mina",
  "cantera",
  "otro",
] as const;
export type ConcessionType = (typeof CONCESSION_TYPES)[number];

export const CONCESSION_TYPE_LABELS: Record<ConcessionType, string> = {
  exploracion: "Exploración",
  explotacion: "Explotación",
  cateo: "Cateo",
  mina: "Mina / pertenencia",
  cantera: "Cantera",
  otro: "Otro",
};

export const CONCESSION_STATUSES = ["vigente", "en_tramite", "caducada", "otro"] as const;
export type ConcessionStatus = (typeof CONCESSION_STATUSES)[number];

export const CONCESSION_STATUS_LABELS: Record<ConcessionStatus, string> = {
  vigente: "Vigente",
  en_tramite: "En trámite",
  caducada: "Caducada",
  otro: "Otro",
};

export function normalizeConcessionType(v: string | null | undefined): ConcessionType {
  const s = (v ?? "").toLowerCase().trim();
  return (CONCESSION_TYPES as readonly string[]).includes(s) ? (s as ConcessionType) : "otro";
}
export function normalizeConcessionStatus(v: string | null | undefined): ConcessionStatus {
  const s = (v ?? "").toLowerCase().trim();
  return (CONCESSION_STATUSES as readonly string[]).includes(s) ? (s as ConcessionStatus) : "otro";
}

export type GeoJsonGeometry = {
  type: string;
  coordinates: unknown;
};

export type PolygonValidation = {
  ok: boolean;
  geometry: GeoJsonGeometry | null;
  /** Nº de vértices del anillo exterior (sin contar el cierre duplicado). */
  vertexCount: number;
  error: string | null;
};

function ringVertexCount(ring: unknown): number {
  if (!Array.isArray(ring)) return 0;
  const n = ring.length;
  if (n < 2) return n;
  // Un anillo cerrado repite el primer punto al final: no lo contamos.
  const first = ring[0];
  const last = ring[n - 1];
  const closed =
    Array.isArray(first) && Array.isArray(last) && first[0] === last[0] && first[1] === last[1];
  return closed ? n - 1 : n;
}

/**
 * Valida un texto como polígono GeoJSON (Geometry o Feature). Acepta Polygon y
 * MultiPolygon. Devuelve la geometría normalizada y el nº de vértices. Vacío es
 * válido (sin polígono). Puro.
 */
export function validateGeoJsonPolygon(text: string | null | undefined): PolygonValidation {
  const t = (text ?? "").trim();
  if (t === "") return { ok: true, geometry: null, vertexCount: 0, error: null };
  let parsed: unknown;
  try {
    parsed = JSON.parse(t);
  } catch {
    return { ok: false, geometry: null, vertexCount: 0, error: "JSON inválido." };
  }
  // Feature → geometry
  const obj = parsed as { type?: string; geometry?: unknown; coordinates?: unknown };
  const geom = (
    obj?.type === "Feature"
      ? (obj.geometry as GeoJsonGeometry | undefined)
      : (parsed as GeoJsonGeometry)
  ) as GeoJsonGeometry | undefined;
  if (!geom || typeof geom.type !== "string") {
    return { ok: false, geometry: null, vertexCount: 0, error: "No es una geometría GeoJSON." };
  }
  if (geom.type === "Polygon") {
    const rings = geom.coordinates as unknown;
    if (!Array.isArray(rings) || rings.length === 0) {
      return { ok: false, geometry: null, vertexCount: 0, error: "Polígono sin anillo." };
    }
    const vc = ringVertexCount(rings[0]);
    if (vc < 3) {
      return {
        ok: false,
        geometry: null,
        vertexCount: vc,
        error: "El polígono necesita ≥3 vértices.",
      };
    }
    return { ok: true, geometry: geom, vertexCount: vc, error: null };
  }
  if (geom.type === "MultiPolygon") {
    const polys = geom.coordinates as unknown;
    if (!Array.isArray(polys) || polys.length === 0) {
      return { ok: false, geometry: null, vertexCount: 0, error: "MultiPolygon vacío." };
    }
    const vc = Array.isArray(polys[0]) ? ringVertexCount((polys[0] as unknown[])[0]) : 0;
    return {
      ok: vc >= 3,
      geometry: geom,
      vertexCount: vc,
      error: vc >= 3 ? null : "Anillo inválido.",
    };
  }
  return { ok: false, geometry: null, vertexCount: 0, error: `Tipo no soportado: ${geom.type}.` };
}

export type ConcessionLike = { area_ha: number | null };

/** Superficie total (suma de área de las concesiones con dato válido). */
export function totalAreaHa(rows: ConcessionLike[]): number {
  return rows.reduce(
    (a, r) => a + (r.area_ha != null && Number.isFinite(r.area_ha) ? r.area_ha : 0),
    0,
  );
}
