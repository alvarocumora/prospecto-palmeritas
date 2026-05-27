// Helpers geométricos para el visor 3D Los Verdes.
// - Proyección de vetas inclinadas a su huella en superficie (footprint dip).
// - Centroides simples para anclar fill-extrusion al DEM.
import type { LngLat } from "@/lib/mining-calc";

const M_PER_DEG_LAT = 111_320;

/** Centroide simple (media aritmética de vértices). */
export function centroid(coords: LngLat[]): LngLat {
  let lng = 0;
  let lat = 0;
  for (const [x, y] of coords) {
    lng += x;
    lat += y;
  }
  const n = Math.max(coords.length, 1);
  return [lng / n, lat / n];
}

/** Centroide de un Polygon GeoJSON (anillo exterior). */
export function polygonCentroid(poly: { coordinates: LngLat[][] } | null | undefined): LngLat | null {
  const ring = poly?.coordinates?.[0];
  if (!ring || ring.length < 3) return null;
  return centroid(ring);
}

/** Punto medio de una línea (LineString). */
export function lineMidpoint(line: { coordinates: LngLat[] } | null | undefined): LngLat | null {
  const coords = line?.coordinates;
  if (!coords || coords.length < 2) return null;
  return centroid(coords);
}

/** Desplaza un [lng,lat] una distancia horizontal `meters` en azimut `azDeg` (0=N, 90=E). */
export function offsetLngLat([lng, lat]: LngLat, meters: number, azDeg: number): LngLat {
  const az = (azDeg * Math.PI) / 180;
  const dN = meters * Math.cos(az);
  const dE = meters * Math.sin(az);
  const dLat = dN / M_PER_DEG_LAT;
  const dLng = dE / (M_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180));
  return [lng + dLng, lat + dLat];
}

/**
 * Genera el footprint (Polygon) de la proyección a profundidad de una veta:
 * traza superficial + traza desplazada en dirección de buzamiento (`dip_dir_deg`)
 * una distancia horizontal `h = depth_bottom / tan(dip)`.
 */
export function veinDipFootprint(input: {
  trace: LngLat[];
  dip_deg: number;
  dip_dir_deg: number;
  depth_bottom_m: number;
}): LngLat[][] | null {
  const { trace, dip_deg, dip_dir_deg, depth_bottom_m } = input;
  if (!trace || trace.length < 2 || !depth_bottom_m || depth_bottom_m <= 0) return null;
  const dipRad = (Math.max(1, Math.min(89, dip_deg || 75)) * Math.PI) / 180;
  // horizontal run a profundidad bottom
  const horiz = depth_bottom_m / Math.tan(dipRad);
  if (!isFinite(horiz) || horiz <= 0) return null;
  const az = dip_dir_deg ?? 0;
  const offsetTrace = trace.map((pt) => offsetLngLat(pt, horiz, az));
  const ring: LngLat[] = [
    ...trace,
    ...[...offsetTrace].reverse(),
    trace[0],
  ];
  return [ring];
}

/** Distancia geodésica (Haversine) entre dos lng/lat en metros. */
export function haversineMeters(a: LngLat, b: LngLat): number {
  const R = 6378137;
  const dLat = ((b[1] - a[1]) * Math.PI) / 180;
  const dLng = ((b[0] - a[0]) * Math.PI) / 180;
  const lat1 = (a[1] * Math.PI) / 180;
  const lat2 = (b[1] * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/** Interpolación lineal lng/lat para muestreo de perfil (sección corta, ~planar). */
export function lerpLngLat(a: LngLat, b: LngLat, t: number): LngLat {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

/** Intersección de dos segmentos en plano lng/lat. Devuelve punto o null. */
export function segmentIntersect(
  p1: LngLat,
  p2: LngLat,
  p3: LngLat,
  p4: LngLat,
): LngLat | null {
  const x1 = p1[0], y1 = p1[1], x2 = p2[0], y2 = p2[1];
  const x3 = p3[0], y3 = p3[1], x4 = p4[0], y4 = p4[1];
  const den = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
  if (Math.abs(den) < 1e-12) return null;
  const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / den;
  const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / den;
  if (t < 0 || t > 1 || u < 0 || u > 1) return null;
  return [x1 + t * (x2 - x1), y1 + t * (y2 - y1)];
}

/** Intersecciones entre un segmento y un polígono (anillo exterior). */
export function segmentRingIntersections(
  a: LngLat,
  b: LngLat,
  ring: LngLat[],
): LngLat[] {
  const out: LngLat[] = [];
  for (let i = 0; i < ring.length - 1; i++) {
    const hit = segmentIntersect(a, b, ring[i], ring[i + 1]);
    if (hit) out.push(hit);
  }
  return out;
}
