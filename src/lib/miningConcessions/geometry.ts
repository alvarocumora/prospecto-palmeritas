export function intersectsAoiBbox(geom: unknown, aoiCoords: [number, number][] | null): boolean {
  if (!geom || !aoiCoords || aoiCoords.length === 0) return false;
  const g = geom as { type?: string; coordinates?: unknown };
  if (!g.type || !g.coordinates) return false;

  const points: [number, number][] = [];
  const collectRing = (ring: unknown) => {
    if (!Array.isArray(ring)) return;
    for (const pt of ring) {
      if (Array.isArray(pt) && pt.length >= 2) points.push([pt[0] as number, pt[1] as number]);
    }
  };

  if (g.type === "Polygon") {
    for (const ring of g.coordinates as unknown[]) collectRing(ring);
  } else if (g.type === "MultiPolygon") {
    for (const poly of g.coordinates as unknown[]) {
      if (Array.isArray(poly)) for (const ring of poly) collectRing(ring);
    }
  } else {
    return false;
  }

  if (points.length === 0) return false;

  const lngs = points.map((p) => p[0]);
  const lats = points.map((p) => p[1]);
  const gMinLng = Math.min(...lngs);
  const gMaxLng = Math.max(...lngs);
  const gMinLat = Math.min(...lats);
  const gMaxLat = Math.max(...lats);

  const aLngs = aoiCoords.map((p) => p[0]);
  const aLats = aoiCoords.map((p) => p[1]);
  const aMinLng = Math.min(...aLngs);
  const aMaxLng = Math.max(...aLngs);
  const aMinLat = Math.min(...aLats);
  const aMaxLat = Math.max(...aLats);

  return !(gMaxLng < aMinLng || gMinLng > aMaxLng || gMaxLat < aMinLat || gMinLat > aMaxLat);
}
