// Filtro de corredor (slab) sobre las capas de evidencia vectorial (muestras,
// targets, estructuras, anomalías geofísicas). Los Verdes/Tilama no tiene malla
// de terreno CAD propia (su relieve 3D es el DEM nativo de MapLibre), así que no
// existe una geometría deck.gl que se pueda recortar por shader. En vez de eso,
// "cortar el cerro" se resuelve filtrando qué features caen dentro de una franja
// perpendicular a un eje elegido (N-S, E-W o rumbo), con un ancho ajustable.
export type ClipAxis = "ns" | "ew" | "strike";

export type ClipPlaneState = {
  on: boolean;
  axis: ClipAxis;
  center: [number, number] | null; // [lng, lat]
  azimuthDeg: number; // rumbo del plano de corte, usado cuando axis === "strike"
  thicknessM: number;
};

export const CLIP_THICKNESS_DEFAULT_M = 50;
export const CLIP_THICKNESS_MIN_M = 10;
export const CLIP_THICKNESS_MAX_M = 200;
export const CLIP_THICKNESS_STEP_M = 10;

const METERS_PER_DEG_LAT = 111_320;

function metersPerDegLng(latDeg: number): number {
  return METERS_PER_DEG_LAT * Math.cos((latDeg * Math.PI) / 180);
}

/** Azimut (grados, 0=N) normal al plano de corte para cada eje. */
export function clipAxisAzimuth(axis: ClipAxis, strikeAzimuthDeg: number): number {
  if (axis === "ns") return 90; // plano corre N-S => su normal apunta E-W
  if (axis === "ew") return 0; // plano corre E-W => su normal apunta N-S
  return (strikeAzimuthDeg + 90) % 360;
}

/**
 * Distancia perpendicular (m, con signo) de `point` al plano que pasa por
 * `center` con normal en `normalAzimuthDeg` (grados desde el norte).
 * Aproximación equirectangular local, suficiente a escala de un prospecto.
 */
export function perpendicularDistanceM(
  center: [number, number],
  normalAzimuthDeg: number,
  point: [number, number],
): number {
  const [lng0, lat0] = center;
  const [lng, lat] = point;
  const dxM = (lng - lng0) * metersPerDegLng(lat0);
  const dyM = (lat - lat0) * METERS_PER_DEG_LAT;
  const rad = (normalAzimuthDeg * Math.PI) / 180;
  const nx = Math.sin(rad);
  const ny = Math.cos(rad);
  return dxM * nx + dyM * ny;
}

type GeoJsonGeometryLike = { type: string; coordinates?: unknown; geometries?: unknown };

/** Punto representativo (primer vértice) de una geometry GeoJSON. */
export function representativePoint(
  geometry: GeoJsonGeometryLike | null | undefined,
): [number, number] | null {
  const pts = allVertices(geometry);
  return pts.length ? pts[0] : null;
}

/** Todos los vértices [lng, lat] de una geometry GeoJSON (Point..MultiPolygon y GeometryCollection). */
export function allVertices(geometry: GeoJsonGeometryLike | null | undefined): [number, number][] {
  if (!geometry) return [];
  const out: [number, number][] = [];
  const walk = (c: unknown): void => {
    if (!Array.isArray(c)) return;
    if (typeof c[0] === "number" && typeof c[1] === "number") {
      out.push([c[0] as number, c[1] as number]);
      return;
    }
    for (const item of c) walk(item);
  };
  if ("coordinates" in geometry) walk(geometry.coordinates);
  else if (Array.isArray(geometry.geometries)) {
    for (const g of geometry.geometries) out.push(...allVertices(g as GeoJsonGeometryLike));
  }
  return out;
}

export function withinClipCorridor(
  clip: Pick<ClipPlaneState, "center" | "azimuthDeg" | "thicknessM"> & { axis: ClipAxis },
  point: [number, number] | null,
): boolean {
  if (!clip.center || !point) return true;
  const normal = clipAxisAzimuth(clip.axis, clip.azimuthDeg);
  const d = perpendicularDistanceM(clip.center, normal, point);
  return Math.abs(d) <= clip.thicknessM / 2;
}

/**
 * Pertenencia de una geometry completa al corredor: alcanza con que algún
 * vértice caiga dentro. Evita el sesgo de probar solo el primer vértice
 * (donde invertir el orden de una línea, o un polígono grande, cambiaría el
 * resultado arbitrariamente) a costa de no cubrir el caso de un polígono que
 * contiene todo el corredor sin tener ningún vértice propio dentro de él.
 */
export function geometryWithinClipCorridor(
  clip: Pick<ClipPlaneState, "center" | "azimuthDeg" | "thicknessM"> & { axis: ClipAxis },
  geometry: GeoJsonGeometryLike | null | undefined,
): boolean {
  if (!clip.center) return true;
  const vertices = allVertices(geometry);
  if (!vertices.length) return true;
  return vertices.some((p) => withinClipCorridor(clip, p));
}

/**
 * Media circular axial de un conjunto de rumbos (grados, eje sin sentido:
 * 10° y 190° describen el mismo eje). Promediar grados directamente falla en
 * ese caso (daría 100°, perpendicular a ambas medidas); en cambio se duplica
 * cada ángulo antes de promediar sus componentes seno/coseno y se vuelve a
 * dividir por 2.
 */
export function axialMeanDeg(samplesDeg: readonly number[]): number {
  if (!samplesDeg.length) return 0;
  let sx = 0;
  let sy = 0;
  for (const deg of samplesDeg) {
    const rad2 = (2 * deg * Math.PI) / 180;
    sx += Math.cos(rad2);
    sy += Math.sin(rad2);
  }
  const meanDoubled = (Math.atan2(sy, sx) * 180) / Math.PI;
  return (((meanDoubled / 2) % 180) + 180) % 180;
}
