import type { FeatureCollection } from "geojson";
import type { GeoSceneProject, GeoSceneProjectLayer } from "@/components/geoscene/projectLayers";
import { buildCholquiPublicGeoBundle } from "./cholquiPublicGeo";

const SCENE_IDS = [
  "territory.cadastre",
  "territory.pending_pedimentos",
  "territory.proposed_pedimentos",
  "territory.mojones",
] as const;

const SOURCES: Record<(typeof SCENE_IDS)[number], string> = {
  "territory.cadastre": "SERNAGEOMIN (copias oficiales SIGEX/ArcGIS Online)",
  "territory.pending_pedimentos": "KML del titular — no publicado",
  "territory.proposed_pedimentos": "Borrador del proyecto",
  "territory.mojones": "KML del titular (FINAL_GIANFRANCO.kml)",
};

/** Cholqui tenure layers + explicit project frame for GeoScene3D. */
export function buildCholquiSceneInput(): {
  project: GeoSceneProject;
  layers: GeoSceneProjectLayer[];
} {
  const bundle = buildCholquiPublicGeoBundle();
  return {
    project: { id: bundle.manifest.project.id, name: "Cholqui", center: bundle.center, bbox: bundle.bbox },
    layers: SCENE_IDS.flatMap((id) => {
      const data = bundle.layers[id];
      return data ? [{ id, data: data as unknown as FeatureCollection, source: SOURCES[id] }] : [];
    }),
  };
}
