/** Minimal KML → GeoJSON Geometry parser (LineString, Polygon, Point, MultiGeometry). */

type Coord = [number, number] | [number, number, number];

function parseCoords(text: string): Coord[] {
  return text
    .trim()
    .split(/\s+/)
    .map((tuple) => {
      const parts = tuple.split(",").map((n) => Number(n));
      if (parts.length < 2 || parts.some((n) => Number.isNaN(n))) return null;
      return (parts.length >= 3 ? [parts[0], parts[1], parts[2]] : [parts[0], parts[1]]) as Coord;
    })
    .filter((c): c is Coord => c !== null);
}

function getText(el: Element, tag: string): string | null {
  const node = el.getElementsByTagName(tag)[0];
  return node?.textContent?.trim() ?? null;
}

function geomFromElement(el: Element): GeoJSON.Geometry | null {
  const tag = el.tagName.replace(/^.*:/, "");
  if (tag === "Point") {
    const c = getText(el, "coordinates");
    if (!c) return null;
    const coords = parseCoords(c);
    if (!coords.length) return null;
    return { type: "Point", coordinates: coords[0] };
  }
  if (tag === "LineString") {
    const c = getText(el, "coordinates");
    if (!c) return null;
    const coords = parseCoords(c);
    if (coords.length < 2) return null;
    return { type: "LineString", coordinates: coords };
  }
  if (tag === "Polygon") {
    const outer = el.getElementsByTagName("outerBoundaryIs")[0];
    const ring = outer?.getElementsByTagName("coordinates")[0]?.textContent;
    if (!ring) return null;
    const coords = parseCoords(ring);
    if (coords.length < 3) return null;
    return { type: "Polygon", coordinates: [coords] };
  }
  if (tag === "MultiGeometry") {
    const geoms: GeoJSON.Geometry[] = [];
    Array.from(el.children).forEach((child) => {
      const g = geomFromElement(child);
      if (g) geoms.push(g);
    });
    if (!geoms.length) return null;
    return { type: "GeometryCollection", geometries: geoms };
  }
  return null;
}

/** Parses KML and returns the FIRST usable geometry found. */
export function kmlToGeometry(kmlText: string): GeoJSON.Geometry | null {
  if (typeof DOMParser === "undefined") return null;
  const doc = new DOMParser().parseFromString(kmlText, "application/xml");
  const placemarks = doc.getElementsByTagName("Placemark");
  for (let i = 0; i < placemarks.length; i++) {
    const pm = placemarks[i];
    for (const child of Array.from(pm.children)) {
      const g = geomFromElement(child);
      if (g) return g;
    }
  }
  // Fallback: any LineString anywhere
  const ls = doc.getElementsByTagName("LineString")[0];
  if (ls) return geomFromElement(ls);
  return null;
}

/** Parses GeoJSON text and returns its geometry (handles Feature/FeatureCollection). */
export function geojsonToGeometry(text: string): GeoJSON.Geometry | null {
  try {
    const parsed = JSON.parse(text) as GeoJSON.GeoJSON;
    if (parsed.type === "FeatureCollection") {
      const f = parsed.features.find((x) => x.geometry);
      return f?.geometry ?? null;
    }
    if (parsed.type === "Feature") return parsed.geometry ?? null;
    if ("coordinates" in parsed || parsed.type === "GeometryCollection") {
      return parsed as GeoJSON.Geometry;
    }
    return null;
  } catch {
    return null;
  }
}

/** Auto-detects KML vs GeoJSON by content. */
export function parseGeoFile(text: string): GeoJSON.Geometry | null {
  const trimmed = text.trim();
  if (trimmed.startsWith("<")) return kmlToGeometry(trimmed);
  return geojsonToGeometry(trimmed);
}

/** Computes bbox [minLng, minLat, maxLng, maxLat] from a geometry. */
export function geometryBbox(geom: GeoJSON.Geometry): [number, number, number, number] | null {
  let minLng = Infinity,
    minLat = Infinity,
    maxLng = -Infinity,
    maxLat = -Infinity;
  const visit = (coords: unknown): void => {
    if (Array.isArray(coords) && typeof coords[0] === "number") {
      const [lng, lat] = coords as number[];
      if (lng < minLng) minLng = lng;
      if (lat < minLat) minLat = lat;
      if (lng > maxLng) maxLng = lng;
      if (lat > maxLat) maxLat = lat;
      return;
    }
    if (Array.isArray(coords)) coords.forEach(visit);
  };
  if (geom.type === "GeometryCollection") {
    geom.geometries.forEach((g) => {
      const b = geometryBbox(g);
      if (b) {
        if (b[0] < minLng) minLng = b[0];
        if (b[1] < minLat) minLat = b[1];
        if (b[2] > maxLng) maxLng = b[2];
        if (b[3] > maxLat) maxLat = b[3];
      }
    });
  } else {
    visit((geom as { coordinates: unknown }).coordinates);
  }
  if (!Number.isFinite(minLng)) return null;
  return [minLng, minLat, maxLng, maxLat];
}
