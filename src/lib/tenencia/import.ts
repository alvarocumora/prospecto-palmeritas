// Tenencia · ingesta de geometrías con normalización de datum (§4).
//
// Todo polígono importado se lleva a WGS84 4326 (SRID canónico) ANTES de tocar
// la base o el motor de traslape. La conversión ocurre acá, en el borde. Para
// coordenadas UTM en PSAD56/SIRGAS/WGS84 se usa el módulo datum.ts (proj4).
//
// Este módulo es dep-free (no desempaqueta KMZ ni SHP): recibe GeoJSON ya
// parseado. El desempaque de contenedores binarios (KMZ=zip, SHP) se hace en la
// capa de arriba (browser), y entrega su GeoJSON a normalizeToWgs84.

import { utmToWgs84, type Datum, type Huso } from "./datum";

/** CRS de origen del GeoJSON entrante. */
export type SourceCrs =
  | { kind: "wgs84" } // coordenadas ya son lon/lat (4326)
  | { kind: "utm"; datum: Datum; huso: Huso }; // coordenadas son Este/Norte UTM

export type ImportReport = {
  features: number;
  polygons: number;
  source: SourceCrs;
  warnings: string[];
};

type PolyGeom = GeoJSON.Polygon | GeoJSON.MultiPolygon;
export type NormalizedImport = {
  featureCollection: GeoJSON.FeatureCollection<PolyGeom>;
  report: ImportReport;
};

/** ¿Un par [x,y] parece geográfico (lon/lat) y no UTM en metros? */
export function looksGeographic([x, y]: [number, number]): boolean {
  return Math.abs(x) <= 180 && Math.abs(y) <= 90;
}

type AnyGeoJson =
  GeoJSON.FeatureCollection | GeoJSON.Feature | GeoJSON.Geometry | GeoJSON.GeometryCollection;

/** Extrae los polígonos (Polygon/MultiPolygon) de cualquier GeoJSON de entrada. */
export function collectPolygons(input: AnyGeoJson): Array<{
  geometry: PolyGeom;
  properties: GeoJSON.GeoJsonProperties;
}> {
  const out: Array<{ geometry: PolyGeom; properties: GeoJSON.GeoJsonProperties }> = [];
  const pushGeom = (g: GeoJSON.Geometry | null, props: GeoJSON.GeoJsonProperties) => {
    if (!g) return;
    if (g.type === "Polygon" || g.type === "MultiPolygon")
      out.push({ geometry: g, properties: props });
    else if (g.type === "GeometryCollection") g.geometries.forEach((gg) => pushGeom(gg, props));
  };
  if (input.type === "FeatureCollection") {
    input.features.forEach((f) => pushGeom(f.geometry, f.properties ?? null));
  } else if (input.type === "Feature") {
    pushGeom(input.geometry, input.properties ?? null);
  } else if (input.type === "GeometryCollection") {
    input.geometries.forEach((g) => pushGeom(g, null));
  } else {
    pushGeom(input, null);
  }
  return out;
}

function convertPos(pos: number[], source: SourceCrs): [number, number] {
  if (source.kind === "wgs84") return [pos[0], pos[1]];
  return utmToWgs84({ e: pos[0], n: pos[1], huso: source.huso }, source.datum);
}

function convertRings(rings: number[][][], source: SourceCrs): number[][][] {
  return rings.map((ring) => ring.map((pos) => convertPos(pos, source)));
}

/**
 * Normaliza un GeoJSON de entrada a una FeatureCollection de polígonos en WGS84
 * 4326, convirtiendo desde el datum de origen. Advierte cuando las coordenadas
 * no calzan con el CRS declarado (típico error: UTM metido en un GeoJSON "WGS84").
 */
export function normalizeToWgs84(input: AnyGeoJson, source: SourceCrs): NormalizedImport {
  const polys = collectPolygons(input);
  const warnings: string[] = [];

  // Chequeo de coherencia CRS ↔ coordenadas sobre el primer vértice disponible.
  const firstPos = firstPosition(polys);
  if (firstPos) {
    const geo = looksGeographic(firstPos);
    if (source.kind === "wgs84" && !geo) {
      warnings.push(
        "Se declaró WGS84 pero las coordenadas parecen UTM (metros). Verifica el datum de origen.",
      );
    }
    if (source.kind === "utm" && geo) {
      warnings.push(
        "Se declaró UTM pero las coordenadas parecen lon/lat. Verifica el datum de origen.",
      );
    }
  }

  const features: GeoJSON.Feature<PolyGeom>[] = polys.map(({ geometry, properties }) => {
    if (geometry.type === "Polygon") {
      return {
        type: "Feature",
        properties: properties ?? null,
        geometry: { type: "Polygon", coordinates: convertRings(geometry.coordinates, source) },
      };
    }
    return {
      type: "Feature",
      properties: properties ?? null,
      geometry: {
        type: "MultiPolygon",
        coordinates: geometry.coordinates.map((poly) => convertRings(poly, source)),
      },
    };
  });

  return {
    featureCollection: { type: "FeatureCollection", features },
    report: {
      features: features.length,
      polygons: features.length,
      source,
      warnings,
    },
  };
}

function firstPosition(polys: Array<{ geometry: PolyGeom }>): [number, number] | null {
  for (const { geometry } of polys) {
    const p =
      geometry.type === "Polygon"
        ? geometry.coordinates[0]?.[0]
        : geometry.coordinates[0]?.[0]?.[0];
    if (p && p.length >= 2) return [p[0], p[1]];
  }
  return null;
}
