// CRS helpers — conversión geodésica simple para escenas locales.
const R = 6378137;

export function lngLatToMeters(
  lng: number,
  lat: number,
  centerLng: number,
  centerLat: number,
): { x: number; y: number } {
  const dLat = ((lat - centerLat) * Math.PI) / 180;
  const dLng = ((lng - centerLng) * Math.PI) / 180;
  return {
    x: dLng * R * Math.cos((centerLat * Math.PI) / 180),
    y: dLat * R,
  };
}

export function metersToLngLat(
  x: number,
  y: number,
  centerLng: number,
  centerLat: number,
): { lng: number; lat: number } {
  const lat = centerLat + (y / R) * (180 / Math.PI);
  const lng = centerLng + (x / (R * Math.cos((centerLat * Math.PI) / 180))) * (180 / Math.PI);
  return { lng, lat };
}
