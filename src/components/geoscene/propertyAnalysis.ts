import type { Feature, FeatureCollection, Geometry, Position } from "geojson";
import { mineralClass, featureIntensity } from "./spectralStyle";

/** Pertenencia seleccionable del catastro cargado en el visor. */
export type PropertyOption = { key: string; label: string; feature: Feature };

type Bbox = [number, number, number, number];

const str = (v: unknown) => (v == null || v === "" ? null : String(v));

export function propertyLabel(p: Record<string, unknown> | null | undefined): string {
  const name = str(p?.nombre) ?? str(p?.NOMBRE) ?? str(p?.name) ?? str(p?.NOMBRE_CONCESION) ?? "Sin nombre";
  const rol = str(p?.rol) ?? str(p?.ROL) ?? str(p?.rol_nacional) ?? str(p?.ROL_NACIONAL);
  return rol ? `${name} · ${rol}` : name;
}

/** Lista las pertenencias poligonales del catastro, ordenadas por nombre y sin duplicados. */
export function listProperties(cadastre: FeatureCollection | undefined): PropertyOption[] {
  const seen = new Set<string>();
  const out: PropertyOption[] = [];
  for (const f of cadastre?.features ?? []) {
    if (!f.geometry || !/Polygon/.test(f.geometry.type)) continue;
    const label = propertyLabel(f.properties as Record<string, unknown>);
    const key = `${label}#${out.length}`;
    if (seen.has(label)) continue;
    seen.add(label);
    out.push({ key, label, feature: f });
  }
  return out.sort((a, b) => a.label.localeCompare(b.label, "es"));
}

function rings(g: Geometry): Position[][][] {
  if (g.type === "Polygon") return [g.coordinates];
  if (g.type === "MultiPolygon") return g.coordinates;
  return [];
}

export function featureBbox(f: Feature): Bbox | null {
  if (!f.geometry) return null;
  let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity;
  for (const poly of rings(f.geometry)) for (const r of poly) for (const [x, y] of r) {
    w = Math.min(w, x); s = Math.min(s, y); e = Math.max(e, x); n = Math.max(n, y);
  }
  return Number.isFinite(w) ? [w, s, e, n] : null;
}

function inRing(x: number, y: number, r: Position[]): boolean {
  let inside = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, yi] = r[i], [xj, yj] = r[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function pointInFeature(x: number, y: number, f: Feature): boolean {
  if (!f.geometry) return false;
  return rings(f.geometry).some((poly) => poly.length > 0 && inRing(x, y, poly[0]) && !poly.slice(1).some((h) => inRing(x, y, h)));
}

/** Vértices representativos de una geometría (para cruzar líneas y polígonos). */
function samplePoints(g: Geometry | null): Position[] {
  if (!g) return [];
  switch (g.type) {
    case "Point": return [g.coordinates];
    case "MultiPoint":
    case "LineString": return g.coordinates;
    case "MultiLineString":
    case "Polygon": return g.coordinates.flat();
    case "MultiPolygon": return g.coordinates.flat(2);
    default: return [];
  }
}

function touches(f: Feature, prop: Feature): boolean {
  return samplePoints(f.geometry).some(([x, y]) => pointInFeature(x, y, prop));
}

const areaHa = (p: Record<string, unknown>) => {
  for (const k of ["hectareas", "HECTAREAS", "superficie_ha", "ha", "SUPERFICIE"]) {
    const n = Number(p[k]);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
};

export type PropertySummary = {
  property: { label: string; titular: string | null; situacion: string | null; hectareas: number | null };
  spectral: { total: number; byMineral: Array<{ label: string; count: number; maxIntensity: number | null }> };
  structures: { measured: number; withDip: number; codes: string[] };
  lineaments: number;
  officialUnits: Array<{ code: string; nombre: string }>;
  officialFaults: number;
  geophysicsAnomalies: number;
  drillholes: number;
  /** Fuentes sin datos dentro de la pertenencia: no se rellenan. */
  gaps: string[];
};

/** Cruza las capas reales cargadas en el visor con una pertenencia. Determinístico. */
export function summarizeProperty(
  prop: Feature,
  layers: ReadonlyArray<{ id: string; data?: FeatureCollection }>,
): PropertySummary {
  const get = (id: string) => layers.find((l) => l.id === id)?.data?.features ?? [];
  const inside = (id: string) => get(id).filter((f) => touches(f, prop));
  const p = (prop.properties ?? {}) as Record<string, unknown>;

  const spectralMap = new Map<string, { count: number; max: number | null }>();
  const spectral = inside("remote_sensing.hyperspectral");
  for (const f of spectral) {
    const fp = (f.properties ?? {}) as Record<string, unknown>;
    const cls = mineralClass(fp.nombre ?? fp.mineral ?? fp.label ?? fp.index)?.label ?? String(fp.nombre ?? fp.mineral ?? "Firma");
    const cur = spectralMap.get(cls) ?? { count: 0, max: null };
    const it = featureIntensity(fp);
    cur.count += 1;
    if (it != null) cur.max = cur.max == null ? it : Math.max(cur.max, it);
    spectralMap.set(cls, cur);
  }
  const structures = inside("geology.structures");
  const units = new Map<string, string>();
  for (const f of inside("geology.official_map_units")) {
    const fp = (f.properties ?? {}) as Record<string, unknown>;
    const code = str(fp.codigo) ?? str(fp.code) ?? str(fp.CODIGO) ?? "—";
    units.set(code, str(fp.nombre) ?? str(fp.NOMBRE) ?? str(fp.litologia) ?? "");
  }
  const s: PropertySummary = {
    property: {
      label: propertyLabel(p),
      titular: str(p.titular) ?? str(p.TITULAR),
      situacion: str(p.situacion) ?? str(p.SITUACION) ?? str(p.estado),
      hectareas: areaHa(p),
    },
    spectral: {
      total: spectral.length,
      byMineral: [...spectralMap].map(([label, v]) => ({ label, count: v.count, maxIntensity: v.max })).sort((a, b) => b.count - a.count),
    },
    structures: {
      measured: structures.length,
      withDip: structures.filter((f) => Number.isFinite(Number((f.properties as Record<string, unknown> | null)?.manteo ?? NaN))).length,
      codes: structures.map((f) => str((f.properties as Record<string, unknown> | null)?.codigo) ?? str((f.properties as Record<string, unknown> | null)?.nombre) ?? "").filter(Boolean),
    },
    lineaments: inside("remote_sensing.lineaments").length,
    officialUnits: [...units].map(([code, nombre]) => ({ code, nombre })),
    officialFaults: inside("geology.official_faults").length,
    geophysicsAnomalies: inside("geophysics.anomalies").length,
    drillholes: inside("drilling.completed").length,
    gaps: [],
  };
  if (!s.spectral.total) s.gaps.push("Sin firmas espectrales dentro de la pertenencia");
  if (!s.structures.measured) s.gaps.push("Sin estructuras medidas en terreno");
  if (!s.officialUnits.length) s.gaps.push("Sin carta geológica vectorial oficial publicada");
  if (!s.geophysicsAnomalies) s.gaps.push("Sin geofísica con archivo fuente");
  if (!s.drillholes) s.gaps.push("Sin sondajes ejecutados");
  return s;
}
