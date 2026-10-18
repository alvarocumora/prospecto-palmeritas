import type { FeatureCollection } from "geojson";
import type { PublicGeoBundle } from "@/lib/geospatial/publicGeoContract";
import type { CanonicalGeoLayerId } from "@/lib/geospatial/layerRegistry";
import type { GeoSceneProjectLayer } from "./projectLayers";

/** Preserve the canonical ID and per-feature metadata; never invent evidence. */
export function bundleSceneLayers(bundle: PublicGeoBundle): GeoSceneProjectLayer[] {
  return Object.entries(bundle.layers).flatMap(([id, data]) => data?.features.length
    ? [{ id: id as CanonicalGeoLayerId, data: data as FeatureCollection }]
    : []);
}