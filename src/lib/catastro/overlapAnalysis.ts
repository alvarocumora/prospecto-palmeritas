import * as turf from "@turf/turf";
import type { Feature, FeatureCollection, Polygon, MultiPolygon, GeoJsonProperties } from "geojson";

export type OverlapResult = {
  concessionId: string;
  concessionCode: string;
  concessionName: string;
  holder: string | null;
  totalAreaHa: number;
  overlapHa: number;
  pctOverlap: number;
  intersection: Feature<Polygon | MultiPolygon> | null;
};

type AnyPolyFeature = Feature<Polygon | MultiPolygon, GeoJsonProperties>;

function asFeature(geom: unknown): AnyPolyFeature | null {
  if (!geom) return null;
  try {
    const g = geom as { type?: string; geometry?: unknown };
    if (g.type === "Feature") return g as AnyPolyFeature;
    if (g.type === "Polygon" || g.type === "MultiPolygon") {
      return turf.feature(g as Polygon | MultiPolygon) as AnyPolyFeature;
    }
    if (g.type === "FeatureCollection") {
      const fc = g as unknown as FeatureCollection;
      const polys = fc.features.filter(
        (f) => f.geometry?.type === "Polygon" || f.geometry?.type === "MultiPolygon",
      );
      if (polys.length === 0) return null;
      // union all
      let acc: AnyPolyFeature | null = polys[0] as AnyPolyFeature;
      for (let i = 1; i < polys.length; i++) {
        try {
          const u = turf.union(turf.featureCollection([acc!, polys[i] as AnyPolyFeature]));
          if (u) acc = u as AnyPolyFeature;
        } catch {
          // skip
        }
      }
      return acc;
    }
  } catch {
    return null;
  }
  return null;
}

/** Compute overlap of an AOI feature against a list of concessions. */
export function computeOverlaps(
  aoi: unknown,
  concessions: Array<{
    id: string;
    code: string;
    name: string;
    holder: string | null;
    geometry_geojson: unknown;
    area_ha: number | null;
  }>,
): OverlapResult[] {
  const aoiFeat = asFeature(aoi);
  if (!aoiFeat) return [];
  const results: OverlapResult[] = [];
  for (const c of concessions) {
    const cFeat = asFeature(c.geometry_geojson);
    if (!cFeat) continue;
    let intersection: AnyPolyFeature | null = null;
    try {
      intersection = turf.intersect(
        turf.featureCollection([aoiFeat, cFeat]),
      ) as AnyPolyFeature | null;
    } catch {
      intersection = null;
    }
    if (!intersection) continue;
    const overlapM2 = turf.area(intersection);
    const overlapHa = overlapM2 / 10000;
    const totalAreaHa = c.area_ha ?? turf.area(cFeat) / 10000;
    const pctOverlap = totalAreaHa > 0 ? (overlapHa / totalAreaHa) * 100 : 0;
    results.push({
      concessionId: c.id,
      concessionCode: c.code,
      concessionName: c.name,
      holder: c.holder,
      totalAreaHa,
      overlapHa,
      pctOverlap,
      intersection,
    });
  }
  return results.sort((a, b) => b.overlapHa - a.overlapHa);
}

/** Total AOI area in ha. */
export function aoiAreaHa(aoi: unknown): number {
  const f = asFeature(aoi);
  if (!f) return 0;
  return turf.area(f) / 10000;
}
