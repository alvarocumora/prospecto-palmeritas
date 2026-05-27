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
