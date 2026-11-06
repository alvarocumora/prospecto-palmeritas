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

/** Punto representativo de una geometry GeoJSON, para probar pertenencia al corredor. */
export function representativePoint(
  geometry: { type: string; coordinates?: unknown; geometries?: unknown } | null | undefined,
): [number, number] | null {
  if (!geometry) return null;
  const firstNumericPair = (c: unknown): [number, number] | null => {
    if (!Array.isArray(c)) return null;
    if (typeof c[0] === "number" && typeof c[1] === "number")
      return [c[0] as number, c[1] as number];
    for (const item of c) {
      const found = firstNumericPair(item);
      if (found) return found;
    }
    return null;
  };
  if ("coordinates" in geometry) return firstNumericPair(geometry.coordinates);
  if (Array.isArray(geometry.geometries)) {
    for (const g of geometry.geometries) {
      const found = representativePoint(g as typeof geometry);
      if (found) return found;
    }
  }
  return null;
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
