import type { Feature, Polygon } from "geojson";
import aoiData from "@/data/geo/aoi.geojson?url";
import type { AnyFC } from "./types";

export type AoiPolygon = Feature<Polygon, Record<string, unknown>>;

let cached: AoiPolygon | null = null;

export async function loadAoiPolygon(): Promise<AoiPolygon | null> {
  if (cached) return cached;
  const fc = (await fetch(aoiData).then((r) => r.json())) as AnyFC;
  const poly = fc.features.find((f) => f.geometry?.type === "Polygon");
  if (!poly) return null;
  cached = poly as AoiPolygon;
  return cached;
}
